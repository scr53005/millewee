/**
 * Check the row count of the legacy `transfer` (singular) table.
 *
 * The singular `transfer` model was unused scaffolding; we're replacing it with
 * the plural `transfers` model. Before running `prisma db push` (which will DROP
 * the old table), confirm it's empty.
 *
 * Usage:
 *   npx tsx scripts/check-transfer-table.ts
 *
 * Runs against whichever DB POSTGRES_URL points to in .env.local.
 * Safe to run repeatedly (read-only).
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
    // Pretty-print which DB we're connected to (host portion of the URL)
    const host = new URL(connectionString!).host;
    console.log(`Connected to: ${host}`);

    // Raw query — `transfer` is no longer in schema.prisma, so prisma.transfer doesn't exist
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'transfer'
      ) AS exists
    `;

    if (!result[0]?.exists) {
      console.log('Table `transfer` does not exist in this database. Nothing to check.');
      return;
    }

    const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "transfer"
    `;
    const count = Number(countResult[0].count);

    console.log(`Table \`transfer\` row count: ${count}`);
    if (count === 0) {
      console.log('✓ Safe to drop — no rows to lose.');
    } else {
      console.log('✗ NOT safe to drop — investigate before running db push.');
      process.exit(2);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
