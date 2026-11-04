import { describe, expect, it } from 'vitest';
import { reconcileCartItems } from './reconcile';
import { cartReducer } from './reducer';
import { cartItemKey, CART_VERSION, type CartItem, type CartItemData, type CartState } from './types';
import type { MenuDish, MenuDrink } from '../../hooks/use-menu';

function entry(item: CartItemData, quantity = 1): CartItem {
  return { key: cartItemKey(item), item, quantity };
}

function drink(overrides: Partial<MenuDrink> = {}): MenuDrink {
  return {
    drink_id: 7, name_fr: 'Limonade', name_en: 'Lemonade', name_lb: null,
    description_fr: null, description_en: null, description_lb: null, selection_mode: null,
    sizes: [{ drink_id: 7, size: '33cl', price_eur: 3.5, discount: null, image_url: null }],
    selections: [{ id: 70, drink_id: 7, name_fr: 'Citron', name_en: 'Lemon', name_lb: null, price_delta: 0.5, sort_order: 0, is_available: true }],
    categories: [],
    ...overrides,
  };
}

function dish(overrides: Partial<MenuDish> = {}): MenuDish {
  return {
    dish_id: 3, name_fr: 'Bouchée', name_en: 'Vol-au-vent', name_lb: null,
    description_fr: null, description_en: null, description_lb: null,
    price_eur: 18, discount: null, image_url: null, is_available: true, is_popular: false, is_new: false,
    sort_order: 0, has_variants: true, selection_label: null,
    variants: [{ id: 30, dish_id: 3, name_fr: 'Grande', name_en: 'Large', name_lb: null, price_eur: 22, sort_order: 0, is_available: true }],
    allergens: [], categories: [],
    ...overrides,
  };
}

const cartDrink: CartItemData = {
  type: 'drink', drinkId: 7, name_fr: 'Limonade maison', name_en: 'Homemade lemonade', name_lb: null,
  size: '33cl', sizePrice: 3, discount: 1, selectionId: 70, selectionName_fr: 'Citron',
  selectionName_en: 'Lemon', selectionName_lb: null, selectionDelta: 0.5, imageUrl: null,
};

describe('reconcileCartItems', () => {
  it('refreshes a renamed and repriced drink, keeping key, quantity and comment', () => {
    const items = [{ ...entry(cartDrink, 2), comment: 'sans glace' }];
    const [out] = reconcileCartItems(items, { drinks: [drink()] });
    expect(out.item).toMatchObject({ name_fr: 'Limonade', name_en: 'Lemonade', sizePrice: 3.5 });
    expect(out).toMatchObject({ key: items[0].key, quantity: 2, comment: 'sans glace' });
  });

  it('returns the same array when nothing changed, so the reducer skips the update', () => {
    const fresh: CartItemData = { ...cartDrink, name_fr: 'Limonade', name_en: 'Lemonade', sizePrice: 3.5 };
    const items = [entry(fresh)];
    expect(reconcileCartItems(items, { drinks: [drink()] })).toBe(items);
  });

  it('drops a drink whose drink, size or selection is no longer on the menu', () => {
    const items = [entry(cartDrink)];
    expect(reconcileCartItems(items, { drinks: [] })).toEqual([]);
    expect(reconcileCartItems(items, { drinks: [drink({ sizes: [{ drink_id: 7, size: '50cl', price_eur: 5, discount: null, image_url: null }] })] })).toEqual([]);
    expect(reconcileCartItems(items, { drinks: [drink({ selections: [] })] })).toEqual([]);
  });

  it('keeps items unchanged while their menu list has not loaded', () => {
    const items = [entry(cartDrink)];
    expect(reconcileCartItems(items, { dishes: [dish()] })).toBe(items);
  });

  it('refreshes a variant dish fully, and drops it when the variant goes', () => {
    const cartDish: CartItemData = {
      type: 'dish', dishId: 3, name_fr: 'Vieux nom', name_en: null, name_lb: null, basePrice: 16, discount: 1,
      variantId: 30, variantName_fr: 'Grand', variantName_en: null, variantName_lb: null, variantPrice: 20,
      allergenIcons: [], imageUrl: null,
    };
    const [out] = reconcileCartItems([entry(cartDish)], { dishes: [dish({ discount: 0.9 })] });
    expect(out.item).toMatchObject({ name_fr: 'Bouchée', basePrice: 18, variantName_fr: 'Grande', variantPrice: 22, discount: 0.9 });
    expect(reconcileCartItems([entry(cartDish)], { dishes: [dish({ variants: [] })] })).toEqual([]);
  });

  it('never overwrites a weekly-special price and keeps special-only dishes', () => {
    // Added from the specials banner at special_price 12; regular price is 18.
    const special: CartItemData = {
      type: 'dish', dishId: 3, name_fr: 'Vieux nom', name_en: null, name_lb: null, basePrice: 12, discount: 1,
      allergenIcons: [], imageUrl: null,
    };
    const [out] = reconcileCartItems([entry(special)], { dishes: [dish()] });
    expect(out.item).toMatchObject({ name_fr: 'Bouchée', basePrice: 12 });
    const items = [entry(special)];
    expect(reconcileCartItems(items, { dishes: [] })).toBe(items);
  });
});

describe('cartReducer SYNC_MENU', () => {
  const state: CartState = { items: [entry(cartDrink)], tip: 1, version: CART_VERSION };

  it('returns the same state when the cart is already current', () => {
    const fresh = { ...state, items: [entry({ ...cartDrink, name_fr: 'Limonade', name_en: 'Lemonade', sizePrice: 3.5 })] };
    expect(cartReducer(fresh, { type: 'SYNC_MENU', menu: { drinks: [drink()] } })).toBe(fresh);
  });

  it('re-clamps the tip when a dropped item shrinks the subtotal', () => {
    const out = cartReducer(state, { type: 'SYNC_MENU', menu: { drinks: [] } });
    expect(out.items).toEqual([]);
    expect(out.tip).toBe(0);
  });
});
