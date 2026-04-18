/**
 * One-off data repair for drinks that ended up with no `drink_size` rows
 * because the seed parser couldn't handle their CSV shape. Covers two cases:
 *
 *   1. Fraction-in-format (e.g. "verre / 1/4 / 1/2 / Bouteille"): the seed
 *      used to split on a bare `/` which yielded 7 tokens against 4 prices.
 *      seed.ts now splits on whitespace-hugged `/` only.
 *
 *   2. Selection-priced (e.g. Gin: Details="Bombay ou Hendricks",
 *      Prix="6.80 / 8.50", empty Format): the seed used to create selections
 *      with no price and no drink_size. seed.ts now treats this as a
 *      "variant" — cheapest price becomes the base drink_size "standard", and
 *      each selection carries the difference as price_delta.
 *
 * Both customer-side filters (`/api/menu/drinks` + DrinksSection) hide drinks
 * with zero sizes, which is why affected rows (wines, Gin) were invisible.
 *
 * This script mirrors the fixed seed logic as a non-destructive repair:
 *   - Skips any drink that already has ≥1 drink_size.
 *   - Matches CSV rows to DB drinks by name_fr (case-insensitive).
 *   - Inserts the missing drink_size row(s).
 *   - In the selection-priced case, ALSO updates existing drink_selection rows
 *     to set price_delta (earlier seed runs already created them with delta=0).
 *
 * Usage:
 *   npx tsx scripts/repair-wine-sizes.ts            # dry-run
 *   npx tsx scripts/repair-wine-sizes.ts --apply    # actually write
 *
 * Run against whichever DB POSTGRES_URL points to in .env.local.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('POSTGRES_URL not set in .env.local');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');

// Whitespace-hugged `/` — the fix.
const SIZE_SEP = /\s+\/\s+/;

function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function readDrinksCsv(): string[][] {
  const path = resolve(__dirname, '..', 'public/dishes-raw/millewee boissons.csv');
  const raw = readFileSync(path, 'latin1');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.slice(1).map((l) => parseCsvLine(l, ';'));
}

interface ParsedRow {
  name: string;
  sizesAndPrices: { size: string; price_eur: number }[];
  // Populated only for the selection-priced (Gin-style) case. The apply step
  // uses these to UPDATE existing drink_selection rows (which earlier seed
  // runs created with delta=0).
  selectionDeltas: { name: string; price_delta: number }[];
}

// Mirror of seed.ts selection split — `/` or ` ou ` surrounded by whitespace.
const SEL_SEP = /\s*(?:\/|ou)\s*/;

