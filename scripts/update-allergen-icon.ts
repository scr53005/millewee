/**
 * Update an allergen's icon emoji in the database.
 *
 * Usage:
 *   npx tsx scripts/update-allergen-icon.ts <allergen_id> <new_icon>
 *
 * Example:
 *   npx tsx scripts/update-allergen-icon.ts 6 🌱
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

const [, , idArg, iconArg] = process.argv;

if (!idArg || !iconArg) {
  console.error('Usage: npx tsx scripts/update-allergen-icon.ts <allergen_id> <new_icon>');
  console.error('Example: npx tsx scripts/update-allergen-icon.ts 6 🌱');
  process.exit(1);
}

const allergenId = parseInt(idArg);
if (isNaN(allergenId)) {
  console.error(`Invalid allergen_id: ${idArg}`);
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: connectionString! }),
  });

  try {
    // Show current state
    const before = await prisma.allergen.findUnique({ where: { id: allergenId } });
    if (!before) {
      console.error(`Allergen ${allergenId} not found`);
      process.exit(1);
    }
    console.log(`Before: [${before.id}] ${before.icon} ${before.name_fr}`);

    // Update
    const after = await prisma.allergen.update({
      where: { id: allergenId },
      data: { icon: iconArg },
    });
    console.log(`After:  [${after.id}] ${after.icon} ${after.name_fr}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
