'use client';

import { createContext, useContext, useReducer, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { cartReducer, type CartAction } from '@/lib/cart/reducer';
import {
  type CartState,
  type CartItemData,
  type CartItem,
  EMPTY_CART,
  CART_VERSION,
  computeSubtotal,
} from '@/lib/cart/types';

const STORAGE_KEY = 'millewee_cart';
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface StoredCart {
  state: CartState;
  timestamp: number;
}

function loadCart(): CartState {
  if (typeof window === 'undefined') return EMPTY_CART;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_CART;
    const stored: StoredCart = JSON.parse(raw);
    if (Date.now() - stored.timestamp > EXPIRY_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return EMPTY_CART;
    }
    // Migrate v1 → v2: add tip:0 to legacy carts so the items survive the
    // version bump introduced for the tip feature.
    if (stored.state.version === 1) {
      return { ...stored.state, tip: 0, version: CART_VERSION };
    }
    if (stored.state.version !== CART_VERSION) return EMPTY_CART;
    return stored.state;
  } catch {
    return EMPTY_CART;
  }
}

function saveCart(state: CartState) {
  try {
    const stored: StoredCart = { state, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

// ─── Context ───

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItemData, comment?: string) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  updateComment: (key: string, comment: string) => void;
  clearCart: () => void;
  setTip: (tip: number) => void;
  totalItems: number;
  /** Items only — used for breakdown display + tip percentage base. */
  subtotal: number;
  /** Current tip in EUR (already auto-clamped by the reducer). */
  tip: number;
  /** subtotal + tip — what every payment flow charges. */
  totalPrice: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, EMPTY_CART);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = loadCart();
    if (saved.items.length > 0) {
      dispatch({ type: 'HYDRATE', state: saved });
    }
  }, []);

  // Persist on every state change (skip initial empty state before hydration)
  useEffect(() => {
    saveCart(state);
  }, [state]);

  // Cross-tab sync via StorageEvent
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const stored: StoredCart = JSON.parse(e.newValue);
        if (stored.state.version === CART_VERSION) {
          dispatch({ type: 'HYDRATE', state: stored.state });
        }
      } catch {
        // Ignore malformed data from other tabs
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const addItem = useCallback((item: CartItemData, comment?: string) => {
    dispatch({ type: 'ADD_ITEM', item, comment });
  }, []);

  const removeItem = useCallback((key: string) => {
    dispatch({ type: 'REMOVE_ITEM', key });
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', key, quantity });
  }, []);

  const updateComment = useCallback((key: string, comment: string) => {
    dispatch({ type: 'UPDATE_COMMENT', key, comment });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  const setTip = useCallback((tip: number) => {
    dispatch({ type: 'SET_TIP', tip });
  }, []);

  const totalItems = useMemo(
    () => state.items.reduce((sum, i) => sum + i.quantity, 0),
    [state.items],
  );

  const subtotal = useMemo(() => computeSubtotal(state.items), [state.items]);
  const tip = state.tip;
  const totalPrice = subtotal + tip;

  const value = useMemo<CartContextType>(
    () => ({
      items: state.items,
      addItem,
      removeItem,
      updateQuantity,
      updateComment,
      clearCart,
      setTip,
      totalItems,
      subtotal,
      tip,
      totalPrice,
    }),
    [
      state.items,
      addItem,
      removeItem,
      updateQuantity,
      updateComment,
      clearCart,
      setTip,
      totalItems,
      subtotal,
      tip,
      totalPrice,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
