/**
 * Artisanal image-optimization pipeline (Phase 6 groundwork).
 *
 * Workflow per run:
 *   1. List `public/images-raw/` entries (jpg/jpeg/png).
 *   2. Sort by mtime, NEWEST first.
 *   3. For each entry, in that order:
 *        - If a file with the SAME (raw) filename already exists in
 *          `public/images-backup/` → STOP the loop. We've reached the boundary
 *          of a previous run.
 *        - Otherwise: optimize to WebP in `public/images/`, then atomically
 *          rename the raw file into `public/images-backup/`.
 *   4. Write a manifest at `public/images-backup/processed-<ISO>.json`
 *      listing what was just processed. The Phase-6 AI step will consume the
 *      most recent manifest to map filenames → dish_ids.
 *
 * Invariant maintained: a raw file in `images-backup/` ⇔ already processed.
 * Re-shoot quirk (accepted): dropping a same-named replacement in `images-raw/`
 * gets skipped. To force a re-shoot, delete it from `images-backup/` first.
 *
 * Filenames are normalized to ASCII (saladeCésar.jpg → saladeCesar.webp) to
 * avoid %C3%A9-style URL encoding.
 *
 * Usage:
 *   npx tsx scripts/optimize-images.ts             # process new drops
 *   npx tsx scripts/optimize-images.ts --dry-run   # preview only, no writes
 *   npx tsx scripts/optimize-images.ts --force     # ignore backup boundary;
 *                                                    re-optimize and overwrite.
 */

