/**
 * useInnopayCart Hook
 * Adapter hook that bridges millewee's typed cart (CartItemDish | CartItemDrink)
 * with innopay's generic MemoCartItem format for memo dehydration.
 *
 * Millewee cart structure differs from croque-bedaine:
 * - CB has a single `CartItem` with `selectedOption: "ingredient / size"` string
 * - Millewee has discriminated `CartItemDish` / `CartItemDrink` with typed fields
 *
 * This adapter produces the same blockchain memo format as CB.
 */

'use client';

import { useCallback } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useTable } from '@/lib/table-context';
import { effectivePrice, type CartItem, type CartItemData } from '@/lib/cart/types';
import { dehydrateMemo, type MemoCartItem } from '@/lib/innopay/utils';

interface InnopayCartExtensions {
  table: string;
  getMemo: () => string;
  getTotalEurPrice: () => string;
  getMemoCartItems: () => MemoCartItem[];
}

type UseInnopayCartReturn = ReturnType<typeof useCart> & InnopayCartExtensions;

/**
 * Converts a millewee CartItemData into innopay's generic MemoCartItem format.
 * - Dish → id: `dish-{dishId}`, options: { size?: variantName_fr, ... }
 * - Drink → id: `drink-{drinkId}-{size}`, options: { size, ingredient?: selectionName_fr }
 */
function toMemoCartItem(cartItem: CartItem): MemoCartItem {
  const { item, quantity, comment } = cartItem;
  const options: { [key: string]: string } = {};

  let id: string;
  let name: string;
  let price: number;

  if (item.type === 'dish') {
    id = `dish-${item.dishId}`;
    name = item.name_fr;
    price = effectivePrice(item);
    if (item.variantName_fr) {
      // Variants usually describe a size or sub-option; use 'size' code for brevity
      options.size = item.variantName_fr;
    }
  } else {
    id = `drink-${item.drinkId}-${item.size}`;
    name = item.name_fr;
    price = effectivePrice(item);
    options.size = item.size;
    if (item.selectionName_fr) {
      options.ingredient = item.selectionName_fr;
    }
  }

  return {
    id,
    name,
    price: price.toFixed(2),
    quantity,
    options,
    comment,
  };
}

/**
 * Wraps the existing cart with innopay-specific extensions.
 *
 * Features:
 * - Table tracking (via millewee's TableProvider, which reads URL + localStorage)
 * - Memo generation for blockchain transfers (format: `d:1,q:2;b:3,s:50cl; TABLE X`)
 * - EUR price formatting
 */
export function useInnopayCart(): UseInnopayCartReturn {
  const cart = useCart();
  const { tableNumber } = useTable();
  const table = tableNumber ?? '';

  const getMemoCartItems = useCallback((): MemoCartItem[] => {
    return cart.items.map(toMemoCartItem);
  }, [cart.items]);

  const getMemo = useCallback((): string => {
    const memoCartItems = getMemoCartItems();
    let memo = dehydrateMemo(memoCartItems);
    memo += table ? ` TABLE ${table}` : '';
    return memo.trim();
  }, [getMemoCartItems, table]);

  const getTotalEurPrice = useCallback((): string => {
    return cart.totalPrice.toFixed(2);
  }, [cart.totalPrice]);

  return {
    ...cart,
    table,
    getMemo,
    getTotalEurPrice,
    getMemoCartItems,
  };
}
