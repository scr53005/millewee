/** Optional HTML snapshots from the real component test, without a Next/Vite build.
 * Set MINIWALLET_PREVIEW to an absolute HTML path before running npm test.
 */
import { writeFileSync } from 'node:fs';

export function exportMiniWalletPreview(collapsed: string, expanded: string): void {
  const path = process.env.MINIWALLET_PREVIEW;
  if (!path) return;
  writeFileSync(path, `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MiniWallet — compact layout</title>
  <style>
    * { box-sizing: border-box; } body { margin: 0; padding: 32px 20px; font-family: Arial, sans-serif; background: #f1f5f9; color: #334155; }
    h1 { font-size: 18px; margin: 0 0 8px; } p { margin: 0; } [hidden] { display: none !important; }
    .previews { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 30px; margin-top: 24px; }
    .preview { width: 280px; } h2 { font-size: 12px; font-weight: 500; margin: 0 0 12px; color: #64748b; }
    .preview > .innopay-miniwallet { position: relative !important; left: auto !important; top: auto !important; background: linear-gradient(to right, #2563eb, #1d4ed8); font-family: Arial, sans-serif; }
    .font-mono { font-family: ui-monospace, monospace; } .italic { font-style: italic; }
    .text-blue-200 { color: #bfdbfe; } .text-white { color: #fff; }
  </style>
  <h1>MiniWallet</h1><p style="font-size:12px">Actual component markup · compact spacing · French</p>
  <div class="previews"><section class="preview"><h2>Collapsed</h2>${collapsed}</section><section class="preview"><h2>Expanded</h2>${expanded}</section></div>
  </html>`, 'utf8');
}
