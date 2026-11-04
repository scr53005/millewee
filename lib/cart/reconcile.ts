// The cart stores a snapshot of each item (names, prices) in localStorage for up to 7 days.
// When the owner renames or reprices an item, or makes it unavailable, the snapshot goes stale:
// the cart would show the old name and charge the old price. This refreshes cart items from
// the menu the page already loaded (no extra request), matched by id.
//
// Dishes have one blind spot: a weekly special adds the dish at `special_price` under the same
// cart key as the regular dish, so a dish's base price cannot be told apart and is left as is.
// The same goes for a dish missing from the regular menu (it may be a special-only dish).

import type { CartItem, CartItemDish, CartItemDrink } from './types';
import type { MenuDish, MenuDrink } from '../../hooks/use-menu';

/** A list left undefined means "not loaded yet": its items are kept unchanged, never dropped. */
export interface MenuSnapshot {
  dishes?: MenuDish[];
  drinks?: MenuDrink[];
}

function reconcileDish(item: CartItemDish, dish: MenuDish | undefined): CartItemDish | null {
  if (!dish) return item;
  const next: CartItemDish = {
    ...item,
    name_fr: dish.name_fr,
    name_en: dish.name_en,
    name_lb: dish.name_lb,
    // The special path uses dish.discount too, so this is right for both.
    discount: dish.discount ?? 1.0,
    imageUrl: dish.image_url,
  };
  if (item.variantId != null) {
    const variant = dish.variants.find((v) => v.id === item.variantId);
    if (!variant) return null; // variant removed or made unavailable
    next.variantName_fr = variant.name_fr;
    next.variantName_en = variant.name_en;
    next.variantName_lb = variant.name_lb;
    next.variantPrice = variant.price_eur != null ? variant.price_eur : undefined;
    // Only DishCard (regular menu) adds variants, so the base price is the regular one here.
    next.basePrice = dish.price_eur;
  }
  return next;
}

function reconcileDrink(item: CartItemDrink, drink: MenuDrink | undefined): CartItemDrink | null {
  if (!drink) return null;
  const size = drink.sizes.find((s) => s.size === item.size);
  if (!size) return null;
  const next: CartItemDrink = {
    ...item,
    name_fr: drink.name_fr,
    name_en: drink.name_en,
    name_lb: drink.name_lb,
    sizePrice: size.price_eur,
    discount: size.discount ?? 1.0,
    imageUrl: size.image_url,
  };
  if (item.selectionId != null) {
    const selection = drink.selections.find((s) => s.id === item.selectionId);
    if (!selection) return null; // selection removed or made unavailable
    next.selectionName_fr = selection.name_fr;
    next.selectionName_en = selection.name_en;
    next.selectionName_lb = selection.name_lb;
    next.selectionDelta = selection.price_delta;
  }
  return next;
}

const DISH_FIELDS = [
  'name_fr', 'name_en', 'name_lb', 'discount', 'imageUrl', 'basePrice',
  'variantName_fr', 'variantName_en', 'variantName_lb', 'variantPrice',
] as const;
const DRINK_FIELDS = [
  'name_fr', 'name_en', 'name_lb', 'sizePrice', 'discount', 'imageUrl',
  'selectionName_fr', 'selectionName_en', 'selectionName_lb', 'selectionDelta',
] as const;

function sameItem(a: CartItem['item'], b: CartItem['item']): boolean {
  if (a.type === 'dish' && b.type === 'dish') return DISH_FIELDS.every((f) => a[f] === b[f]);
  if (a.type === 'drink' && b.type === 'drink') return DRINK_FIELDS.every((f) => a[f] === b[f]);
  return false;
}

/**
 * Returns the SAME array when nothing changed, so the reducer can skip the state update
 * (no re-render, no localStorage write) on the common path.
 */
export function reconcileCartItems(items: CartItem[], menu: MenuSnapshot): CartItem[] {
  const dishes = menu.dishes ? new Map(menu.dishes.map((d) => [d.dish_id, d])) : null;
  const drinks = menu.drinks ? new Map(menu.drinks.map((d) => [d.drink_id, d])) : null;
  let changed = false;
  const next: CartItem[] = [];
  for (const entry of items) {
    let item: CartItem['item'] | null = entry.item;
    if (entry.item.type === 'dish' && dishes) item = reconcileDish(entry.item, dishes.get(entry.item.dishId));
    else if (entry.item.type === 'drink' && drinks) item = reconcileDrink(entry.item, drinks.get(entry.item.drinkId));
    if (item === null) {
      changed = true;
      continue;
    }
    if (sameItem(item, entry.item)) {
      next.push(entry);
    } else {
      changed = true;
      next.push({ ...entry, item });
    }
  }
  return changed ? next : items;
}
