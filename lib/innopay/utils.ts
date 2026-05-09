/**
 * Innopay Utility Functions
 * Adapted from croque-bedaine/src/lib/innopay/utils.ts for Next.js
 */

import { Buffer } from 'buffer';
import { getInnopayUrl, getHiveAccount, getEnvironment, isPrivateNetwork } from './config';

// Re-export environment functions for backward compatibility
export { getInnopayUrl, getHiveAccount };

// ============================================================================
// TYPES
// ============================================================================

export interface HiveTransferParams {
  recipient: string;
  amountHbd: string; // e.g., "0.010"
  memo: string;
}

/** Generic cart item for memo dehydration — spoke adapters convert to this */
export interface MemoCartItem {
  id: string; // e.g., 'dish-1', 'drink-2-50cl'
  name: string;
  price: string;
  quantity: number;
  options: { [key: string]: string }; // e.g., { size: '50cl' }
  comment?: string;
}

// ============================================================================
// HIVE TRANSFER URL GENERATION
// ============================================================================

export function generateHiveTransferUrl(params: HiveTransferParams): string {
  const { recipient, amountHbd, memo } = params;

  const checkHbd = parseFloat(amountHbd);
  if (isNaN(checkHbd)) {
    throw new Error(`Invalid amount HBD: ${amountHbd}`);
  }
  const checkedHbd = checkHbd.toFixed(3); // Ensure 3 decimal places for HBD

  const operation = [
    'transfer',
    {
      to: recipient,
      amount: `${checkedHbd} HBD`,
      memo: memo,
    },
  ];

  const encodedOperation = 'hive://sign/op/' + Buffer.from(JSON.stringify(operation)).toString('base64');
  return encodedOperation;
}

// ============================================================================
// TABLE EXTRACTION
// ============================================================================

export function getTable(memo: string, returnBoolean: boolean = false): string | boolean {
  const tableIndex = memo.lastIndexOf('TABLE ');
  if (tableIndex === -1) {
    return returnBoolean ? false : 'no table information found';
  }

  if (returnBoolean) {
    return true;
  }

  const sub = memo.substring(tableIndex + 'TABLE '.length);
  const match = sub.match(/^\s?(\d+)(?:\s+|$)/);

  if (match && match[1]) {
    return match[1];
  } else {
    return 'no table information found';
  }
}

// ============================================================================
// DISTRIATE (UNIQUE ORDER ID)
// ============================================================================

