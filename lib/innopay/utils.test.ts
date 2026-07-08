// Regression tests for memo hydration — tip token (` T:X.XX`) and per-item notes.
//
// Background (2026-07 bug): the tip token is appended directly after the last
// dehydrated item, so `...,n:BASE64 T:1.50` made the comment parser read
// "BASE64 T:1.50" as the Base64 payload. atob() threw, decodeComment returned '',
// and the customer's free-text note silently vanished from the CO page and the
// kitchen ticket. hydrateMemoFull now extracts the tip BEFORE item parsing.

import { describe, it, expect } from 'vitest';
import {
  hydrateMemoFull,
  encodeComment,
  decodeComment,
  dehydrateMemo,
  type MenuDataForHydration,
  type MemoCartItem,
} from './utils';

const menuData: MenuDataForHydration = {
  dishes: new Map([
    [5, { dish_id: 5, name: 'Bouneschlupp' }],
    [12, { dish_id: 12, name: 'Kniddelen' }],
  ]),
  drinks: new Map([[3, { drink_id: 3, name: 'Battin Blonde' }]]),
  loaded: true,
};

function itemLines(result: ReturnType<typeof hydrateMemoFull>) {
  return result.lines.filter((l) => l.type === 'item') as Array<
    Extract<(typeof result.lines)[number], { type: 'item' }>
  >;
}

describe('comment encoding roundtrip', () => {
  it('survives accents and emojis', () => {
    const text = 'sans oignons, très épicé 🌶️';
    expect(decodeComment(encodeComment(text))).toBe(text);
  });

  it('returns empty string on corrupted input instead of throwing', () => {
    expect(decodeComment('not base64 T:1.50')).toBe('');
  });
});

describe('hydrateMemoFull — tip token', () => {
  it('REGRESSION: note on last item survives when a tip follows it', () => {
    const note = 'sans oignons';
    const memo = `d:5,n:${encodeComment(note)} T:1.50 TABLE 4 kcs-inno-abcd-efgh`;
    const result = hydrateMemoFull(memo, menuData);

    expect(result.tip).toBe('1.50');
    expect(result.table).toBe('4');
    expect(result.identifier).toBe('kcs-inno-abcd-efgh');
    const items = itemLines(result);
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('Bouneschlupp');
    expect(items[0].comment).toBe(note); // was silently '' before the fix
  });

  it('extracts the tip on a multi-item order and keeps all comments', () => {
    const memo = `d:12,q:2,n:${encodeComment('bien cuit')};b:3,s:0.5L,n:${encodeComment('bien fraîche')} T:2.00 TABLE 7 kcs-inno-aaaa-bbbb`;
    const result = hydrateMemoFull(memo, menuData);

    expect(result.tip).toBe('2.00');
    const items = itemLines(result);
    expect(items).toHaveLength(2);
    expect(items[0].comment).toBe('bien cuit');
    expect(items[1].comment).toBe('bien fraîche');
    expect(items[1].description).toContain('Battin Blonde');
  });

  it('returns tip null when no tip token is present (no false positives)', () => {
    const result = hydrateMemoFull('d:5,q:2 TABLE 4 kcs-inno-abcd-efgh', menuData);
    expect(result.tip).toBeNull();
    expect(itemLines(result)).toHaveLength(1);
  });

  it('handles tip without a table (takeaway) and without identifier', () => {
    const result = hydrateMemoFull('d:5 T:0.50', menuData);
    expect(result.tip).toBe('0.50');
    expect(result.table).toBeNull();
    expect(itemLines(result)[0].description).toBe('Bouneschlupp');
  });

  it('works on CO-page pre-stripped content (TABLE and identifier already removed)', () => {
    const memo = `d:5,n:${encodeComment('sans sel')} T:1.00`;
    const result = hydrateMemoFull(memo, menuData);
    expect(result.tip).toBe('1.00');
    expect(itemLines(result)[0].comment).toBe('sans sel');
  });

  it('does not mistake free text for a tip in raw (call-waiter) memos', () => {
    const result = hydrateMemoFull('Un serveur est appelé', menuData);
    expect(result.tip).toBeNull();
    expect(result.lines[0]).toEqual({ type: 'raw', content: 'Un serveur est appelé' });
  });

  it('note without tip still decodes (pre-existing behavior unchanged)', () => {
    const note = 'allergie arachide';
    const result = hydrateMemoFull(`d:5,n:${encodeComment(note)} TABLE 2 kcs-inno-cccc-dddd`, menuData);
    expect(result.tip).toBeNull();
    expect(itemLines(result)[0].comment).toBe(note);
  });
});

describe('dehydrate → hydrate roundtrip (full memo as built by getMemo)', () => {
  it('preserves items, comments, and tip through the real memo format', () => {
    const cart: MemoCartItem[] = [
      { id: 'dish-12', name: 'Kniddelen', price: '15.00', quantity: 2, options: {}, comment: 'sans lardons' },
      { id: 'drink-3-0,5L', name: 'Battin Blonde', price: '4.00', quantity: 1, options: { size: '0,5L' }, comment: undefined },
    ];
    // Mirror useInnopayCart.getMemo: items + tip + table (+ distriate suffix added later)
    const memo = `${dehydrateMemo(cart)} T:1.50 TABLE 9 kcs-inno-eeee-ffff`;
    const result = hydrateMemoFull(memo, menuData);

    expect(result.tip).toBe('1.50');
    expect(result.table).toBe('9');
    const items = itemLines(result);
    expect(items).toHaveLength(2);
    expect(items[0].quantity).toBe(2);
    expect(items[0].comment).toBe('sans lardons');
    expect(items[1].comment).toBeUndefined();
    // Comma→dot size sanitization is reversed for display
    expect(items[1].description).toContain('0,5L');
  });
});
