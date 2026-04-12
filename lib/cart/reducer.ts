import { type CartState, type CartItemData, type CartItem, cartItemKey, EMPTY_CART } from './types';

// ─── Actions ───

type CartAction =
  | { type: 'ADD_ITEM'; item: CartItemData; comment?: string }
  | { type: 'REMOVE_ITEM'; key: string }
  | { type: 'UPDATE_QUANTITY'; key: string; quantity: number }
  | { type: 'UPDATE_COMMENT'; key: string; comment: string }
  | { type: 'CLEAR' }
  | { type: 'HYDRATE'; state: CartState };

export type { CartAction };

// ─── Reducer ───

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const key = cartItemKey(action.item);
      const existing = state.items.findIndex((i) => i.key === key);

      if (existing >= 0) {
        // Increment quantity of existing item
        const items = [...state.items];
        items[existing] = { ...items[existing], quantity: items[existing].quantity + 1 };
        return { ...state, items };
      }

      // Add new item
      const newItem: CartItem = {
        key,
        item: action.item,
        quantity: 1,
        comment: action.comment,
      };
      return { ...state, items: [...state.items, newItem] };
    }

    case 'REMOVE_ITEM': {
      return { ...state, items: state.items.filter((i) => i.key !== action.key) };
    }

    case 'UPDATE_QUANTITY': {
      if (action.quantity <= 0) {
        return { ...state, items: state.items.filter((i) => i.key !== action.key) };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.key === action.key ? { ...i, quantity: action.quantity } : i,
        ),
      };
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