export function distriate(tag?: string): string {
  const effectiveTag = tag || 'mlw'; // 'mlw' for millewee
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let randomPart1 = '';
  let randomPart2 = '';

  for (let i = 0; i < 4; i++) {
    randomPart1 += chars.charAt(Math.floor(Math.random() * chars.length));
    randomPart2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${effectiveTag}-inno-${randomPart1}-${randomPart2}`;
}

/**
 * Generates both the `hive://sign/...` URL and the final memo (base memo +
 * distriate suffix). Returning both lets callers persist the memo prefix via
 * `storeMemoBeforeOrder` so downstream pulse polling can match the transfer
 * when it lands.
 *
 * Does not mutate the caller's params object.
 */
export function generateDistriatedHiveOp(
  params: HiveTransferParams,
  distriateSuffix?: string,
): { url: string; memo: string } {
  const suffix = distriateSuffix || distriate();
  const finalMemo = params.memo ? `${params.memo} ${suffix}` : suffix;
  const url = generateHiveTransferUrl({ ...params, memo: finalMemo });
  return { url, memo: finalMemo };
}

// ============================================================================
// EURO TOKEN TRANSFER (Hive-Engine)
// ============================================================================

/**
 * Creates a Hive-Engine EURO token transfer operation (custom_json)
 */
export function createEuroTransferOperation(
  from: string,
  to: string,
  amount: string,
  memo: string
) {
  return {
    required_auths: [from],
    required_posting_auths: [],
    id: 'ssc-mainnet-hive',
    json: JSON.stringify({
      contractName: 'tokens',
      contractAction: 'transfer',
      contractPayload: {
        symbol: 'EURO',
        to: to,
        quantity: amount,
        memo: memo
      }
    })
  };
}

/**
 * Signs and broadcasts a Hive operation using the active key — client-side.
 *
 * NOTE: As of 2026-05-09 this function is no longer called by the active
 * payment flow. Both order payments (Flow 6) and call-waiter requests now
 * route through the hub's `/api/sign-and-broadcast` endpoint, which signs
 * server-side. This function is kept as a documented fallback in case a
 * future flow needs purely client-side signing without depending on the hub,
 * but if it stays unused, both this function and `@hiveio/dhive` can be
 * removed in a follow-up cleanup.
 */
export async function signAndBroadcastOperation(
  operation: Record<string, any>,
  activePrivateKey: string
): Promise<string> {
  console.log('[SIGN] Starting broadcast...', { operation });

  try {
    const { Client, PrivateKey } = await import('@hiveio/dhive');
    console.log('[SIGN] dhive imported');

    const client = new Client([
      'https://api.hive.blog',
      'https://api.deathwing.me',
      'https://hive-api.arcange.eu'
    ], {
      timeout: 15000,
      failoverThreshold: 3
    });
    console.log('[SIGN] Client created');

    const key = PrivateKey.fromString(activePrivateKey);
    console.log('[SIGN] Key parsed');

    console.log('[SIGN] Sending operation to blockchain...');
    const result = await client.broadcast.sendOperations(
      [['custom_json', operation]],
      key
    );
    console.log('[SIGN] Broadcast successful!', result);

    return result.id;
  } catch (error: unknown) {
    console.error('[SIGN] Broadcast error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Broadcast failed: ${errorMessage}`);
  }
}

// ============================================================================
// COMMENT ENCODING (Base64 for security — no cleartext in memos)
// ============================================================================

/**
 * Encode a comment as Base64 for safe embedding in memos.
 * Uses encodeURIComponent first to handle Unicode (accents, emojis),
 * then Base64-encodes the result. Output uses only [A-Za-z0-9+/=].
 */
export function encodeComment(text: string): string {
  if (!text) return '';
  const truncated = text.slice(0, 80);
  return btoa(encodeURIComponent(truncated));
}

/**
 * Decode a Base64-encoded comment back to readable text.
 * Strips HTML tags as defense-in-depth before returning.
 */
export function decodeComment(encoded: string): string {
  if (!encoded) return '';
  try {
    const decoded = decodeURIComponent(atob(encoded));
    return decoded.replace(/<[^>]*>/g, '');
  } catch {
    return '';
  }
}

// ============================================================================
// ORDER TIMING EXTRACTION (P@HHhMM = takeaway, T@HHhMM = dine-in)
// ============================================================================

export interface OrderTiming {
  type: 'pickup' | 'dinein';
  time: string; // e.g., '12h30'
  date?: string; // YYYY-MM-DD (present in new format, absent in legacy)
}

// Matches both new format P@2026-03-02@12h30 and legacy P@12h30
const ORDER_TIMING_REGEX = /\s*([PT])@(?:(\d{4}-\d{2}-\d{2})@)?(\d{2}h\d{2})/;

export function getOrderTiming(memo: string): OrderTiming | null {
  const match = memo.match(ORDER_TIMING_REGEX);
  if (!match) return null;
  return {
    type: match[1] === 'P' ? 'pickup' : 'dinein',
    date: match[2] || undefined,
    time: match[3],
  };
}

// ============================================================================
// MEMO DEHYDRATION (Cart -> Compact String)
// ============================================================================

const optionShortCodes: { [key: string]: string } = {
  size: 's',
  cuisson: 'c',
  ingredient: 'i',
};

export function dehydrateMemo(cart: MemoCartItem[]): string {
  const cartMemoParts: string[] = [];

  cart.forEach(item => {
    let itemMemo = '';
    let baseId = '';
    let itemTypePrefix = '';

    if (item.id.startsWith('dish-')) {
      itemTypePrefix = 'd';
      baseId = item.id.replace('dish-', '');
    } else if (item.id.startsWith('drink-')) {
      const parts = item.id.split('-');
      if (parts.length >= 2) {
        itemTypePrefix = 'b';
        baseId = parts[1];
      } else {
        console.warn('Malformed drink ID in cart during dehydration:', item.id);
        return;
      }
    } else {
      console.warn('Unknown item ID format in cart during dehydration:', item.id);
      return;
    }

    itemMemo = `${itemTypePrefix}:${baseId}`;

    Object.keys(item.options).forEach(optionKey => {
      const shortCode = optionShortCodes[optionKey];
      if (shortCode && item.options[optionKey]) {
        // Sanitize: comma is the field separator in the dehydrated memo, so any
        // comma inside an option value (e.g. French "0,5L" drink size) would
        // split the value at hydrate time. Replace with dot — still a valid
        // decimal separator, and fully reversible for display.
        const safeValue = String(item.options[optionKey]).replace(/,/g, '.');
        itemMemo += `,${shortCode}:${safeValue}`;
      }
    });

    if (item.quantity > 1) {
      itemMemo += `,q:${item.quantity}`;
    }

    if (item.comment) {
      itemMemo += `,n:${encodeComment(item.comment)}`;
    }

    cartMemoParts.push(itemMemo);
  });

  return cartMemoParts.join(';').trim();
}

// ============================================================================
// MEMO HYDRATION (Compact String -> Structured Display Data)
// ============================================================================

export type HydratedOrderLine =
  | { type: 'item'; quantity: number; description: string; categoryType: 'dish' | 'drink'; itemName: string; comment?: string }
  | { type: 'separator' }
  | { type: 'raw'; content: string };

export interface HydrationResult {
  lines: HydratedOrderLine[];
  table: string | null;
  identifier: string | null;
  timing: OrderTiming | null;
  preferredTable: boolean;
}

export interface MenuDataForHydration {
  dishes: Map<number, { dish_id: number; name: string }>;
  drinks: Map<number, { drink_id: number; name: string }>;
  loaded: boolean;
}

const DISTRIATE_SUFFIX_REGEX = /\s*[a-z0-9]+-inno-[a-z0-9]{4}-[a-z0-9]{4}$/i;

export function extractDistriateIdentifier(memo: string): string | null {
  const match = memo.match(DISTRIATE_SUFFIX_REGEX);
  return match ? match[0].trim() : null;
}

export function hydrateMemo(rawMemo: string, menuData?: MenuDataForHydration): HydratedOrderLine[] {
  const result = hydrateMemoFull(rawMemo, menuData);
  return result.lines;
}

export function hydrateMemoFull(rawMemo: string, menuData?: MenuDataForHydration): HydrationResult {
  let orderContent = rawMemo;
  let table: string | null = null;
  let identifier: string | null = null;

  // Extract Distriate identifier (xxx-inno-yyyy-zzzz) first
  const identifierMatch = orderContent.match(DISTRIATE_SUFFIX_REGEX);
  if (identifierMatch) {
    identifier = identifierMatch[0].trim();
    orderContent = orderContent.replace(DISTRIATE_SUFFIX_REGEX, '').trim();
  }

  // Extract order timing (P@HHhMM or T@HHhMM) before TABLE extraction
  const timing = getOrderTiming(orderContent);
  if (timing) {
    orderContent = orderContent.replace(ORDER_TIMING_REGEX, '').trim();
  }

  // Extract TABLE information
  const tableIndex = orderContent.lastIndexOf('TABLE ');
  if (tableIndex !== -1) {
    const tableSection = orderContent.substring(tableIndex + 'TABLE '.length);
    const tableMatch = tableSection.match(/^\s?(\d+)(?:\s+|$)/);
    if (tableMatch && tableMatch[1]) {
      table = tableMatch[1];
    }
    orderContent = orderContent.substring(0, tableIndex).trim();
  }

  const preferredTable = timing?.type === 'dinein' && table !== null;

  // Remove trailing semicolon if present
  orderContent = orderContent.replace(/;$/, '').trim();

  // Check if the memo contains codified items (d: or b:)
  if (!/(?:d:\d+|b:\d+)/.test(orderContent)) {
    // Not a codified memo (e.g., call-waiter)
    // Decode any n:BASE64 comment token before returning as raw
    const noteMatch = orderContent.match(/\s*n:([A-Za-z0-9+/=%]+)/);
    let displayContent = orderContent;
    if (noteMatch) {
      const decoded = decodeComment(noteMatch[1]);
      displayContent = orderContent.replace(noteMatch[0], '').trim();
      if (decoded) displayContent += ` \u2014 ${decoded}`;
    }
    return { lines: [{ type: 'raw', content: displayContent }], table, identifier, timing, preferredTable };
  }

  const itemStrings = orderContent.split(';').filter(s => s.trim() !== '');
  const hydratedParts: HydratedOrderLine[] = [];
  let hasDishes = false;
  let hasDrinks = false;

  for (const itemString of itemStrings) {
    const parts = itemString.split(',');
    const idPart = parts[0].trim();
    let quantity = 1;
    let sizeOption = '';
    let comment: string | undefined;
    let ingredientOption = '';

    for (let i = 1; i < parts.length; i++) {
      const [key, ...valueParts] = parts[i].split(':');
      const value = valueParts.join(':');
      if (key === 'q') {
        quantity = parseInt(value, 10) || 1;
      } else if (key === 's') {
        let cleanSize = value || '';
        cleanSize = cleanSize.replace(DISTRIATE_SUFFIX_REGEX, '').trim();
        sizeOption = cleanSize;
      } else if (key === 'i') {
        ingredientOption = value || '';
      } else if (key === 'n') {
        comment = decodeComment(value);
      }
    }

    const [typePrefix, numericIdStr] = idPart.split(':');
    const numericId = parseInt(numericIdStr, 10);

    if (typePrefix !== 'd' && typePrefix !== 'b') {
      hydratedParts.push({ type: 'raw', content: itemString });
      continue;
    }

    let itemName: string | null = null;

    if (menuData?.loaded) {
      if (typePrefix === 'd') {
        const dish = menuData.dishes.get(numericId);
        if (dish) itemName = dish.name;
      } else if (typePrefix === 'b') {
        const drink = menuData.drinks.get(numericId);
        if (drink) itemName = drink.name;
      }
    }

    if (itemName) {
      let description = itemName;
      if (ingredientOption) description = `${description} - ${ingredientOption}`;
      if (sizeOption) {
        // Reverse the dehydrate-time comma→dot substitution on decimal-looking
        // sizes so French-format labels render as "0,5L" rather than "0.5L".
        const displaySize = sizeOption.replace(/(\d)\.(\d)/g, '$1,$2');
        description = `${description} (${displaySize})`;
      }

      const categoryType: 'dish' | 'drink' = typePrefix === 'd' ? 'dish' : 'drink';

      hydratedParts.push({
        type: 'item',
        quantity,
        description,
        categoryType,
        itemName,
        ...(comment && { comment }),
      });

      if (categoryType === 'dish') hasDishes = true;
      else hasDrinks = true;
    } else {
      hydratedParts.push({
        type: 'item',
        quantity,
        description: `${typePrefix === 'd' ? 'Plat' : 'Boisson'} #${numericId}`,
        categoryType: typePrefix === 'd' ? 'dish' : 'drink',
        itemName: `#${numericId}`,
        ...(comment && { comment }),
      });

      if (typePrefix === 'd') hasDishes = true;
      else hasDrinks = true;
    }
  }

  // Add separator between dishes and drinks if both are present
  if (hasDishes && hasDrinks) {
    const dishIndices = hydratedParts
      .map((item, index) => (item.type === 'item' && item.categoryType === 'dish' ? index : -1))
      .filter(index => index !== -1);
    const drinkIndices = hydratedParts
      .map((item, index) => (item.type === 'item' && item.categoryType === 'drink' ? index : -1))
      .filter(index => index !== -1);

    if (dishIndices.length > 0 && drinkIndices.length > 0) {
      if (Math.max(...dishIndices) < Math.min(...drinkIndices)) {
        hydratedParts.splice(Math.max(...dishIndices) + 1, 0, { type: 'separator' });
      } else if (Math.max(...drinkIndices) < Math.min(...dishIndices)) {
        hydratedParts.splice(Math.max(...drinkIndices) + 1, 0, { type: 'separator' });
      }
    }
  }

  return { lines: hydratedParts, table, identifier, timing, preferredTable };
}

// ============================================================================
// DUPLICATE ORDER PREVENTION (Level 2 guardrail)
// ============================================================================

export function getMemoFixedPart(memo: string | null | undefined): string {
  try {
    if (!memo) return '';
    if (memo.length < 10) return memo;
    return memo.slice(0, -9);
  } catch { return ''; }
}

export function checkDuplicateMemo(currentMemo: string): boolean {
  try {
    const currentFixed = getMemoFixedPart(currentMemo);
    const storedFixed = localStorage.getItem('innopay_latestMemoContent');
    const storedTime = localStorage.getItem('innopay_latestMemoDateTime');

    console.log('[DEDUP L2] Checking memo \u2014 current fixed:', currentFixed.substring(0, 40) + '...');

    if (currentFixed !== storedFixed) {
      console.log('[DEDUP L2] Memo differs or no stored memo \u2014 proceeding');
      localStorage.setItem('innopay_latestMemoContent', currentFixed);
      localStorage.setItem('innopay_latestMemoDateTime', String(Date.now()));
      return false;
    }

    if (!storedTime) {
      console.log('[DEDUP L2] Same memo but no timestamp \u2014 proceeding');
      localStorage.setItem('innopay_latestMemoDateTime', String(Date.now()));
      return false;
    }

    const elapsed = Date.now() - parseInt(storedTime);
    if (elapsed < 15 * 60 * 1000) {
      console.warn('[DEDUP L2] DUPLICATE DETECTED \u2014 same memo within', Math.round(elapsed / 1000), 's');
      return true;
    }

    console.log('[DEDUP L2] Same memo but stale (>15min) \u2014 proceeding');
    localStorage.setItem('innopay_latestMemoDateTime', String(Date.now()));
    return false;
  } catch (err) {
    console.warn('[DEDUP L2] Error in duplicate check:', err);
    return true; // Safe fallback
  }
}

export function storeMemoBeforeOrder(currentMemo: string): void {
  try {
    localStorage.setItem('innopay_latestMemoContent', getMemoFixedPart(currentMemo));
    localStorage.setItem('innopay_latestMemoDateTime', String(Date.now()));
  } catch {
    // Silent
  }
}

// ============================================================================
// MERCHANT-HUB API CALLS
// ============================================================================

export function getMerchantHubUrl(): string {
  if (process.env.NEXT_PUBLIC_MERCHANT_HUB_URL) {
    return process.env.NEXT_PUBLIC_MERCHANT_HUB_URL;
  }

  if (typeof window === 'undefined') {
    return 'https://merchant-hub-theta.vercel.app';
  }

  const hostname = window.location.hostname;

  if (isPrivateNetwork(hostname) || hostname.includes('vercel.app')) {
    return 'https://merchant-hub-theta.vercel.app';
  }

  return 'https://merchant-hub.innopay.lu';
}

const SHOP_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || 'millewee';

export async function wakeUpMerchantHub(): Promise<boolean> {
  const merchantHubUrl = getMerchantHubUrl();
  console.log('[INNOPAY] Waking up merchant-hub at:', merchantHubUrl);
  try {
    const response = await fetch(`${merchantHubUrl}/api/wake-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: SHOP_ID }),
    });
    return response.ok;
  } catch (error) {
    console.error('[INNOPAY] Failed to wake up merchant-hub:', error);
    return false;
  }
}

export async function consumeTransfers(consumerId: string, count: number = 10): Promise<unknown[]> {
  const merchantHubUrl = getMerchantHubUrl();
  const env = getEnvironment() === 'PROD' ? 'prod' : 'dev';
  try {
    const params = new URLSearchParams({
      restaurantId: SHOP_ID,
      consumerId,
      count: count.toString(),
      env,
    });
    const response = await fetch(`${merchantHubUrl}/api/transfers/consume?${params}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    console.log('[INNOPAY] consumeTransfers response:', data);
    return data.transfers || [];
  } catch (error) {
    console.error('[INNOPAY] Failed to consume transfers:', error);
    return [];
  }
}

export async function acknowledgeTransfers(messageIds: string[]): Promise<boolean> {
  const merchantHubUrl = getMerchantHubUrl();
  const env = getEnvironment() === 'PROD' ? 'prod' : 'dev';
  try {
    const response = await fetch(`${merchantHubUrl}/api/transfers/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: SHOP_ID, messageIds, env }),
    });
    return response.ok;
  } catch (error) {
    console.error('[INNOPAY] Failed to acknowledge transfers:', error);
    return false;
  }
}
