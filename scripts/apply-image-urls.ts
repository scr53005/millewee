/**
 * Apply image_url assignments from scripts/image-mappings.json to the DB.
 *
 * Mapping file shape:
 * {
 *   "dishes":      [{ "dish_id": 3, "filename": "saladeCesar.webp", "_label": "..." }, ...],
 *   "drink_sizes": [{ "drink_id": 36, "size": "Verre", "filename": "...", "_label": "..." }, ...]
 * }
 *
 * Each row gets `image_url = '/images/<filename>'`. The `_label` is purely a
 * human hint for whoever edits the JSON — it is not written to the DB.
 *
 * Phase-6 alignment: this is the persistence step that the AI mapping pipeline
 * will eventually drive. For now, the JSON is hand-curated — but the script
 * stays the same when AI populates it.
 *
 * Runs against whichever DB POSTGRES_URL points to in .env.local.
 *
 * Usage:
 *   npx tsx scripts/apply-image-urls.ts --dry-run   # show planned UPDATEs
 *   npx tsx scripts/apply-image-urls.ts             # apply
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('POSTGRES_URL not set in .env.local');
  process.exit(1);
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const mappingPath = path.join(__dirname, 'image-mappings.json');

interface DishMapping {
  dish_id: number;
  filename: string;
  _label?: string;
}
interface DrinkSizeMapping {
  drink_id: number;
  size: string;
  filename: string;
  _label?: string;
}
interface MappingFile {
  dishes?: DishMapping[];
  drink_sizes?: DrinkSizeMapping[];
}

if (!fs.existsSync(mappingPath)) {
  console.error(`Mapping file not found: ${mappingPath}`);
  process.exit(1);
}

const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8')) as MappingFile;
const dishMappings = mapping.dishes ?? [];
const drinkSizeMappings = mapping.drink_sizes ?? [];

if (dishMappings.length === 0 && drinkSizeMappings.length === 0) {
  console.warn('No mappings found in image-mappings.json — nothing to do.');
  process.exit(0);
}

function urlFor(filename: string): string {
  return `/images/${filename}`;
}

async function main() {
  console.warn('\nApply image_url assignments');
  console.warn(`Mapping:  ${mappingPath}`);
  console.warn(`Dishes:   ${dishMappings.length}`);
  console.warn(`Drink sizes: ${drinkSizeMappings.length}`);
  if (DRY_RUN) console.warn('DRY RUN — no DB writes\n');
  else console.warn('');

  const adapter = new PrismaPg({ connectionString: connectionString! });
  const prisma = new PrismaClient({ adapter });

  try {
    let dishesUpdated = 0;
    let drinkSizesUpdated = 0;

    for (const m of dishMappings) {
      const newUrl = urlFor(m.filename);
      const label = m._label ? ` [${m._label}]` : '';
      console.warn(`  dish #${m.dish_id}${label} -> ${newUrl}`);
      if (!DRY_RUN) {
        await prisma.dish.update({
          where: { dish_id: m.dish_id },
          data: { image_url: newUrl },
        });
        dishesUpdated++;
      }
    }

    for (const m of drinkSizeMappings) {
      const newUrl = urlFor(m.filename);
      const label = m._label ? ` [${m._label}]` : '';
      console.warn(`  drink_size (drink_id=${m.drink_id}, size='${m.size}')${label} -> ${newUrl}`);
      if (!DRY_RUN) {
        await prisma.drink_size.update({
          where: { drink_id_size: { drink_id: m.drink_id, size: m.size } },
          data: { image_url: newUrl },
        });
        drinkSizesUpdated++;
      }
    }

    console.warn('\n' + '='.repeat(60));
    if (DRY_RUN) {
      console.warn('Dry run complete — no rows changed.');
    } else {
      console.warn(`Dishes updated:      ${dishesUpdated}`);
      console.warn(`Drink sizes updated: ${drinkSizesUpdated}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\nFailed:', err);
  process.exit(1);
});
