/**
 * Millewee database seed script
 *
 * Parses:
 *   - public/dishes-raw/Millewee dishes.csv      (comma-delimited, UTF-8)
 *   - public/dishes-raw/millewee boissons.csv     (semicolon-delimited, Latin-1)
 *
 * Seeds:
 *   - categories, dishes, dish_variants, allergens, dish_allergens
 *   - drinks, drink_sizes, drink_selections
 *   - restaurant_tables (from scripts/qrcodes/milleweetables.csv)
 *
 * Run:  npx tsx scripts/seed.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { resolve } from "path";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.POSTGRES_URL! }),
});

// ─── EU Allergens (codes 1-14, trilingual) ───

const EU_ALLERGENS: { id: number; name_fr: string; name_en: string; name_lb: string; icon: string }[] = [
  { id: 1,  name_fr: "Gluten",         name_en: "Gluten",          name_lb: "Gluten",          icon: "🌾" },
  { id: 2,  name_fr: "Crustacés",      name_en: "Crustaceans",     name_lb: "Krustentéieren",  icon: "🦐" },
  { id: 3,  name_fr: "Œufs",           name_en: "Eggs",            name_lb: "Eeër",            icon: "🥚" },
  { id: 4,  name_fr: "Poissons",       name_en: "Fish",            name_lb: "Fësch",           icon: "🐟" },
  { id: 5,  name_fr: "Arachides",      name_en: "Peanuts",         name_lb: "Äerdnëss",        icon: "🥜" },
  { id: 6,  name_fr: "Soja",           name_en: "Soy",             name_lb: "Soja",            icon: "🫘" },
  { id: 7,  name_fr: "Lait",           name_en: "Milk",            name_lb: "Mëllech",         icon: "🥛" },
  { id: 8,  name_fr: "Fruits à coque", name_en: "Tree nuts",       name_lb: "Nëss",            icon: "🌰" },
  { id: 9,  name_fr: "Céleri",         name_en: "Celery",          name_lb: "Zelleri",         icon: "🥬" },
  { id: 10, name_fr: "Moutarde",       name_en: "Mustard",         name_lb: "Moschter",        icon: "🟡" },
  { id: 11, name_fr: "Sésame",         name_en: "Sesame",          name_lb: "Sesam",           icon: "⚪" },
  { id: 12, name_fr: "Sulfites",       name_en: "Sulphites",       name_lb: "Sulfiten",        icon: "🍷" },
  { id: 13, name_fr: "Lupin",          name_en: "Lupin",           name_lb: "Lupin",           icon: "🌿" },
  { id: 14, name_fr: "Mollusques",     name_en: "Molluscs",        name_lb: "Weechdéieren",    icon: "🦑" },
];

// ─── CSV Parsing Helpers ───

function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function readCsv(relativePath: string, delimiter: string, encoding: BufferEncoding = "utf-8"): string[][] {
  const fullPath = resolve(__dirname, "..", relativePath);
  const raw = readFileSync(fullPath, encoding);
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  // Skip header
  return lines.slice(1).map((l) => parseCsvLine(l, delimiter));
}

// ─── Seed Dishes ───

async function seedDishes() {
  const rows = readCsv("public/dishes-raw/Millewee dishes.csv", ",");

  // Dish category translations (FR is the source of truth from CSV)
  const DISH_CATEGORY_I18N: Record<string, { en: string; lb: string }> = {
    "Salades & Planches": { en: "Salads & Platters",     lb: "Zaloten & Platten" },
    "Pâtes":              { en: "Pasta",                  lb: "Pasta" },
    "Viandes":            { en: "Meat",                   lb: "Fleesch" },
    "Sauces":             { en: "Sauces",                 lb: "Saucen" },
    "Poissons":           { en: "Fish",                   lb: "Fësch" },
    "Burgers":            { en: "Burgers",                lb: "Burgeren" },
    "Snacks":             { en: "Snacks",                 lb: "Snacken" },
    "Desserts":           { en: "Desserts",               lb: "Desserten" },
  };

  // Collect unique categories (preserving order)
  const categoryNames: string[] = [];
  for (const row of rows) {
    const cat = row[0];
    if (cat && !categoryNames.includes(cat)) categoryNames.push(cat);
  }

  // Upsert categories
  const categoryMap = new Map<string, number>();
  for (let i = 0; i < categoryNames.length; i++) {
    const i18n = DISH_CATEGORY_I18N[categoryNames[i]];
    const cat = await prisma.category.create({
      data: {
        name_fr: categoryNames[i],
        name_en: i18n?.en ?? null,
        name_lb: i18n?.lb ?? null,
        type: "dishes",
        sort_order: i + 1,
      },
    });
    categoryMap.set(categoryNames[i], cat.id);
  }
  console.log(`  ✓ ${categoryMap.size} dish categories created`);

  // Group rows: detect dishes with variants (Pizza di Pinsa = repeated name, different ingredients)
  // Also detect Flammenkuechen (variants in the Ingrédients column as comma-separated list)
  let dishCount = 0;
  let variantCount = 0;
  let allergenLinkCount = 0;

  // Group consecutive rows with same name in same category as variants
  type DishRow = { category: string; name: string; ingredients: string; allergens: string; price: string };
  const dishRows: DishRow[] = rows
    .filter((r) => r[0]) // skip empty rows
    .map((r) => ({ category: r[0], name: r[1], ingredients: r[2], allergens: r[3], price: r[4] }));

  // Group by category+name to detect variants
  const grouped = new Map<string, DishRow[]>();
  for (const row of dishRows) {
    const key = `${row.category}|||${row.name}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  for (const [key, rows] of grouped) {
    const [categoryName, dishName] = key.split("|||");
    const categoryId = categoryMap.get(categoryName)!;
    const firstRow = rows[0];

    const hasVariants = rows.length > 1;
    const price = parseFloat(firstRow.price.replace(",", "."));

    // Parse allergen codes from first row (all variants share same base allergens)
    const allergenCodes = parseAllergenCodes(firstRow.allergens);

    const dish = await prisma.dish.create({
      data: {
        name_fr: dishName,
        price_eur: price,
        description_fr: hasVariants ? null : (firstRow.ingredients !== "-" ? firstRow.ingredients : null),
        has_variants: hasVariants,
        is_available: true,
        sort_order: dishCount + 1,
      },
    });
    dishCount++;

    // Link to category
    await prisma.categories_dishes.create({
      data: { category_id: categoryId, dish_id: dish.dish_id },
    });

    // Link allergens
    for (const code of allergenCodes) {
      await prisma.dish_allergen.create({
        data: { dish_id: dish.dish_id, allergen_id: code },
      });
      allergenLinkCount++;
    }

    // Create variants if multi-row
    if (hasVariants) {
      for (let vi = 0; vi < rows.length; vi++) {
        const vRow = rows[vi];
        const vPrice = parseFloat(vRow.price.replace(",", "."));
        // Variant name = the ingredient/detail column, or if empty, build from row
        const vName = vRow.ingredients && vRow.ingredients !== "-" ? vRow.ingredients : `Variante ${vi + 1}`;
        await prisma.dish_variant.create({
          data: {
            dish_id: dish.dish_id,
            name_fr: vName,
            price_eur: vPrice !== price ? vPrice : null, // null = same as parent
            sort_order: vi + 1,
          },
        });
        variantCount++;
      }
    }
  }

  console.log(`  ✓ ${dishCount} dishes created (${variantCount} variants, ${allergenLinkCount} allergen links)`);
}

function parseAllergenCodes(raw: string): number[] {
  if (!raw || raw === "-") return [];
  return raw
    .replace(/"/g, "")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 1 && n <= 14);
}

// ─── Seed Drinks ───

async function seedDrinks() {
  // Latin-1 encoded, semicolon-delimited
  const rows = readCsv("public/dishes-raw/millewee boissons.csv", ";", "latin1");

  // Drink category translations
  const DRINK_CATEGORY_I18N: Record<string, { en: string; lb: string }> = {
    "Softs":              { en: "Soft Drinks",            lb: "Softdrinks" },
    "Boissons Chaudes":   { en: "Hot Drinks",             lb: "Waarm Gedrénks" },
    "Apéritifs":          { en: "Aperitifs",              lb: "Aperitiven" },
    "Digestifs":          { en: "Digestifs",              lb: "Digestiffen" },
    "Bières":             { en: "Beers",                  lb: "Béieren" },
    "Bières Sans Alcool": { en: "Non-Alcoholic Beers",   lb: "Alkoholfräi Béieren" },
    "Vins Maison":        { en: "House Wines",            lb: "Hauswäin" },
    "Vins Blancs":        { en: "White Wines",            lb: "Wäisswäin" },
    "Vins Rosés":         { en: "Rosé Wines",             lb: "Roséwäin" },
    "Vins Rouges":        { en: "Red Wines",              lb: "Roudwäin" },
    "Bulles":             { en: "Sparkling",              lb: "Schaumwäin" },
  };

  // Columns: Catégorie, Nom, Détails, Format, Prix (€), Description
  // Collect unique categories
  const categoryNames: string[] = [];
  for (const row of rows) {
    const cat = row[0];
    if (cat && !categoryNames.includes(cat)) categoryNames.push(cat);
  }

  // Get current max category sort_order (dish categories already seeded)
  const maxCat = await prisma.category.findFirst({ orderBy: { sort_order: "desc" } });
  const sortBase = (maxCat?.sort_order ?? 0) + 1;

  const categoryMap = new Map<string, number>();
  for (let i = 0; i < categoryNames.length; i++) {
    const i18n = DRINK_CATEGORY_I18N[categoryNames[i]];
    const cat = await prisma.category.create({
      data: {
        name_fr: categoryNames[i],
        name_en: i18n?.en ?? null,
        name_lb: i18n?.lb ?? null,
        type: "drinks",
        sort_order: sortBase + i,
      },
    });
    categoryMap.set(categoryNames[i], cat.id);
  }
  console.log(`  ✓ ${categoryMap.size} drink categories created`);

  let drinkCount = 0;
  let sizeCount = 0;
  let selectionCount = 0;

  for (const row of rows) {
    const [categoryName, name, details, format, priceStr, description] = row;
    if (!categoryName || !name) continue;

    const categoryId = categoryMap.get(categoryName)!;

    // Determine selection mode:
    // - If Détails has " / " separated values AND no Format → selections (e.g., Soda: Cola / Cola Zero)
    // - If Détails has " ou " → selections (e.g., Fuze Tea: Pêche ou Mangue)
    // - If Format has " / " → multiple sizes
    const hasMultipleSizes = !!format && format.includes("/");
    const hasSelections = !!details && details !== "-" && (details.includes(" / ") || details.includes(" ou "));

    // Determine selection_mode
    let selectionMode: string | null = null;
    if (hasSelections && !hasMultipleSizes) selectionMode = "selection";
    else if (hasSelections && hasMultipleSizes) selectionMode = "variant";

    const drink = await prisma.drink.create({
      data: {
        name_fr: name.replace(/\s*\/\s*$/, "").trim(), // clean trailing slash (Cappuccino /)
        description_fr: description || null,
        selection_mode: selectionMode,
      },
    });
    drinkCount++;

    // Link to category
    await prisma.categories_drinks.create({
      data: { category_id: categoryId, drink_id: drink.drink_id },
    });

    // Parse sizes and prices
    const prices = priceStr ? priceStr.split("/").map((p) => p.trim()) : [];
    const sizes = format ? format.split("/").map((s) => s.trim()) : [];

    if (sizes.length > 0 && prices.length === sizes.length) {
      // Multiple sizes with corresponding prices
      for (let si = 0; si < sizes.length; si++) {
        const p = parseFloat(prices[si].replace(",", "."));
        if (!isNaN(p)) {
          await prisma.drink_size.create({
            data: { drink_id: drink.drink_id, size: sizes[si], price_eur: p },
          });
          sizeCount++;
        }
      }
    } else if (prices.length === 1 || (prices.length === 0 && priceStr)) {
      // Single price, standard size
      const p = parseFloat((prices[0] || priceStr).replace(",", "."));
      if (!isNaN(p)) {
        await prisma.drink_size.create({
          data: { drink_id: drink.drink_id, size: "standard", price_eur: p },
        });
        sizeCount++;
      }
    }

    // Parse selections from Détails
    if (hasSelections) {
      const selItems = details.split(/\s*(?:\/|ou)\s*/).filter(Boolean);
      for (let si = 0; si < selItems.length; si++) {
        await prisma.drink_selection.create({
          data: {
            drink_id: drink.drink_id,
            name_fr: selItems[si].trim(),
            sort_order: si + 1,
          },
        });
        selectionCount++;
      }
    }
  }

  console.log(`  ✓ ${drinkCount} drinks created (${sizeCount} sizes, ${selectionCount} selections)`);
}

