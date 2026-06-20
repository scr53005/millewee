/**
 * lib/innopay/table-validation.ts
 *
 * Pure, deterministic validation for a customer-entered table number against the
 * real set of tables (the `restaurant_table` model — see /api/tables). Kept free
 * of React/DOM so it is unit-testable and importable from vitest / tsx (no `@/`
 * alias, per CLAUDE.md).
 *
 * Canonical across spokes (SPOKE-DOCUMENTATION.md → "Customer-editable table
 * number"). Rules:
 *   - non-natural input (NaN, decimal, sign, <= 0)        → 'invalid'
 *   - empty `validTables` (DB unavailable / not loaded)   → 'valid' (fail-open;
 *       a backend hiccup must never lock a customer out of changing tables)
 *   - present in the set                                   → 'valid'
 *   - integer beyond the largest real table                → 'out-of-range'
 *   - integer inside [1, max] but missing (a gap)          → 'gap' + closest table
 */

export type TableValidation =
  | { status: 'valid'; table: number }
  | { status: 'invalid' }
  | { status: 'out-of-range'; max: number }
  | { status: 'gap'; suggestion: number };

export function validateTableNumber(input: string, validTables: number[]): TableValidation {
  const trimmed = input.trim();
  // Strict natural-number parse: ASCII digits only — rejects '', '-2', '3.5',
  // '1e3', '0x5', whitespace-inside, etc. Leading zeros ('007') are tolerated
  // and normalised by Number().
  if (!/^\d+$/.test(trimmed)) return { status: 'invalid' };
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1) return { status: 'invalid' };

  // Fail-open when we have no reference set (fetch failed or still loading).
  if (validTables.length === 0) return { status: 'valid', table: n };

  if (validTables.includes(n)) return { status: 'valid', table: n };

  const max = Math.max(...validTables);
  if (n > max) return { status: 'out-of-range', max };

  // Gap within [1, max]: suggest the closest real table. Tie-break to the lower
  // number so the result is deterministic.
  let suggestion = validTables[0];
  let bestDist = Math.abs(validTables[0] - n);
  for (const table of validTables) {
    const dist = Math.abs(table - n);
    if (dist < bestDist || (dist === bestDist && table < suggestion)) {
      bestDist = dist;
      suggestion = table;
    }
  }
  return { status: 'gap', suggestion };
}