function parseRow(row: string[]): ParsedRow | null {
  const [, name, details, format, priceStr] = row;
  if (!name) return null;
  const cleanName = name.replace(/\s*\/\s*$/, '').trim();

  const prices = priceStr ? priceStr.split(SIZE_SEP).map((p) => p.trim()) : [];
  const sizes = format ? format.split(SIZE_SEP).map((s) => s.trim()) : [];

  const hasSelections =
    !!details && details !== '-' && (details.includes(' / ') || details.includes(' ou '));
  const selItems: string[] = hasSelections
    ? details.split(SEL_SEP).map((s) => s.trim()).filter(Boolean)
    : [];

  const out: { size: string; price_eur: number }[] = [];
  const selectionDeltas: { name: string; price_delta: number }[] = [];

  if (sizes.length > 0 && prices.length === sizes.length) {
    for (let i = 0; i < sizes.length; i++) {
      const p = parseFloat(prices[i].replace(',', '.'));
      if (!isNaN(p)) out.push({ size: sizes[i], price_eur: p });
    }
  } else if (
    sizes.length === 0 &&
    selItems.length > 1 &&
    prices.length === selItems.length
  ) {
    // Selection-priced: cheapest becomes base standard size, others carry a delta.
    const parsed = prices.map((p) => parseFloat(p.replace(',', '.')));
    if (parsed.every((n) => !isNaN(n))) {
      const basePrice = Math.min(...parsed);
      out.push({ size: 'standard', price_eur: basePrice });
      for (let i = 0; i < selItems.length; i++) {
        selectionDeltas.push({ name: selItems[i], price_delta: parsed[i] - basePrice });
      }
    }
  } else if (prices.length === 1 || (prices.length === 0 && priceStr)) {
    const p = parseFloat((prices[0] || priceStr || '').replace(',', '.'));
    if (!isNaN(p)) out.push({ size: 'standard', price_eur: p });
  }
  return { name: cleanName, sizesAndPrices: out, selectionDeltas };
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: connectionString! }),
  });

  try {
    const rows = readDrinksCsv();
    const parsedByName = new Map<string, ParsedRow>();
    for (const r of rows) {
      const p = parseRow(r);
      if (p) parsedByName.set(p.name.toLowerCase(), p);
    }

    const sizelessDrinks = await prisma.drink.findMany({
      where: { sizes: { none: {} } },
      include: { sizes: true, categories: { include: { category: true } } },
      orderBy: { name_fr: 'asc' },
    });

    console.log(
      `Found ${sizelessDrinks.length} drinks with zero sizes. Matching against CSV...\n`,
    );

    let wouldInsert = 0;
    let wouldUpdateSelections = 0;
    let noCsvMatch = 0;
    let noSizesParsed = 0;
    const plan: {
      drinkId: number;
      name: string;
      sizes: { size: string; price_eur: number }[];
      selectionDeltas: { name: string; price_delta: number }[];
    }[] = [];

    for (const d of sizelessDrinks) {
      const parsed = parsedByName.get(d.name_fr.toLowerCase());
      const catName = d.categories[0]?.category.name_fr ?? '(no cat)';
      if (!parsed) {
        console.log(`  ? [${catName}] "${d.name_fr}" — not found in CSV`);
        noCsvMatch++;
        continue;
      }
      if (parsed.sizesAndPrices.length === 0) {
        console.log(`  ? [${catName}] "${d.name_fr}" — parser still returned no sizes`);
        noSizesParsed++;
        continue;
      }
      console.log(`  + [${catName}] "${d.name_fr}"`);
      for (const sp of parsed.sizesAndPrices) {
        console.log(`      ${sp.size}: ${sp.price_eur.toFixed(2)} €`);
      }
      for (const sd of parsed.selectionDeltas) {
        if (sd.price_delta !== 0) {
          console.log(`      selection "${sd.name}" delta: +${sd.price_delta.toFixed(2)} €`);
        }
      }
      plan.push({
        drinkId: d.drink_id,
        name: d.name_fr,
        sizes: parsed.sizesAndPrices,
        selectionDeltas: parsed.selectionDeltas,
      });
      wouldInsert += parsed.sizesAndPrices.length;
      wouldUpdateSelections += parsed.selectionDeltas.filter((s) => s.price_delta !== 0).length;
    }

    console.log('');
    console.log(
      `Summary: ${plan.length} drinks ready to repair, ${wouldInsert} drink_size rows to insert, ${wouldUpdateSelections} drink_selection price_delta updates.`,
    );
    if (noCsvMatch > 0) console.log(`         ${noCsvMatch} drinks not found in CSV (investigate manually).`);
    if (noSizesParsed > 0) console.log(`         ${noSizesParsed} drinks parsed but still yielded no sizes (investigate manually).`);

    if (!APPLY) {
      console.log('\n--dry-run (default): no changes written. Re-run with --apply to repair.');
      return;
    }

    const ops = [];
    for (const p of plan) {
      for (const s of p.sizes) {
        ops.push(
          prisma.drink_size.create({
            data: { drink_id: p.drinkId, size: s.size, price_eur: s.price_eur },
          }),
        );
      }
      for (const sd of p.selectionDeltas) {
        if (sd.price_delta === 0) continue;
        // updateMany — selection rows were created by earlier seed runs with delta=0.
        // Match by drink_id + name_fr (case-insensitive via equals mode).
        ops.push(
          prisma.drink_selection.updateMany({
            where: { drink_id: p.drinkId, name_fr: { equals: sd.name, mode: 'insensitive' } },
            data: { price_delta: sd.price_delta },
          }),
        );
      }
    }

    await prisma.$transaction(ops);

    console.log(
      `\n✓ Inserted ${wouldInsert} drink_size rows across ${plan.length} drinks, updated ${wouldUpdateSelections} drink_selection price_delta values.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
