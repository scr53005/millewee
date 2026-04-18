/**
 * Diagnostic: list every drink that has zero `drink_size` rows.
 *
 * Such drinks are invisible on the customer menu because both
 *   - the /api/menu/drinks route filters them out (`drinks.filter(d => d.sizes.length > 0)`)
 *   - and DrinksSection hides any category whose surviving drink count is zero.
 * They still appear on the admin drinks page (with "—" in the price column).
 *
 * This script prints, per drink category, the drinks with zero sizes so you can
 * fix them via the admin UI or via a dedicated data-repair script.
 *
 * Usage:
 *   npx tsx scripts/list-drinks-without-sizes.ts
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

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: connectionString! }),
  });

  try {
    const drinks = await prisma.drink.findMany({
      include: {
        sizes: true,
        categories: { include: { category: true } },
      },
      orderBy: { name_fr: 'asc' },
    });

    const sizeless = drinks.filter((d) => d.sizes.length === 0);
    const totalDrinks = drinks.length;

    console.log(`Total drinks: ${totalDrinks}`);
    console.log(`Drinks with zero sizes (invisible on customer menu): ${sizeless.length}`);
    console.log('');

    // Group by category for readability
    const byCategoryName = new Map<string, string[]>();
    for (const d of sizeless) {
      const catName = d.categories[0]?.category.name_fr ?? '(no category)';
      const arr = byCategoryName.get(catName) ?? [];
      arr.push(`  - [${d.drink_id}] ${d.name_fr}`);
      byCategoryName.set(catName, arr);
    }

    const sortedCats = Array.from(byCategoryName.keys()).sort();
    for (const cat of sortedCats) {
      console.log(`Category: ${cat}`);
      for (const line of byCategoryName.get(cat)!) console.log(line);
      console.log('');
    }

    if (sizeless.length === 0) {
      console.log('✓ All drinks have at least one size — nothing to fix.');
    } else {
      console.log(
        `→ Fix: add at least one drink_size (size + price_eur) via the admin UI (/admin/drinks)`,
      );
      console.log(
        `  or write a data-repair script. The customer menu will then include them.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
