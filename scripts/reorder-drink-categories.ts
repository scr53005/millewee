/**
 * Set the display order of drink categories on the customer menu.
 *
 * The customer menu renders drink categories by `category.sort_order` ASC
 * (see `app/api/menu/drinks/route.ts`). This script sets that field so the
 * UI matches the order below.
 *
 * Usage:
 *   npx tsx scripts/reorder-drink-categories.ts [--dry-run]
 *
 * Matching is done by `name_fr` with accent + case normalization so it's
 * resilient to "Bières" vs "bieres" etc. Any drink category not in the list
 * below is pushed to the end (in its current relative order) so it still
 * appears without breaking the sort.
 *
 * Idempotent — safe to re-run.
 *
 * Run against whichever DB POSTGRES_URL points to in .env.local.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('POSTGRES_URL not set in .env.local');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

// Desired order on the customer menu. Matched case/accent-insensitive against
// category.name_fr.
const DESIRED_ORDER = [
  'Bières',
  'Bières Sans Alcool',
  'Vins Maison',
  'Vins Blancs',
  'Vins Rosés',
  'Vins Rouges',
  'Bulles',
  'Apéritifs',
  'Softs',
  'Boissons chaudes',
  'Digestifs',
];

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: connectionString! }),
  });

  try {
    const categories = await prisma.category.findMany({
      where: { type: 'drinks' },
      orderBy: { sort_order: 'asc' },
    });

    console.log('--- Before ---');
    for (const c of categories) {
      console.log(`  [${c.sort_order}] ${c.name_fr}  (active=${c.is_active})`);
    }

    const byNormalizedName = new Map<string, typeof categories[number]>();
    for (const c of categories) {
      byNormalizedName.set(normalize(c.name_fr), c);
    }

    // Assign 10, 20, 30 ... to leave room for manual nudges later via the admin UI.
    const updates: { id: number; name: string; newOrder: number }[] = [];
    const seenIds = new Set<number>();

    DESIRED_ORDER.forEach((desiredName, idx) => {
      const match = byNormalizedName.get(normalize(desiredName));
      if (!match) {
        console.warn(`  ! "${desiredName}" not found in DB — skipped`);
        return;
      }
      updates.push({ id: match.id, name: match.name_fr, newOrder: (idx + 1) * 10 });
      seenIds.add(match.id);
    });

    // Push any unlisted drink categories to the end in their current relative order.
    let tailOrder = (DESIRED_ORDER.length + 1) * 10;
    for (const c of categories) {
      if (!seenIds.has(c.id)) {
        updates.push({ id: c.id, name: c.name_fr, newOrder: tailOrder });
        tailOrder += 10;
      }
    }

    console.log('\n--- Planned updates ---');
    for (const u of updates) {
      console.log(`  [${u.newOrder}] ${u.name}  (id=${u.id})`);
    }

    if (DRY_RUN) {
      console.log('\n--dry-run: no changes written');
      return;
    }

    await prisma.$transaction(
      updates.map((u) =>
        prisma.category.update({
          where: { id: u.id },
          data: { sort_order: u.newOrder },
        }),
      ),
    );

    const after = await prisma.category.findMany({
      where: { type: 'drinks' },
      orderBy: { sort_order: 'asc' },
    });
    console.log('\n--- After ---');
    for (const c of after) {
      console.log(`  [${c.sort_order}] ${c.name_fr}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
