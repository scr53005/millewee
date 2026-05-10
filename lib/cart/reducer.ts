import {
  type CartState,
  type CartItemData,
  type CartItem,
  cartItemKey,
  EMPTY_CART,
  computeSubtotal,
  clampTip,
} from './types';

// ─── Actions ───

type CartAction =
  | { type: 'ADD_ITEM'; item: CartItemData; comment?: string }
  | { type: 'REMOVE_ITEM'; key: string }
  | { type: 'UPDATE_QUANTITY'; key: string; quantity: number }
  | { type: 'UPDATE_COMMENT'; key: string; comment: string }
  | { type: 'SET_TIP'; tip: number }
  | { type: 'CLEAR' }
  | { type: 'HYDRATE'; state: CartState };

export type { CartAction };

// ─── Reducer ───

/** Run after any items mutation so the stored tip never exceeds the cap
 *  for the new subtotal. Without this, dropping items below tip × 2 would
 *  produce nonsense like a 200%-of-subtotal tip. */
function reclampTip(state: CartState): CartState {
  if (state.tip <= 0) return state;
  const subtotal = computeSubtotal(state.items);
  const clamped = clampTip(state.tip, subtotal);
  return clamped === state.tip ? state : { ...state, tip: clamped };
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const key = cartItemKey(action.item);
      const existing = state.items.findIndex((i) => i.key === key);

      if (existing >= 0) {
        // Increment quantity of existing item
        const items = [...state.items];
        items[existing] = { ...items[existing], quantity: items[existing].quantity + 1 };
        return reclampTip({ ...state, items });
      }

      // Add new item
      const newItem: CartItem = {
        key,
        item: action.item,
        quantity: 1,
        comment: action.comment,
      };
      return reclampTip({ ...state, items: [...state.items, newItem] });
    }

    case 'REMOVE_ITEM': {
      return reclampTip({ ...state, items: state.items.filter((i) => i.key !== action.key) });
    }

    case 'UPDATE_QUANTITY': {
      if (action.quantity <= 0) {
        return reclampTip({ ...state, items: state.items.filter((i) => i.key !== action.key) });
      }
      return reclampTip({
        ...state,
        items: state.items.map((i) =>
          i.key === action.key ? { ...i, quantity: action.quantity } : i,
        ),
      });
    }

    case 'UPDATE_COMMENT': {
      const trimmed = action.comment.slice(0, 80);
      return {
        ...state,
        items: state.items.map((i) =>
          i.key === action.key ? { ...i, comment: trimmed || undefined } : i,
        ),
      };
    }

    case 'SET_TIP': {
      const subtotal = computeSubtotal(state.items);
      const clamped = clampTip(action.tip, subtotal);
      return { ...state, tip: clamped };
    }

    case 'CLEAR': {
      return EMPTY_CART;
    }

    case 'HYDRATE': {
      return action.state;
    }

    default:
      return state;
  }
}
