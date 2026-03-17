/**
 * Copy seeded data from one database to another (e.g., dev → prod)
 *
 * Reads all menu data from SOURCE_DB and writes to TARGET_DB.
 * Both connection strings must be set in .env.local:
 *   - POSTGRES_URL_DEV
 *   - POSTGRES_URL_PROD
 *
 * Usage:  npx tsx scripts/copy-data.ts
 *         npx tsx scripts/copy-data.ts --dry-run
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const devUrl = process.env.POSTGRES_URL_DEV;
const prodUrl = process.env.POSTGRES_URL_PROD;

if (!devUrl || !prodUrl) {
  console.error("Missing env vars. Set both POSTGRES_URL_DEV and POSTGRES_URL_PROD in .env.local");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

const source = new PrismaClient({ adapter: new PrismaPg({ connectionString: devUrl }) });
const target = new PrismaClient({ adapter: new PrismaPg({ connectionString: prodUrl }) });

async function main() {
  console.log(`${dryRun ? "[DRY RUN] " : ""}Copying data from DEV → PROD\n`);

  // ─── Read all data from source ───
  console.log("Reading from DEV...");

  const allergens = await source.allergen.findMany({ orderBy: { id: "asc" } });
  const categories = await source.category.findMany({ orderBy: { id: "asc" } });
  const dishes = await source.dish.findMany({ orderBy: { dish_id: "asc" } });
  const dishVariants = await source.dish_variant.findMany({ orderBy: { id: "asc" } });
  const dishAllergens = await source.dish_allergen.findMany();
  const categoriesDishes = await source.categories_dishes.findMany();
  const drinks = await source.drink.findMany({ orderBy: { drink_id: "asc" } });
  const drinkSizes = await source.drink_size.findMany();
  const drinkSelections = await source.drink_selection.findMany({ orderBy: { id: "asc" } });
  const categoriesDrinks = await source.categories_drinks.findMany();
  const tables = await source.restaurant_table.findMany({ orderBy: { table_number: "asc" } });

  console.log(`  ${allergens.length} allergens`);
  console.log(`  ${categories.length} categories`);
  console.log(`  ${dishes.length} dishes (${dishVariants.length} variants, ${dishAllergens.length} allergen links)`);
  console.log(`  ${drinks.length} drinks (${drinkSizes.length} sizes, ${drinkSelections.length} selections)`);
  console.log(`  ${tables.length} restaurant tables`);
  console.log();

  if (dryRun) {
    console.log("[DRY RUN] Would write all the above to PROD. Exiting.");
    return;
  }

  // ─── Clear target ───
  console.log("Clearing PROD...");
  await target.dish_allergen.deleteMany();
  await target.dish_variant.deleteMany();
  await target.categories_dishes.deleteMany();
  await target.categories_drinks.deleteMany();
  await target.drink_selection.deleteMany();
  await target.drink_size.deleteMany();
  await target.weekly_special.deleteMany();
  await target.item_association.deleteMany();
  await target.customer_preference.deleteMany();
  await target.dish.deleteMany();
  await target.drink.deleteMany();
  await target.category.deleteMany();
  await target.allergen.deleteMany();
  await target.restaurant_table.deleteMany();

  // Reset sequences
  await target.$executeRaw`ALTER SEQUENCE category_id_seq RESTART WITH 1`;
  await target.$executeRaw`ALTER SEQUENCE dish_dish_id_seq RESTART WITH 1`;
  await target.$executeRaw`ALTER SEQUENCE dish_variant_id_seq RESTART WITH 1`;
  await target.$executeRaw`ALTER SEQUENCE drink_drink_id_seq RESTART WITH 1`;
  await target.$executeRaw`ALTER SEQUENCE drink_selection_id_seq RESTART WITH 1`;
  await target.$executeRaw`ALTER SEQUENCE item_association_id_seq RESTART WITH 1`;
  await target.$executeRaw`ALTER SEQUENCE customer_preference_id_seq RESTART WITH 1`;
  await target.$executeRaw`ALTER SEQUENCE weekly_special_id_seq RESTART WITH 1`;
  await target.$executeRaw`ALTER SEQUENCE live_event_id_seq RESTART WITH 1`;
  console.log("  ✓ Cleared + sequences reset\n");

  // ─── Write to target (order matters for FK constraints) ───
  console.log("Writing to PROD...");

  // Allergens (explicit IDs)
  for (const a of allergens) {
    await target.allergen.create({ data: a });
  }
  console.log(`  ✓ ${allergens.length} allergens`);

  // Categories (explicit IDs to preserve FK references)
  for (const c of categories) {
    await target.$executeRawUnsafe(
      `INSERT INTO category (id, name_fr, name_en, name_lb, type, sort_order, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      c.id, c.name_fr, c.name_en, c.name_lb, c.type, c.sort_order, c.is_active
    );
  }
  // Advance sequence past max ID
  await target.$executeRawUnsafe(`SELECT setval('category_id_seq', $1)`, Math.max(...categories.map(c => c.id)));
  console.log(`  ✓ ${categories.length} categories`);

  // Dishes (explicit IDs)
  for (const d of dishes) {
    await target.$executeRawUnsafe(
      `INSERT INTO dish (dish_id, name_fr, name_en, name_lb, description_fr, description_en, description_lb, price_eur, image_url, is_available, is_popular, is_new, sort_order, has_variants, selection_label, record_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      d.dish_id, d.name_fr, d.name_en, d.name_lb, d.description_fr, d.description_en, d.description_lb,
      d.price_eur, d.image_url, d.is_available, d.is_popular, d.is_new, d.sort_order,
      d.has_variants, d.selection_label, d.record_date
    );
  }
  await target.$executeRawUnsafe(`SELECT setval('dish_dish_id_seq', $1)`, Math.max(...dishes.map(d => d.dish_id)));
  console.log(`  ✓ ${dishes.length} dishes`);

  // Dish variants (explicit IDs)
  for (const v of dishVariants) {
    await target.$executeRawUnsafe(
      `INSERT INTO dish_variant (id, dish_id, name_fr, name_en, name_lb, price_eur, sort_order, is_available)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      v.id, v.dish_id, v.name_fr, v.name_en, v.name_lb, v.price_eur, v.sort_order, v.is_available
    );
  }
  if (dishVariants.length > 0) {
    await target.$executeRawUnsafe(`SELECT setval('dish_variant_id_seq', $1)`, Math.max(...dishVariants.map(v => v.id)));
  }
  console.log(`  ✓ ${dishVariants.length} dish variants`);

  // Dish allergens (composite PK, no sequence)
  for (const da of dishAllergens) {
    await target.dish_allergen.create({ data: { dish_id: da.dish_id, allergen_id: da.allergen_id } });
  }
  console.log(`  ✓ ${dishAllergens.length} dish allergen links`);

  // Categories ↔ dishes junction
  for (const cd of categoriesDishes) {
    await target.categories_dishes.create({ data: { category_id: cd.category_id, dish_id: cd.dish_id } });
  }
  console.log(`  ✓ ${categoriesDishes.length} category-dish links`);

  // Drinks (explicit IDs)
  for (const d of drinks) {
    await target.$executeRawUnsafe(
      `INSERT INTO drink (drink_id, name_fr, name_en, name_lb, description_fr, description_en, description_lb, selection_mode, record_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      d.drink_id, d.name_fr, d.name_en, d.name_lb, d.description_fr, d.description_en, d.description_lb,
      d.selection_mode, d.record_date
    );
  }
  await target.$executeRawUnsafe(`SELECT setval('drink_drink_id_seq', $1)`, Math.max(...drinks.map(d => d.drink_id)));
  console.log(`  ✓ ${drinks.length} drinks`);

  // Drink sizes (composite PK)
  for (const s of drinkSizes) {
    await target.drink_size.create({
      data: { drink_id: s.drink_id, size: s.size, price_eur: s.price_eur, discount: s.discount, image_url: s.image_url },
    });
  }
  console.log(`  ✓ ${drinkSizes.length} drink sizes`);

  // Drink selections (explicit IDs)
  for (const s of drinkSelections) {
    await target.$executeRawUnsafe(
      `INSERT INTO drink_selection (id, drink_id, name_fr, name_en, name_lb, price_delta, sort_order, is_available)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      s.id, s.drink_id, s.name_fr, s.name_en, s.name_lb, s.price_delta, s.sort_order, s.is_available
    );
  }
  if (drinkSelections.length > 0) {
    await target.$executeRawUnsafe(`SELECT setval('drink_selection_id_seq', $1)`, Math.max(...drinkSelections.map(s => s.id)));
  }
  console.log(`  ✓ ${drinkSelections.length} drink selections`);

  // Categories ↔ drinks junction
  for (const cd of categoriesDrinks) {
    await target.categories_drinks.create({ data: { category_id: cd.category_id, drink_id: cd.drink_id } });
  }
  console.log(`  ✓ ${categoriesDrinks.length} category-drink links`);

  // Restaurant tables
  for (const t of tables) {
    await target.restaurant_table.create({ data: { table_number: t.table_number, location: t.location } });
  }
  console.log(`  ✓ ${tables.length} restaurant tables`);

  console.log("\n✅ Data copy complete!");
}

main()
  .catch((e) => {
    console.error("Copy failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await source.$disconnect();
    await target.$disconnect();
  });
