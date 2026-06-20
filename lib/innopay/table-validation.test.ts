import { describe, it, expect } from 'vitest';
import { validateTableNumber } from './table-validation';

const TABLES = [1, 2, 3, 5, 8, 10]; // note the gaps at 4, 6, 7, 9

describe('validateTableNumber', () => {
  it('accepts a number that exists in the set', () => {
    expect(validateTableNumber('5', TABLES)).toEqual({ status: 'valid', table: 5 });
  });

  it('tolerates surrounding whitespace and leading zeros', () => {
    expect(validateTableNumber('  08 ', TABLES)).toEqual({ status: 'valid', table: 8 });
  });

  it.each(['', '   ', 'abc', '3.5', '-2', '1e3', '0x5', '٣', 'NaN'])(
    'rejects non-natural input %j as invalid',
    (raw) => {
      expect(validateTableNumber(raw, TABLES)).toEqual({ status: 'invalid' });
    },
  );

  it('rejects zero as invalid (not a natural table number)', () => {
    expect(validateTableNumber('0', TABLES)).toEqual({ status: 'invalid' });
  });

  it('flags a number greater than the max table as out-of-range', () => {
    expect(validateTableNumber('11', TABLES)).toEqual({ status: 'out-of-range', max: 10 });
  });

  it('suggests the closest table for a gap within range', () => {
    // 6 is equidistant from 5 and 8 → no; 6 is 1 from 5 and 2 from 8 → 5
    expect(validateTableNumber('6', TABLES)).toEqual({ status: 'gap', suggestion: 5 });
    // 7 is 2 from 5 and 1 from 8 → 8
    expect(validateTableNumber('7', TABLES)).toEqual({ status: 'gap', suggestion: 8 });
    // 9 is 1 from 8 and 1 from 10 → tie → lower number (8)
    expect(validateTableNumber('9', TABLES)).toEqual({ status: 'gap', suggestion: 8 });
    // 4 is 1 from 3 and 1 from 5 → tie → lower number (3)
    expect(validateTableNumber('4', TABLES)).toEqual({ status: 'gap', suggestion: 3 });
  });

  it('fails open (accepts) when the valid-table set is empty (DB unavailable)', () => {
    expect(validateTableNumber('999', [])).toEqual({ status: 'valid', table: 999 });
  });
});
