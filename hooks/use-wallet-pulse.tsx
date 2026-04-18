'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useCart } from './use-cart';

export type PulseState = 'none' | 'blue' | 'green' | 'green-slow' | 'green-solid' | 'red';

const LS_MEMO_CONTENT = 'innopay_latestMemoContent';
const LS_MEMO_TIME = 'innopay_latestMemoDateTime';
const LS_FULFILLED_AT = 'innopay_fulfilledDetectedAt';
// Tracks which memo prefix has already fired onOrderConfirmed so the callback
// stays idempotent across refreshes — a re-hydrated cart must not get wiped
// again when the same transfer is re-detected.
const LS_CONFIRMED_FOR = 'innopay_orderConfirmedForMemo';

interface WalletPulseContextValue {
  pulseState: PulseState;
  /**
   * Call right after `storeMemoBeforeOrder()` — resets the fulfillment marker,
   * flips state to blue, and schedules the first check after 9s (blockchain
   * needs a block to confirm).
   */
  startOrderPulsing: () => void;
  /**
   * Manual reset (double-tap / long-press on wallet or close button). Clears
   * all pulse LS and stops the state machine.
   */
  resetPulse: () => void;
}

const WalletPulseContext = createContext<WalletPulseContextValue | null>(null);

interface UseWalletPulseMachineOptions {
  /**
   * Fires exactly once per order when the transfer is first detected in the
   * spoke DB (state transitions from none/blue → green). Safe place to clear
   * the cart on the external-wallet path — the transfer has landed, the order
   * cannot be withdrawn anymore.
   */
  onOrderConfirmed?: () => void;
}

/**
 * Internal pulse state machine. Headless — polls `/api/transfers/check-mine`
 * on an adaptive schedule and exposes the resulting state. Not exported
 * directly; use `WalletPulseProvider` + `useWalletPulse` instead.
 */