import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const CONFIG = {
  inputDir: path.join(__dirname, '../public/images-raw'),
  outputDir: path.join(__dirname, '../public/images'),
  backupDir: path.join(__dirname, '../public/images-backup'),
  maxWidth: 800,
  maxHeight: 600,
  quality: 75,
  skipThreshold: 150 * 1024,
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const HELP = args.includes('--help') || args.includes('-h');

if (HELP) {
  console.log(`
Artisanal image optimizer (millewee)

Usage:
  npx tsx scripts/optimize-images.ts [--dry-run] [--force]

Options:
  --dry-run   Preview only — no files written, no raw files moved.
  --force     Ignore the images-backup/ boundary check; re-process every
              image in images-raw/ and overwrite outputs + backup entries.
`);
  process.exit(0);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/** Strip diacritics (é → e) and swap extension to .webp. */
function normalizeOutputName(filename: string): string {
  // NFD splits "é" into "e" + U+0301 (combining acute). The regex strips the
  // combining marks block (U+0300–U+036F), leaving plain ASCII.
  const ascii = filename.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return ascii.replace(/\.(jpg|jpeg|png)$/i, '.webp');
}

interface ProcessedEntry {
  rawFilename: string;
  optimizedFilename: string;
  optimizedPath: string;       // root-relative URL: /images/foo.webp
  rawSizeBytes: number;
  optimizedSizeBytes: number;
  rawMtimeISO: string;
  processedAtISO: string;
}

async function main() {
  console.warn('\nMillewee artisanal image pipeline');
  console.warn(`Raw:     ${CONFIG.inputDir}`);
  console.warn(`Output:  ${CONFIG.outputDir}`);
  console.warn(`Backup:  ${CONFIG.backupDir}`);
  if (DRY_RUN) console.warn('DRY RUN — no files will be written or moved');
  if (FORCE) console.warn('FORCE — backup boundary check disabled');

  if (!fs.existsSync(CONFIG.inputDir)) {
    console.error(`\nimages-raw/ not found: ${CONFIG.inputDir}`);
    process.exit(1);
  }
  if (!DRY_RUN) {
    if (!fs.existsSync(CONFIG.outputDir)) fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    if (!fs.existsSync(CONFIG.backupDir)) fs.mkdirSync(CONFIG.backupDir, { recursive: true });
  }

  // List candidate images, newest first.
  const entries = fs.readdirSync(CONFIG.inputDir)
    .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
    .map((f) => {
      const stats = fs.statSync(path.join(CONFIG.inputDir, f));
      return { file: f, mtimeMs: stats.mtimeMs, size: stats.size };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (entries.length === 0) {
    console.warn('\nNothing to do — images-raw/ is empty.');
    return;
  }

  console.warn(`\nFound ${entries.length} candidate(s) in images-raw/. Processing newest-first…\n`);

  const processed: ProcessedEntry[] = [];
  let totalIn = 0;
  let totalOut = 0;
  let stoppedAt: string | null = null;

  for (let i = 0; i < entries.length; i++) {
    const { file, mtimeMs, size } = entries[i];
    const rawPath = path.join(CONFIG.inputDir, file);
    const backupPath = path.join(CONFIG.backupDir, file);
    const outName = normalizeOutputName(file);
    const outPath = path.join(CONFIG.outputDir, outName);

    // Stop condition: same filename already in backup → boundary of prior run.
    if (!FORCE && fs.existsSync(backupPath)) {
      stoppedAt = file;
      console.warn(`[${i + 1}/${entries.length}] ${file}: already in images-backup/ — stopping.`);
      break;
    }

    if (size < CONFIG.skipThreshold) {
      console.warn(`[${i + 1}/${entries.length}] ${file}: skipped (already small, ${formatBytes(size)})`);
      continue;
    }

    try {
      const image = sharp(rawPath);
      const metadata = await image.metadata();
      const needsResize =
        (metadata.width ?? 0) > CONFIG.maxWidth || (metadata.height ?? 0) > CONFIG.maxHeight;
      if (needsResize) {
        image.resize(CONFIG.maxWidth, CONFIG.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      let outSize: number;
      if (DRY_RUN) {
        outSize = Math.round(size * 0.22); // typical WebP@q75 ratio
      } else {
        await image.webp({ quality: CONFIG.quality }).toFile(outPath);
        outSize = fs.statSync(outPath).size;
        // Optimize succeeded — move raw → backup. rename is atomic on same FS.
        fs.renameSync(rawPath, backupPath);
      }

      const savings = ((1 - outSize / size) * 100).toFixed(1);
      const tag = DRY_RUN ? '(preview)' : '';
      console.warn(
        `[${i + 1}/${entries.length}] ${file} -> ${outName}: ${formatBytes(size)} -> ${formatBytes(outSize)} (${savings}% smaller) ${tag}`,
      );

      processed.push({
        rawFilename: file,
        optimizedFilename: outName,
        optimizedPath: `/images/${outName}`,
        rawSizeBytes: size,
        optimizedSizeBytes: outSize,
        rawMtimeISO: new Date(mtimeMs).toISOString(),
        processedAtISO: new Date().toISOString(),
      });
      totalIn += size;
      totalOut += outSize;
    } catch (err) {
      console.error(`[${i + 1}/${entries.length}] ${file}: ERROR — ${(err as Error).message}`);
      // Don't move raw on failure — leave it for the next run to retry.
    }
  }

  // Summary
  console.warn('\n' + '='.repeat(60));
  console.warn(`Processed:    ${processed.length}`);
  if (stoppedAt) console.warn(`Stopped at:   ${stoppedAt} (already in backup — prior-run boundary)`);
  if (totalIn > 0) {
    console.warn(`Input total:  ${formatBytes(totalIn)}`);
    console.warn(`Output total: ${formatBytes(totalOut)}`);
    console.warn(`Reduction:    ${((1 - totalOut / totalIn) * 100).toFixed(1)}%`);
  }

  // Write manifest (Phase-6 input for the AI mapping step).
  if (!DRY_RUN && processed.length > 0) {
    const manifestName = `processed-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const manifestPath = path.join(CONFIG.backupDir, manifestName);
    fs.writeFileSync(
      manifestPath,
      JSON.stringify({ runAtISO: new Date().toISOString(), processed }, null, 2),
      'utf8',
    );
    console.warn(`\nManifest:     ${manifestPath}`);
  }

  if (DRY_RUN) {
    console.warn('\nDry run complete. Re-run without --dry-run to apply.');
  } else {
    console.warn('\nDone.');
  }
}

main().catch((err) => {
  console.error('\nFatal:', err);
  process.exit(1);
});
