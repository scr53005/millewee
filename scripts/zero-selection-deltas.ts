/**
 * Zero out price_delta for flat-price drinks' selections.
 *
 * A drink with selection_mode='selection' is a single-price product whose selections are just
 * flavor picks (Soda → Cola/Fanta, Classiques → Aperol Spritz/Hugo/Mojito). They must NOT add
 * to the price. The customer card computes finalPrice = basePrice + selection.price_delta, so
 * any non-zero delta on a flat drink double-counts — e.g. an 11.80€ Aperol Spritz rings up as
 * 23.60€.
 *
 * The seed already writes 0 for these (the single-price branch), so this corrects rows that
 * drifted in a live DB (an older seed run, or admin edits). 'variant' drinks (e.g. Gin
 * Bombay/Hendricks, where each pick has its own price baked into the delta) are deliberately
 * left untouched — their deltas are real price differences.
 *
 * DRY RUN by default — prints what WOULD change. Pass --apply to write. Idempotent (re-running
 * after a fix finds nothing).
 *
 *   npx tsx scripts/zero-selection-deltas.ts            # preview
 *   npx tsx scripts/zero-selection-deltas.ts --apply    # apply
 *
 * Target DB = wherever POSTGRES_URL resolves to; the host is printed before any write so you
 * can confirm DEV vs PROD.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.POSTGRES_URL! }),
});

const APPLY = process.argv.includes("--apply");

function dbLabel(): string {
  try {
    const u = new URL(process.env.POSTGRES_URL ?? "");
    return `${u.host}${u.pathname}`; // host + db only, never the password
  } catch {
    return "UNKNOWN";
  }
}

// The offending shape: a non-zero delta on a flat ('selection') drink.
const WHERE = { price_delta: { not: 0 }, drink: { selection_mode: "selection" } } as const;

async function main() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is not set — check millewee/.env (or .env.local).");
  }
  console.log(`[zero-deltas] Target DB: ${dbLabel()} — mode: ${APPLY ? "APPLY" : "DRY RUN"}`);

  const affected = await prisma.drink_selection.findMany({
    where: WHERE,
    include: { drink: { select: { name_fr: true } } },
    orderBy: [{ drink_id: "asc" }, { sort_order: "asc" }],
  });

  if (affected.length === 0) {
    console.log("[zero-deltas] Nothing to fix — every flat-drink selection already has price_delta 0. ✅");
    return;
  }

  console.log(`[zero-deltas] ${affected.length} selection(s) on flat drinks carry a non-zero delta:`);
  for (const s of affected) {
    console.log(`   - ${s.drink.name_fr} → "${s.name_fr}"  price_delta=${Number(s.price_delta).toFixed(2)} → 0.00`);
  }

  if (!APPLY) {
    console.log("\n[zero-deltas] DRY RUN — no changes written. Re-run with --apply to fix.");
    return;
  }

  const result = await prisma.drink_selection.updateMany({ where: WHERE, data: { price_delta: 0 } });
  console.log(`\n[zero-deltas] ✅ Set price_delta=0 on ${result.count} selection(s).`);
}

main()
  .catch((e) => {
    console.error("[zero-deltas] FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