function useWalletPulseMachine({ onOrderConfirmed }: UseWalletPulseMachineOptions = {}) {
  const [pulseState, setPulseState] = useState<PulseState>('none');

  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest callback in a ref so the polling loop doesn't need to
  // restart when the parent re-renders with a new function identity.
  const onOrderConfirmedRef = useRef(onOrderConfirmed);
  useEffect(() => { onOrderConfirmedRef.current = onOrderConfirmed; }, [onOrderConfirmed]);

  const schedule = useCallback((delayMs: number) => {
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => { pulseCheckRef.current(); }, delayMs);
  }, []);

  const pulseCheck = useCallback(async () => {
    const memoPrefix = typeof window !== 'undefined' ? localStorage.getItem(LS_MEMO_CONTENT) : null;
    const orderTime = parseInt(
      (typeof window !== 'undefined' && localStorage.getItem(LS_MEMO_TIME)) || '0',
    );
    if (!memoPrefix || !orderTime) {
      setPulseState('none');
      return;
    }

    const ageMin = (Date.now() - orderTime) / 60_000;
    const TWO_HOURS = 120;
    const ACTIVE_POLL_MS = 15_000;
    const PASSIVE_POLL_MS = 60_000;

    // Fulfilled window: solid green for 10 min after first fulfillment detection.
    const fulfilledAt = parseInt(localStorage.getItem(LS_FULFILLED_AT) || '0');
    if (fulfilledAt > 0) {
      const sinceDetected = (Date.now() - fulfilledAt) / 60_000;
      if (sinceDetected < 10) {
        setPulseState('green-solid');
        schedule(PASSIVE_POLL_MS);
        return;
      }
      localStorage.removeItem(LS_MEMO_CONTENT);
      localStorage.removeItem(LS_MEMO_TIME);
      localStorage.removeItem(LS_FULFILLED_AT);
      localStorage.removeItem(LS_CONFIRMED_FOR);
      setPulseState('none');
      return;
    }

    // Auto-cleanup if we've been tracking for >2h with nothing to show.
    if (ageMin > TWO_HOURS) {
      localStorage.removeItem(LS_MEMO_CONTENT);
      localStorage.removeItem(LS_MEMO_TIME);
      localStorage.removeItem(LS_CONFIRMED_FOR);
      setPulseState('none');
      return;
    }

    try {
      const since = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const res = await fetch(
        `/api/transfers/check-mine?memo_prefix=${encodeURIComponent(memoPrefix)}&since=${since}`,
      );
      if (!res.ok) {
        schedule(5_000);
        return;
      }
      const data = await res.json();

      if (!data.found) {
        setPulseState(ageMin < 20 ? 'blue' : 'red');
        schedule(PASSIVE_POLL_MS);
        return;
      }

      // First time we see the transfer for this memo: authoritative "order
      // landed" signal. Fire the callback once and mark the prefix as confirmed.
      const alreadyConfirmed = localStorage.getItem(LS_CONFIRMED_FOR) === memoPrefix;
      if (!alreadyConfirmed) {
        localStorage.setItem(LS_CONFIRMED_FOR, memoPrefix);
        try { onOrderConfirmedRef.current?.(); } catch (err) {
          console.warn('[wallet-pulse] onOrderConfirmed threw:', err);
        }
      }

      if (data.fulfilled) {
        localStorage.setItem(LS_FULFILLED_AT, Date.now().toString());
        setPulseState('green-solid');
        schedule(PASSIVE_POLL_MS);
        return;
      }

      if (ageMin < 20) setPulseState('green');
      else if (ageMin < 30) setPulseState('green-slow');
      else setPulseState('red');
      schedule(ACTIVE_POLL_MS);
    } catch {
      schedule(5_000);
    }
  }, [schedule]);

  const pulseCheckRef = useRef(pulseCheck);
  useEffect(() => { pulseCheckRef.current = pulseCheck; }, [pulseCheck]);

  // Start polling on mount — inherits any LS state from a previous session.
  useEffect(() => {
    startupTimerRef.current = setTimeout(() => { pulseCheckRef.current(); }, 9_000);

    // Fast-path re-check when the tab comes back into focus: the user is most
    // likely returning from Keychain/Ecency and the transfer has just landed.
    // Without this, cart-clear waits for the next 15/60s poll boundary.
    const onVisible = () => {
      if (document.visibilityState === 'visible') pulseCheckRef.current();
    };
    const onFocus = () => { pulseCheckRef.current(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    return () => {
      if (startupTimerRef.current) clearTimeout(startupTimerRef.current);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const startOrderPulsing = useCallback(() => {
    localStorage.removeItem(LS_FULFILLED_AT);
    localStorage.removeItem(LS_CONFIRMED_FOR);
    setPulseState('blue');
    if (pulseTimerRef.current) { clearTimeout(pulseTimerRef.current); pulseTimerRef.current = null; }
    if (startupTimerRef.current) { clearTimeout(startupTimerRef.current); startupTimerRef.current = null; }
    startupTimerRef.current = setTimeout(() => { pulseCheckRef.current(); }, 9_000);
  }, []);

  const resetPulse = useCallback(() => {
    localStorage.removeItem(LS_MEMO_CONTENT);
    localStorage.removeItem(LS_MEMO_TIME);
    localStorage.removeItem(LS_FULFILLED_AT);
    localStorage.removeItem(LS_CONFIRMED_FOR);
    setPulseState('none');
    if (pulseTimerRef.current) { clearTimeout(pulseTimerRef.current); pulseTimerRef.current = null; }
  }, []);

  return { pulseState, startOrderPulsing, resetPulse };
}

/**
 * Provider mounted inside `CartProvider`. Exposes pulse state + controls to
 * all downstream consumers (CartSheet → `startOrderPulsing`, InnopayChrome →
 * `pulseState`/`resetPulse`). `onOrderConfirmed` is wired to `clearCart()`
 * here — transfer lands in DB → cart is authoritatively cleared.
 */
export function WalletPulseProvider({ children }: { children: ReactNode }) {
  const { clearCart } = useCart();
  const machine = useWalletPulseMachine({ onOrderConfirmed: clearCart });

  const value = useMemo<WalletPulseContextValue>(
    () => ({
      pulseState: machine.pulseState,
      startOrderPulsing: machine.startOrderPulsing,
      resetPulse: machine.resetPulse,
    }),
    [machine.pulseState, machine.startOrderPulsing, machine.resetPulse],
  );

  return <WalletPulseContext.Provider value={value}>{children}</WalletPulseContext.Provider>;
}

export function useWalletPulse(): WalletPulseContextValue {
  const ctx = useContext(WalletPulseContext);
  if (!ctx) {
    // Graceful degradation — returning a no-op lets components be tested in
    // isolation without wrapping them in the provider.
    return {
      pulseState: 'none',
      startOrderPulsing: () => {},
      resetPulse: () => {},
    };
  }
  return ctx;
}
