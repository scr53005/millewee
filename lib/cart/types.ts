// ─── Cart Item Types ───

export interface CartItemDish {
  type: 'dish';
  dishId: number;
  name_fr: string;
  name_en: string | null;
  name_lb: string | null;
  basePrice: number;
  discount: number; // 1.0 = no discount
  variantId?: number;
  variantName_fr?: string;
  variantName_en?: string | null;
  variantName_lb?: string | null;
  variantPrice?: number; // overrides basePrice if present
  allergenIcons: string[];
  imageUrl: string | null;
}

export interface CartItemDrink {
  type: 'drink';
  drinkId: number;
  name_fr: string;
  name_en: string | null;
  name_lb: string | null;
  size: string; // required — price lives on drink_size
  sizePrice: number;
  discount: number; // 1.0 = no discount
  selectionId?: number;
  selectionName_fr?: string;
  selectionName_en?: string | null;
  selectionName_lb?: string | null;
  selectionDelta: number; // default 0
  imageUrl: string | null;
}

export type CartItemData = CartItemDish | CartItemDrink;

export interface CartItem {
  key: string;
  item: CartItemData;
  quantity: number;
  comment?: string; // max 80 chars
}

// ─── Key generation ───

export function cartItemKey(item: CartItemData): string {
  if (item.type === 'dish') {
    return `dish-${item.dishId}-${item.variantId ?? 0}`;
  }
  return `drink-${item.drinkId}-${item.size}-${item.selectionId ?? 0}`;
}

// ─── Price calculation ───

export function effectivePrice(item: CartItemData): number {
  if (item.type === 'dish') {
    const base = item.variantPrice ?? item.basePrice;
    return base * item.discount;
  }
  return (item.sizePrice + item.selectionDelta) * item.discount;
}

// ─── Cart State ───

export interface CartState {
  items: CartItem[];
  /** Tip in EUR. Stored as an absolute amount (not a percentage) so it
   *  survives subtotal changes coherently. Auto-clamped to subtotal × 0.5
   *  by the reducer on item-changing actions. */
  tip: number;
  version: number;
}

/** Hard cap on tip relative to subtotal (anti-laundering — see PROJECT-STATUS.md). */
export const TIP_MAX_FRACTION = 0.5;
/** Soft warning threshold above which the UI suggests "this is generous". */
export const TIP_SOFT_WARNING_FRACTION = 0.3;

export const CART_VERSION = 2;
export const EMPTY_CART: CartState = { items: [], tip: 0, version: CART_VERSION };

/** Sum of items × quantity, ignoring tip. */
export function computeSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + effectivePrice(i.item) * i.quantity, 0);
}

/** Clamp a tip value to the allowed range for the given subtotal. */
export function clampTip(tip: number, subtotal: number): number {
  if (!isFinite(tip) || tip <= 0 || subtotal <= 0) return 0;
  const max = subtotal * TIP_MAX_FRACTION;
  return Math.min(tip, max);
}