// ─── Seed Restaurant Tables ───

async function seedTables() {
  const fullPath = resolve(__dirname, "qrcodes", "milleweetables.csv");
  const raw = readFileSync(fullPath, "utf-8");
  const tableNumbers = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => parseInt(l, 10))
    .filter((n) => !isNaN(n));

  let count = 0;
  for (const num of tableNumbers) {
    const location = num >= 21 && num <= 47 ? "terrasse" : "intérieur";
    await prisma.restaurant_table.create({
      data: { table_number: num, location },
    });
    count++;
  }
  console.log(`  ✓ ${count} restaurant tables created`);
}

// ─── Main ───

async function main() {
  console.log("Seeding millewee database...\n");

  // Clear existing data (in dependency order)
  console.log("Clearing existing data...");
  await prisma.dish_allergen.deleteMany();
  await prisma.dish_variant.deleteMany();
  await prisma.categories_dishes.deleteMany();
  await prisma.categories_drinks.deleteMany();
  await prisma.drink_selection.deleteMany();
  await prisma.drink_size.deleteMany();
  await prisma.weekly_special.deleteMany();
  await prisma.item_association.deleteMany();
  await prisma.customer_preference.deleteMany();
  await prisma.dish.deleteMany();
  await prisma.drink.deleteMany();
  await prisma.category.deleteMany();
  await prisma.allergen.deleteMany();
  await prisma.restaurant_table.deleteMany();

  // Reset auto-increment sequences so IDs start from 1
  await prisma.$executeRaw`ALTER SEQUENCE category_id_seq RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE dish_dish_id_seq RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE dish_variant_id_seq RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE drink_drink_id_seq RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE drink_selection_id_seq RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE item_association_id_seq RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE customer_preference_id_seq RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE weekly_special_id_seq RESTART WITH 1`;
  await prisma.$executeRaw`ALTER SEQUENCE live_event_id_seq RESTART WITH 1`;
  console.log("  ✓ Cleared + sequences reset\n");

  // Seed allergens first (referenced by dishes)
  console.log("Seeding allergens...");
  for (const a of EU_ALLERGENS) {
    await prisma.allergen.create({ data: a });
  }
  console.log(`  ✓ ${EU_ALLERGENS.length} EU allergens created\n`);

  console.log("Seeding dishes...");
  await seedDishes();
  console.log();

  console.log("Seeding drinks...");
  await seedDrinks();
  console.log();

  console.log("Seeding restaurant tables...");
  await seedTables();
  console.log();

  console.log("✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
