/**
 * Upload a local file to Vercel Blob storage.
 *
 * Usage:
 *   npx tsx scripts/upload-to-blob.ts <local-file-path> [destination-path]
 *
 * Examples:
 *   npx tsx scripts/upload-to-blob.ts public/images/cheeseburger.mp4
 *   npx tsx scripts/upload-to-blob.ts public/images/cheeseburger.mp4 videos/dishes/cheeseburger.mp4
 *
 * If destination-path is omitted, the file is uploaded under "uploads/<filename>".
 *
 * Requires BLOB_READ_WRITE_TOKEN in .env.local (run `vercel env pull` after
 * creating the blob store in the Vercel dashboard).
 *
 * Idempotent: re-uploading the same destination-path with `addRandomSuffix: false`
 * overwrites the existing blob, so the public URL stays stable.
 */

import { put } from '@vercel/blob';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error('BLOB_READ_WRITE_TOKEN not set in .env.local');
  console.error('Run: vercel env pull .env.local');
  process.exit(1);
}

const [, , localPathArg, destPathArg] = process.argv;

if (!localPathArg) {
  console.error('Usage: npx tsx scripts/upload-to-blob.ts <local-file-path> [destination-path]');
  process.exit(1);
}

const localPath = path.resolve(localPathArg);
if (!fs.existsSync(localPath)) {
  console.error(`File not found: ${localPath}`);
  process.exit(1);
}

const destPath = destPathArg ?? `uploads/${path.basename(localPath)}`;

async function main() {
  const stats = fs.statSync(localPath);
  const sizeMb = (stats.size / 1024 / 1024).toFixed(2);

  console.warn(`Uploading ${localPath} (${sizeMb} MB) -> ${destPath}`);

  const fileBuffer = fs.readFileSync(localPath);

  const blob = await put(destPath, fileBuffer, {
    access: 'public',
    addRandomSuffix: false,
    token,
    allowOverwrite: true,
  });

  console.warn('Upload complete.');
  console.warn(`URL:        ${blob.url}`);
  console.warn(`Pathname:   ${blob.pathname}`);
  console.warn(`Size:       ${sizeMb} MB`);
}

main().catch((err) => {
  console.error('Upload failed:', err);
  process.exit(1);
});
