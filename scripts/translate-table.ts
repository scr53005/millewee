/**
 * Translate missing language columns in any table
 *
 * Scans a table for _fr, _en, _lb column groups. For each row, finds
 * which language(s) have data and translates into the missing ones
 * using the Claude API.
 *
 * Usage:  npx tsx scripts/translate-table.ts <table_name> [--dry-run]
 *
 * Examples:
 *   npx tsx scripts/translate-table.ts category
 *   npx tsx scripts/translate-table.ts dish --dry-run
 *   npx tsx scripts/translate-table.ts allergen
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import Anthropic from "@anthropic-ai/sdk";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.POSTGRES_URL! }),
});

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// ─── Language config ───

const LANG_SUFFIXES = ["_fr", "_en", "_lb"] as const;
type LangSuffix = (typeof LANG_SUFFIXES)[number];

const LANG_NAMES: Record<LangSuffix, string> = {
  _fr: "French",
  _en: "English",
  _lb: "Luxembourgish",
};

// ─── Discover translatable column groups ───

function findLangGroups(columns: string[]): Map<string, Set<LangSuffix>> {
  const groups = new Map<string, Set<LangSuffix>>();

  for (const col of columns) {
    for (const suffix of LANG_SUFFIXES) {
      if (col.endsWith(suffix)) {
        const base = col.slice(0, -suffix.length);
        if (!groups.has(base)) groups.set(base, new Set());
        groups.get(base)!.add(suffix);
      }
    }
  }

  // Only keep groups that have all 3 language columns
  for (const [base, suffixes] of groups) {
    if (suffixes.size < 3) groups.delete(base);
  }

  return groups;
}

// ─── Batch translate via Claude ───

interface TranslationRequest {
  field: string;
  sourceText: string;
  sourceLang: string;
  targetLangs: { suffix: LangSuffix; name: string }[];
}

const BATCH_SIZE = 25; // items per API call to avoid output truncation

async function translateChunk(
  requests: TranslationRequest[],
  tableName: string,
  chunkIndex: number,
  totalChunks: number
): Promise<Map<string, Record<LangSuffix, string>>> {
  const items = requests.map((r, i) => {
    const targets = r.targetLangs.map((t) => t.name).join(" and ");
    return `${i + 1}. "${r.sourceText}" (${r.sourceLang} → ${targets}) [field: ${r.field}]`;
  });

  console.log(`  Chunk ${chunkIndex + 1}/${totalChunks} (${requests.length} items)...`);

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are translating restaurant menu data for a Luxembourg brasserie called "Millewee".
Table: ${tableName}

Translate each item below. Return ONLY a JSON array where each element is an object with "index" (1-based), and for each target language a key like "en" or "lb" or "fr" with the translation. Keep translations natural and concise — these are menu category/item names, not sentences. For Luxembourgish, use standard Lëtzebuergesch spelling.

Items to translate:
${items.join("\n")}

Return ONLY the JSON array, no markdown fences, no explanation.`,
      },
    ],
  });

  let text = (message.content[0] as { type: "text"; text: string }).text.trim();
  // Strip markdown fences if present
  text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  const parsed = JSON.parse(text) as Array<Record<string, string | number>>;

  // Log token usage
  console.log(`    → input: ${message.usage.input_tokens} tokens, output: ${message.usage.output_tokens} tokens`);

  const results = new Map<string, Record<LangSuffix, string>>();

  for (const entry of parsed) {
    const idx = (entry.index as number) - 1;
    const req = requests[idx];
    if (!req) continue;

    const translations: Partial<Record<LangSuffix, string>> = {};
    for (const target of req.targetLangs) {
      const langKey = target.suffix.replace("_", ""); // _en → en
      const value = entry[langKey] as string;
      if (value) translations[target.suffix] = value;
    }
    results.set(req.field, translations as Record<LangSuffix, string>);
  }

  return results;
}

async function batchTranslate(
  requests: TranslationRequest[],
  tableName: string
): Promise<Map<string, Record<LangSuffix, string>>> {
  if (requests.length === 0) return new Map();

  const allResults = new Map<string, Record<LangSuffix, string>>();
  const totalChunks = Math.ceil(requests.length / BATCH_SIZE);

  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const chunk = requests.slice(i, i + BATCH_SIZE);
    const chunkResults = await translateChunk(chunk, tableName, Math.floor(i / BATCH_SIZE), totalChunks);
    for (const [key, value] of chunkResults) {
      allResults.set(key, value);
    }
  }

  return allResults;
}

// ─── Main ───

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const tableName = args.find((a) => !a.startsWith("--"));

  if (!tableName) {
    console.error("Usage: npx tsx scripts/translate-table.ts <table_name> [--dry-run]");
    process.exit(1);
  }

  // Get column names from information_schema
  const columns: { column_name: string }[] = await prisma.$queryRaw`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
    ORDER BY ordinal_position
  `;

  if (columns.length === 0) {
    console.error(`Table "${tableName}" not found or has no columns.`);
    process.exit(1);
  }

  const colNames = columns.map((c) => c.column_name);
  console.log(`Table: ${tableName}`);
  console.log(`Columns: ${colNames.join(", ")}`);

  const langGroups = findLangGroups(colNames);
  if (langGroups.size === 0) {
    console.log("No translatable column groups (_fr/_en/_lb) found.");
    process.exit(0);
  }

  console.log(`Language groups: ${[...langGroups.keys()].map((b) => `${b}_{fr,en,lb}`).join(", ")}`);

  // Detect primary key column
  const pkResult: { column_name: string }[] = await prisma.$queryRaw`
    SELECT a.attname as column_name
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = ${tableName}::regclass AND i.indisprimary
  `;
  const pkCol = pkResult[0]?.column_name;
  if (!pkCol) {
    console.error(`Could not detect primary key for table "${tableName}".`);
    process.exit(1);
  }
  console.log(`Primary key: ${pkCol}\n`);

  // Fetch all rows
  const rows: Record<string, unknown>[] =
    await prisma.$queryRawUnsafe(`SELECT * FROM "${tableName}" ORDER BY "${pkCol}"`);

  console.log(`${rows.length} rows found.\n`);

  // Build translation requests
  const translationRequests: TranslationRequest[] = [];
  // Track which row+field needs which translations
  const rowUpdates: {
    pkValue: unknown;
    field: string;
    targetCols: { column: string; suffix: LangSuffix }[];
  }[] = [];

  for (const row of rows) {
    const pk = row[pkCol];

    for (const [base, suffixes] of langGroups) {
      // Find which language has data
      let sourceSuffix: LangSuffix | null = null;
      let sourceText: string | null = null;

      for (const suffix of LANG_SUFFIXES) {
        const val = row[`${base}${suffix}`];
        if (val && typeof val === "string" && val.trim()) {
          if (!sourceSuffix) {
            sourceSuffix = suffix;
            sourceText = val.trim();
          }
        }
      }

      if (!sourceSuffix || !sourceText) continue;

      // Find missing languages
      const missingLangs: { suffix: LangSuffix; name: string }[] = [];
      const missingCols: { column: string; suffix: LangSuffix }[] = [];

      for (const suffix of LANG_SUFFIXES) {
        if (suffix === sourceSuffix) continue;
        const val = row[`${base}${suffix}`];
        if (!val || (typeof val === "string" && !val.trim())) {
          missingLangs.push({ suffix, name: LANG_NAMES[suffix] });
          missingCols.push({ column: `${base}${suffix}`, suffix });
        }
      }

      if (missingLangs.length === 0) continue;

      const requestKey = `${pk}::${base}`;
      translationRequests.push({
        field: requestKey,
        sourceText,
        sourceLang: LANG_NAMES[sourceSuffix],
        targetLangs: missingLangs,
      });

      rowUpdates.push({ pkValue: pk, field: requestKey, targetCols: missingCols });
    }
  }

  if (translationRequests.length === 0) {
    console.log("All language columns are already filled. Nothing to translate.");
    process.exit(0);
  }

  console.log(`${translationRequests.length} translation(s) needed.\n`);

  // Preview what will be translated
  for (const req of translationRequests) {
    const targets = req.targetLangs.map((t) => t.name).join(", ");
    console.log(`  "${req.sourceText}" (${req.sourceLang}) → ${targets}`);
  }
  console.log();

  // Call Claude API
  console.log("Calling Claude API (haiku)...");
  const translations = await batchTranslate(translationRequests, tableName);
  console.log(`Got ${translations.size} translation(s) back.\n`);

  // Apply updates
  let updateCount = 0;
  for (const update of rowUpdates) {
    const translated = translations.get(update.field);
    if (!translated) continue;

    for (const target of update.targetCols) {
      const value = translated[target.suffix];
      if (!value) continue;

      if (dryRun) {
        console.log(`  [DRY RUN] ${pkCol}=${update.pkValue} SET ${target.column} = "${value}"`);
      } else {
        await prisma.$executeRawUnsafe(
          `UPDATE "${tableName}" SET "${target.column}" = $1 WHERE "${pkCol}" = $2`,
          value,
          update.pkValue
        );
        console.log(`  ✓ ${pkCol}=${update.pkValue} SET ${target.column} = "${value}"`);
      }
      updateCount++;
    }
  }

  console.log(`\n${dryRun ? "[DRY RUN] " : ""}${updateCount} column(s) updated.`);
}

main()
  .catch((e) => {
    console.error("Translation failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
