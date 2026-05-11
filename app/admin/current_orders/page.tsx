/**
 * Admin CO (Current Orders) page for millewee.
 *
 * Polls merchant-hub for new transfers every 6s, hydrates memos against the menu,
 * groups multi-leg payments (EURO + optional HBD) by Distriate identifier, rings a
 * bell on new arrivals, auto-prints thermal tickets, and exposes a single "Servi"
 * button to mark fulfilled.
 *
 * MVP scope (kept intentionally lean):
 *   - no delayed orders (data model supports P@/T@ timing but not displayed here)
 *
 * Call-waiter transfers are rendered with a red pulsing card and are never grouped.
 *
 * Sound model:
 *   - Global sound on/off. Enabling plays a confirmation bell so the user knows audio works.
 *   - On arrival of a new transfer, the bell rings once and a 30s per-order reminder starts.
 *   - Each card has its own mute button; muting stops that order's reminder only.
 *
 * Merchant-hub poller election:
 *   - On mount we call /api/wake-up to join the single-poller election. If we win,
 *     a 6s /api/poll loop keeps HAF fresh and refreshes the heartbeat. If we lose,
 *     we just sync locally from Redis — another CO page is driving HAF.
 *   - We re-run /api/wake-up every 30s. This reclaims the poller role if the
 *     previous winner's tab died (heartbeat goes stale, its lock TTL expires).
 *
 * Zombie-tab protection (3 layers):
 *   1. Opening-hours gate: outside restaurant hours, ALL polling stops. A dormant
 *      banner is shown. A 60s check restarts polling when hours resume.
 *   2. Adaptive backoff: after 5 min of no new orders the poll interval grows from
 *      6s → 30s; after 15 min → 60s. Any new order resets to 6s instantly.
 *   3. Page Visibility API: when the tab is hidden (backgrounded, phone locked),
 *      polling pauses entirely. On return to visible, an immediate sync fires and
 *      normal polling resumes.
 */

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Bell, BellOff, History, LogOut, Loader2, Printer, VolumeX, Volume2 } from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import {
  hydrateMemo,
  extractDistriateIdentifier,
  type HydratedOrderLine,
  type MenuDataForHydration,
} from '@/lib/innopay/utils';
import { isRestaurantOpenNow } from '@/lib/config/kitchen-hours';
import { generateReceiptHtml } from '@/lib/print-utils';

interface RawTransfer {
  id: string;
  from_account: string;
  to_account: string;
  amount: string;
  symbol: string;
  memo: string;
  received_at: string;
}

interface Transfer extends RawTransfer {
  parsedMemo: HydratedOrderLine[];
  isCallWaiter: boolean;
  table: string | null;
  hydrationWarnings: string[];
}

interface GroupedOrder {
  key: string;
  transfers: Transfer[];
  primary: Transfer;
  secondary?: Transfer;
  allIds: string[];
}

const POLL_MS = 6000;
const POLL_MS_SLOW = 30_000;
const POLL_MS_SLOWER = 60_000;
const IDLE_SLOW_AFTER = 50;    // 50 × 6s = 5 min → switch to 30s
const IDLE_SLOWER_AFTER = 150;  // ~15 min total → switch to 60s
const HOURS_CHECK_MS = 60_000;
const WAKE_UP_MS = 30_000;
const SHOP_ID = 'millewee-current-orders';
const REMINDER_MS = 30000;
const LATE_THRESHOLD_MS = 10 * 60 * 1000;
const CALL_WAITER_HINT = /appel|serveur|waiter|kellner/i;

type PauseReason = 'none' | 'closed' | 'hidden';

function getMerchantHubUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MERCHANT_HUB_URL || 'https://merchant-hub-theta.vercel.app'
  ).replace(/\/$/, '');
}

function detectCallWaiter(memo: string): boolean {
  const tableIdx = memo.lastIndexOf('TABLE ');
  const prefix = tableIdx !== -1 ? memo.substring(0, tableIdx) : memo;
  return CALL_WAITER_HINT.test(prefix);
}

function formatReceivedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTableFromMemo(memo: string): string | null {
  const match = memo.match(/TABLE\s+(\d+)/i);
  return match ? match[1] : null;
}

function getPrintKey(transfer: Transfer): string {
  return extractDistriateIdentifier(transfer.memo) || transfer.memo || transfer.id;
}

function getMissingMenuWarnings(orderContent: string, menuData: MenuDataForHydration | null): string[] {
  if (!menuData?.loaded) return [];

  const warnings: string[] = [];
  const seen = new Set<string>();
  const matches = orderContent.matchAll(/\b([db]):(\d+)\b/g);

  for (const match of matches) {
    const type = match[1];
    const id = Number(match[2]);
    const key = `${type}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (type === 'd' && !menuData.dishes.has(id)) {
      warnings.push(`Plat #${id} introuvable dans la base menu`);
    } else if (type === 'b' && !menuData.drinks.has(id)) {
      warnings.push(`Boisson #${id} introuvable dans la base menu`);
    }
  }

  return warnings;
}

export default function CurrentOrdersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [menuData, setMenuData] = useState<MenuDataForHydration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<string>('');
  const [audioOn, setAudioOn] = useState(false);
  const [printingOn, setPrintingOn] = useState(false);
  const [mutedOrders, setMutedOrders] = useState<Set<string>>(new Set());

  const [isPoller, setIsPoller] = useState(false);
  const [pollerStatus, setPollerStatus] = useState<string>('');
  const [pauseReason, setPauseReason] = useState<PauseReason>('none');

  const bellRef = useRef<HTMLAudioElement | null>(null);
  const previousIdsRef = useRef<Set<string>>(new Set());
  const audioOnRef = useRef(audioOn);
  const printingOnRef = useRef(printingOn);
  const mutedOrdersRef = useRef(mutedOrders);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hafPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeUpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hoursCheckTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reminderTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const printedRef = useRef<Set<string>>(new Set());
  const printIframeRef = useRef<HTMLIFrameElement>(null);
  const printQueueRef = useRef<Promise<void>>(Promise.resolve());
  const printOrderRef = useRef<(transfer: Transfer) => boolean>(() => false);
  const idleCyclesRef = useRef(0);
  const currentIntervalRef = useRef(POLL_MS);
  const pausedRef = useRef(false);
  const menuDataRef = useRef<MenuDataForHydration | null>(null);

  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    audioOnRef.current = audioOn;
  }, [audioOn]);

  useEffect(() => {
    printingOnRef.current = printingOn;
  }, [printingOn]);

  useEffect(() => {
    mutedOrdersRef.current = mutedOrders;
  }, [mutedOrders]);

  useEffect(() => {
    menuDataRef.current = menuData;
  }, [menuData]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Absolute-origin URL avoids any edge cases where `new Audio('/sounds/...')`
      // resolves against a non-origin document baseURI (iframe, srcdoc, etc.).
      const src = `${window.location.origin}/sounds/bell.mp3`;
      const audio = new Audio();
      audio.preload = 'auto';
      // Diagnostic: when Audio.play() rejects with NotSupportedError, the real
      // failure reason is on the element's `error` property, not in the play()
      // rejection. Capture it here so we can see *why* the source was rejected
      // (404 vs corrupt decode vs CORS vs MIME mismatch).
      audio.addEventListener('error', () => {
        const err = audio.error;
        console.warn(
          '[AUDIO] bell.mp3 failed to load:',
          err ? { code: err.code, message: err.message, src: audio.currentSrc || audio.src } : 'unknown',
        );
      });
      audio.src = src;
      audio.load();
      bellRef.current = audio;
    }
  }, []);

  // Force-play the bell regardless of the muted set. Used for:
  //   - new-order arrival (the *first* ring, before any per-order mute could exist)
  //   - sound-enable confirmation
  const ringBellNow = useCallback(() => {
    if (!audioOnRef.current || !bellRef.current) return;
    bellRef.current.currentTime = 0;
    bellRef.current.play().catch((e) => console.warn('[AUDIO] play failed:', e));
  }, []);

  // Ring only if the specific order hasn't been muted. Used by the 30s reminders.
  const ringBellForOrder = useCallback((orderId: string) => {
    if (!audioOnRef.current || !bellRef.current) return;
    if (mutedOrdersRef.current.has(orderId)) return;
    bellRef.current.currentTime = 0;
    bellRef.current.play().catch((e) => console.warn('[AUDIO] play failed:', e));
  }, []);

  const toggleAudio = useCallback(() => {
    setAudioOn((prev) => {
      const next = !prev;
      if (next && bellRef.current) {
        // Confirmation ring so the user knows audio works and has been granted by the browser.
        bellRef.current.currentTime = 0;
        bellRef.current.play().catch((e) => console.warn('[AUDIO] enable-confirm play failed:', e));
      }
      return next;
    });
  }, []);

  const togglePrinting = useCallback(() => {
    setPrintingOn((prev) => !prev);
  }, []);

  const enqueuePrint = useCallback((html: string) => {
    printQueueRef.current = printQueueRef.current.then(() => new Promise<void>((resolve) => {
      if (!printIframeRef.current) {
        resolve();
        return;
      }

      const iframe = printIframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc || !iframe.contentWindow) {
        resolve();
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        const win = iframe.contentWindow;
        if (!win) {
          resolve();
          return;
        }

        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          win.removeEventListener('afterprint', done);
          resolve();
        };

        win.addEventListener('afterprint', done);
        setTimeout(done, 3000);
        win.focus();
        win.print();
      }, 500);
    }));
  }, []);

  const printOrder = useCallback((transfer: Transfer) => {
    const isHydrated =
      transfer.parsedMemo.length > 0 &&
      transfer.parsedMemo[0].type !== 'raw';

    if (!isHydrated && /\b[db]:\d+\b/.test(transfer.memo)) {
      console.warn('[PRINT] Skipping print for unhydrated codified order:', transfer.id);
      return false;
    }

    if (transfer.parsedMemo.length === 0) return false;

    const dishes = transfer.parsedMemo.filter(
      (item): item is Extract<HydratedOrderLine, { type: 'item' }> =>
        item.type === 'item' && item.categoryType === 'dish',
    );
    const drinks = transfer.parsedMemo.filter(
      (item): item is Extract<HydratedOrderLine, { type: 'item' }> =>
        item.type === 'item' && item.categoryType === 'drink',
    );

    console.log('[PRINT] Printing order:', transfer.id);

    if (dishes.length > 0) {
      enqueuePrint(generateReceiptHtml({
        id: transfer.id,
        from_account: transfer.from_account,
        memo: transfer.memo,
        received_at: transfer.received_at,
        items: dishes,
        ticketType: 'CUISINE',
      }));
    }

    if (drinks.length > 0) {
      enqueuePrint(generateReceiptHtml({
        id: transfer.id,
        from_account: transfer.from_account,
        memo: transfer.memo,
        received_at: transfer.received_at,
        items: drinks,
        ticketType: 'BAR',
      }));
    }

    if (dishes.length === 0 && drinks.length === 0) {
      enqueuePrint(generateReceiptHtml({
        id: transfer.id,
        from_account: transfer.from_account,
        memo: transfer.memo,
        received_at: transfer.received_at,
        items: transfer.parsedMemo,
        ticketType: 'CUISINE',
      }));
    }

    return true;
  }, [enqueuePrint]);

  useEffect(() => {
    printOrderRef.current = printOrder;
  }, [printOrder]);

  // --- Menu fetch for memo hydration ---
  useEffect(() => {
    let cancelled = false;

    async function loadMenu() {
      try {
        const [dishesRes, drinksRes] = await Promise.all([
          fetch('/api/admin/dishes', { cache: 'no-store' }),
          fetch('/api/admin/drinks', { cache: 'no-store' }),
        ]);
        if (!dishesRes.ok || !drinksRes.ok) throw new Error('menu fetch failed');

        const dishesJson = await dishesRes.json();
        const drinksJson = await drinksRes.json();

        if (cancelled) return;

        const dishMap = new Map<number, { dish_id: number; name: string }>();
        for (const d of dishesJson || []) {
          dishMap.set(d.dish_id, { dish_id: d.dish_id, name: d.name_fr });
        }

        const drinkMap = new Map<number, { drink_id: number; name: string }>();
        for (const b of drinksJson || []) {
          drinkMap.set(b.drink_id, { drink_id: b.drink_id, name: b.name_fr });
        }

        setMenuData({ dishes: dishMap, drinks: drinkMap, loaded: true });
        setMenuError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[MENU] load error:', message);
        setMenuError(message);
      }
    }

    loadMenu();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Hydration helper uses current menuData (via closure through useCallback) ---
  const hydrate = useCallback(
    (raw: RawTransfer[]): Transfer[] => {
      return raw.map((tx) => {
        const currentMenuData = menuDataRef.current;
        const tableIdx = tx.memo.lastIndexOf('TABLE ');
        const orderContent = tableIdx !== -1 ? tx.memo.substring(0, tableIdx).trim() : tx.memo;
        const isCallWaiter = detectCallWaiter(tx.memo);

        let parsedMemo: HydratedOrderLine[];
        try {
          parsedMemo = hydrateMemo(orderContent, currentMenuData ?? undefined);
        } catch {
          parsedMemo = [{ type: 'raw', content: orderContent }];
        }

        return {
          ...tx,
          parsedMemo,
          isCallWaiter,
          table: getTableFromMemo(tx.memo),
          hydrationWarnings: getMissingMenuWarnings(orderContent, currentMenuData),
        };
      });
    },
    [],
  );

  // --- Re-hydrate when menu arrives ---
  useEffect(() => {
    if (menuData && transfers.length > 0) {
      const rehydrated = hydrate(transfers);
      setTransfers(rehydrated);

      for (const tx of rehydrated) {
        const printKey = getPrintKey(tx);
        if (printingOnRef.current && !tx.isCallWaiter && !printedRef.current.has(printKey)) {
          const success = printOrderRef.current(tx);
          if (success) printedRef.current.add(printKey);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuData]);

  // --- Poll loop: sync from merchant-hub, then fetch unfulfilled ---
  const syncAndReload = useCallback(async () => {
    try {
      const syncRes = await fetch('/api/transfers/sync-from-merchant-hub', { method: 'POST' });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        if (syncData.inserted > 0) {
          toast(`${syncData.inserted} nouvelle(s) commande(s)`);
        }
        // Dev-only diagnostic; skipping the setState in prod avoids a pointless re-render every 6s.
        if (isDev) setSyncInfo(`Sync: ${syncData.inserted || 0} new, ${syncData.acked || 0} acked`);
      }

      const unfulRes = await fetch('/api/transfers/unfulfilled');
      if (!unfulRes.ok) throw new Error(`unfulfilled fetch ${unfulRes.status}`);
      const { transfers: raw } = await unfulRes.json();
      const hydrated = hydrate(raw || []);

      // --- Adaptive backoff: track idle cycles ---
      const newOnes = hydrated.filter((t) => !previousIdsRef.current.has(t.id));
      if (newOnes.length > 0) {
        idleCyclesRef.current = 0;
        currentIntervalRef.current = POLL_MS;
        ringBellNow();
        for (const tx of newOnes) {
          const printKey = getPrintKey(tx);
          if (printingOnRef.current && !tx.isCallWaiter && !printedRef.current.has(printKey)) {
            const success = printOrderRef.current(tx);
            if (success) printedRef.current.add(printKey);
          }

          if (!reminderTimersRef.current.has(tx.id)) {
            const handle = setInterval(() => ringBellForOrder(tx.id), REMINDER_MS);
            reminderTimersRef.current.set(tx.id, handle);
          }
        }
      }

      // Drop reminder timers + muted flags for orders that have disappeared
      // (fulfilled elsewhere, or removed from the stream).
      const currentIds = new Set(hydrated.map((t) => t.id));
      for (const [orderId, handle] of reminderTimersRef.current.entries()) {
        if (!currentIds.has(orderId)) {
          clearInterval(handle);
          reminderTimersRef.current.delete(orderId);
        }
      }
      setMutedOrders((prev) => {
        let changed = false;
        const next = new Set<string>();
        for (const id of prev) {
          if (currentIds.has(id)) next.add(id);
          else changed = true;
        }
        return changed ? next : prev;
      });

      previousIdsRef.current = currentIds;
      // Skip the setState (and the resulting full-list re-render) when the poll
      // returned the same set of transfers in the same order — which is the common
      // case every 6s. Cuts dev-mode reconciliation cost dramatically.
      setTransfers((prev) => {
        if (
          prev.length === hydrated.length &&
          prev.every((p, i) =>
            p.id === hydrated[i].id &&
            p.memo === hydrated[i].memo &&
            JSON.stringify(p.parsedMemo) === JSON.stringify(hydrated[i].parsedMemo) &&
            p.hydrationWarnings.join('|') === hydrated[i].hydrationWarnings.join('|'),
          )
        ) {
          return prev;
        }
        return hydrated;
      });
      setError(null);

      // Adaptive backoff: if no new orders, progressively slow down
      if (newOnes.length === 0) {
        idleCyclesRef.current++;
        if (idleCyclesRef.current >= IDLE_SLOWER_AFTER) {
          currentIntervalRef.current = POLL_MS_SLOWER;
        } else if (idleCyclesRef.current >= IDLE_SLOW_AFTER) {
          currentIntervalRef.current = POLL_MS_SLOW;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SYNC] error:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [hydrate, isDev, ringBellNow, ringBellForOrder]);

  // Single-poller election. Only one CO page (across all spokes) drives the HAF
  // poll loop at any given time — the others just consume from Redis. This keeps
  // HAF load bounded regardless of how many kitchen tablets are open.
  const triggerHafPoll = useCallback(async () => {
    const hubUrl = getMerchantHubUrl();
    try {
      const res = await fetch(`${hubUrl}/api/poll`);
      if (res.ok) {
        const data = await res.json();
        if (isDev) console.log(`[POLL] HAF poll: ${data.transfersFound ?? 0} transfers found`);
      }
    } catch (err) {
      console.error('[POLL] HAF poll error:', err instanceof Error ? err.message : err);
    }
  }, [isDev]);

  const triggerWakeUp = useCallback(async () => {
    const hubUrl = getMerchantHubUrl();
    try {
      const res = await fetch(`${hubUrl}/api/wake-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: SHOP_ID }),
      });
      if (!res.ok) {
        console.warn(`[WAKE-UP] Failed: ${res.status}`);
        return;
      }
      const data = await res.json();
      if (data.shouldStartPolling) {
        setIsPoller(true);
        setPollerStatus(`Poller actif (${SHOP_ID})`);
        if (!hafPollTimerRef.current) {
          triggerHafPoll();
          hafPollTimerRef.current = setInterval(triggerHafPoll, POLL_MS);
        }
      } else {
        setIsPoller(false);
        setPollerStatus(`Poller: ${data.poller || 'inconnu'}`);
        if (hafPollTimerRef.current) {
          clearInterval(hafPollTimerRef.current);
          hafPollTimerRef.current = null;
        }
      }
    } catch (err) {
      console.error('[WAKE-UP] Error:', err instanceof Error ? err.message : err);
    }
  }, [triggerHafPoll]);

  // --- Polling orchestrator: start/stop all loops based on pause state ---

  const clearAllTimers = useCallback(() => {
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
    if (hafPollTimerRef.current) { clearInterval(hafPollTimerRef.current); hafPollTimerRef.current = null; }
    if (wakeUpTimerRef.current) { clearInterval(wakeUpTimerRef.current); wakeUpTimerRef.current = null; }
    reminderTimersRef.current.forEach((h) => clearInterval(h));
    reminderTimersRef.current.clear();
  }, []);

  const startPolling = useCallback(() => {
    if (pausedRef.current) return;
    // Wake-up loop (poller election)
    triggerWakeUp();
    wakeUpTimerRef.current = setInterval(triggerWakeUp, WAKE_UP_MS);
    // Sync+reload loop using chained setTimeout for dynamic interval
    function scheduleNext() {
      pollTimerRef.current = setTimeout(async () => {
        await syncAndReload();
        if (!pausedRef.current) scheduleNext();
      }, currentIntervalRef.current);
    }
    syncAndReload();
    scheduleNext();
  }, [triggerWakeUp, syncAndReload]);

  const pausePolling = useCallback((reason: PauseReason) => {
    pausedRef.current = true;
    setPauseReason(reason);
    clearAllTimers();
    console.warn(`[CO] Polling paused: ${reason}`);
  }, [clearAllTimers]);

  const resumePolling = useCallback(() => {
    pausedRef.current = false;
    setPauseReason('none');
    idleCyclesRef.current = 0;
    currentIntervalRef.current = POLL_MS;
    console.warn('[CO] Polling resumed');
    startPolling();
  }, [startPolling]);

  // Layer 1: Opening-hours gate
  useEffect(() => {
    function checkHours() {
      const open = isRestaurantOpenNow();
      if (!open && !pausedRef.current) {
        pausePolling('closed');
      } else if (open && pausedRef.current && pauseReason === 'closed') {
        resumePolling();
      }
    }
    checkHours();
    hoursCheckTimerRef.current = setInterval(checkHours, HOURS_CHECK_MS);
    return () => {
      if (hoursCheckTimerRef.current) clearInterval(hoursCheckTimerRef.current);
    };
  }, [pausePolling, resumePolling, pauseReason]);

  // Layer 3: Page Visibility API
  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) {
        // Only pause for visibility if not already paused for hours
        if (!pausedRef.current) pausePolling('hidden');
      } else {
        if (pauseReason === 'hidden') {
          // Check hours before resuming — tab may have been hidden overnight
          if (isRestaurantOpenNow()) {
            resumePolling();
          } else {
            setPauseReason('closed');
          }
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [pausePolling, resumePolling, pauseReason]);

  // Initial start (only if restaurant is open and tab is visible)
  useEffect(() => {
    if (isRestaurantOpenNow() && !document.hidden) {
      startPolling();
    } else if (!isRestaurantOpenNow()) {
      pausedRef.current = true;
      setPauseReason('closed');
    } else {
      pausedRef.current = true;
      setPauseReason('hidden');
    }
    return () => clearAllTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Group by Distriate identifier so EURO + HBD legs share one card ---
  const groupedOrders = useMemo((): GroupedOrder[] => {
    const groups = new Map<string, Transfer[]>();
    for (const t of transfers) {
      const key = t.isCallWaiter
        ? `call-waiter-${t.id}`
        : extractDistriateIdentifier(t.memo) || t.memo || `no-memo-${t.id}`;
      const arr = groups.get(key);
      if (arr) arr.push(t);
      else groups.set(key, [t]);
    }
    return Array.from(groups.entries()).map(([key, arr]) => {
      const primary = arr.find((t) => t.symbol === 'EURO') || arr[0];
      const secondary = arr.find((t) => t !== primary);
      return { key, transfers: arr, primary, secondary, allIds: arr.map((t) => t.id) };
    });
  }, [transfers]);

  // --- Fulfill: mark every transfer in the group as served ---
  const handleFulfill = async (allIds: string[]) => {
    try {
      for (const id of allIds) {
        const res = await fetch('/api/fulfill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (!res.ok && res.status !== 404) {
          toast.error(`Erreur inattendue (${res.status}) — reessayez dans quelques secondes`);
          return;
        }
        const handle = reminderTimersRef.current.get(id);
        if (handle) {
          clearInterval(handle);
          reminderTimersRef.current.delete(id);
        }
      }
      setTransfers((prev) => prev.filter((t) => !allIds.includes(t.id)));
      setMutedOrders((prev) => {
        if (!allIds.some((id) => prev.has(id))) return prev;
        const next = new Set(prev);
        for (const id of allIds) next.delete(id);
        return next;
      });
      toast.success(`Commande servie`);
    } catch (err) {
      console.error('[FULFILL] error:', err);
      toast.error('Erreur lors de la fulfillment');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    window.location.href = '/admin/login';
  };

  return (
    <div>
      <AdminHeader />
      <iframe
        ref={printIframeRef}
        style={{ position: 'absolute', top: '-1000px', left: '-1000px', width: '0', height: '0' }}
        title="print-frame"
      />
      <div className="max-w-4xl mx-auto p-4">
        <header className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h1 className="text-xl font-semibold text-gray-900">Commandes en cours</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={audioOn ? 'secondary' : 'default'}
              onClick={toggleAudio}
              className={audioOn ? '' : 'bg-[#8B0000] hover:bg-[#600000] text-white'}
            >
              {audioOn ? <BellOff className="h-4 w-4 mr-1" /> : <Bell className="h-4 w-4 mr-1" />}
              {audioOn ? 'Couper le son' : 'Activer le son'}
            </Button>
            <Button
              size="sm"
              variant={printingOn ? 'secondary' : 'default'}
              onClick={togglePrinting}
              aria-pressed={printingOn}
              className={printingOn ? '' : 'bg-[#8B0000] hover:bg-[#600000] text-white'}
            >
              <Printer className="h-4 w-4 mr-1" />
              {printingOn ? 'Arrêter impression' : 'Activer impression'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Sortir
            </Button>
            <Link href="/admin/history" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <History className="h-4 w-4 mr-1" />
              Historique
            </Link>
          </div>
        </header>

      {pauseReason === 'closed' && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 px-4 py-3 rounded mb-3 text-sm">
          <strong>Restaurant ferm&eacute;</strong> &mdash; le polling est en pause.
          Il reprendra automatiquement &agrave; l&rsquo;ouverture.
        </div>
      )}
      {pauseReason === 'hidden' && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mb-3 text-sm">
          <strong>Onglet en arri&egrave;re-plan</strong> &mdash; le polling est en pause.
          Il reprendra quand cet onglet redeviendra visible.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 px-3 py-2 rounded mb-3 text-sm">
          Erreur: {error}
        </div>
      )}
      {menuError && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 px-3 py-2 rounded mb-3 text-sm">
          Attention: impossible de charger les noms des plats/boissons depuis la base menu ({menuError}).
          Les commandes peuvent afficher des libell&eacute;s techniques comme &laquo;&nbsp;Plat #3&nbsp;&raquo;.
        </div>
      )}
      {isDev && (syncInfo || pollerStatus) && (
        <div className="text-xs mb-2 inline-block bg-gray-100 px-2 py-1 rounded space-x-2">
          {pollerStatus && (
            <span className={isPoller ? 'text-green-700 font-bold' : 'text-gray-600'}>
              {pollerStatus}
            </span>
          )}
          {syncInfo && <span className="text-gray-500">{syncInfo}</span>}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 py-6">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement des commandes...
        </div>
      )}

      {!loading && (
        <div className="mb-3 text-base font-semibold text-gray-900">
          {groupedOrders.length === 0
            ? 'Pas de commandes en attente'
            : `${groupedOrders.length} commande${groupedOrders.length > 1 ? 's' : ''} en cours`}
          {isDev && groupedOrders.length !== transfers.length && (
            <span className="ml-2 text-xs font-normal text-blue-600">
              ({transfers.length} transferts)
            </span>
          )}
        </div>
      )}

      <ul className="space-y-3">
        {groupedOrders.map((group) => {
          const { primary, secondary, allIds } = group;
          const receivedMs = new Date(primary.received_at).getTime();
          const isLate = Date.now() - receivedMs > LATE_THRESHOLD_MS;
          const cardClass = primary.isCallWaiter
            ? 'bg-red-50 border-red-500 border-2 animate-pulse'
            : isLate
              ? 'bg-red-100 border-red-400 border-2'
              : 'bg-white border-gray-200 border';

          return (
            <li key={group.key} className={`rounded-lg p-4 shadow-sm ${cardClass}`}>
              <div className="mb-2">
                <div className="text-xs font-semibold text-gray-600 mb-1">Commande</div>
                <div className={primary.isCallWaiter ? 'text-red-700 font-bold' : 'text-gray-900'}>
                  {primary.parsedMemo.map((line, idx) => (
                    <React.Fragment key={idx}>
                      {line.type === 'item' ? (
                        <div className="grid grid-cols-[auto_1fr] gap-2 items-baseline text-sm">
                          <span className="font-bold text-gray-700">{line.quantity}&times;</span>
                          <span
                            className={
                              line.categoryType === 'drink'
                                ? 'text-green-700 font-semibold'
                                : 'text-red-900 font-semibold'
                            }
                          >
                            {line.description}
                            {line.comment && (
                              <span className="font-normal italic text-gray-600 text-xs">
                                {' '}
                                &mdash; {line.comment}
                              </span>
                            )}
                          </span>
                        </div>
                      ) : line.type === 'separator' ? (
                        <hr className="my-1 border-dashed border-gray-300" />
                      ) : (
                        <div className="text-sm">{line.content}</div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                {primary.hydrationWarnings.length > 0 && (
                  <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                    Attention: {primary.hydrationWarnings.join(' ; ')}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs text-gray-700 mb-2">
                <div>
                  <div className="uppercase text-[10px] text-gray-500 tracking-wider">Table</div>
                  <div className="font-semibold">{primary.table || '-'}</div>
                </div>
                <div>
                  <div className="uppercase text-[10px] text-gray-500 tracking-wider">Heure</div>
                  <div
                    className={`font-semibold ${isLate ? 'text-red-600' : 'text-green-700'}`}
                  >
                    {formatReceivedTime(primary.received_at)}
                  </div>
                </div>
                <div>
                  <div className="uppercase text-[10px] text-gray-500 tracking-wider">Client</div>
                  <div className="font-mono text-[11px] text-blue-700 truncate">
                    @{primary.from_account || 'inconnu'}
                  </div>
                </div>
                {isDev && (
                  <>
                    <div>
                      <div className="uppercase text-[10px] text-gray-500 tracking-wider">
                        Montant
                      </div>
                      <div className="font-semibold">
                        {primary.amount} {primary.symbol}
                        {secondary && (
                          <div className="text-[10px] text-gray-500">
                            + {secondary.amount} {secondary.symbol}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="uppercase text-[10px] text-gray-500 tracking-wider">
                        Destinataire
                      </div>
                      <div className="font-mono text-[11px] text-blue-700 truncate">
                        @{primary.to_account || '-'}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {isDev && (
                <div className="text-[10px] text-gray-400 border-t border-gray-100 pt-1 mb-2">
                  ID: <strong>{allIds.join(', ')}</strong>
                  {allIds.length > 1 && (
                    <span className="ml-2">({allIds.length} transferts groupés)</span>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const success = printOrder(primary);
                    if (success) printedRef.current.add(getPrintKey(primary));
                  }}
                  className="px-3"
                  aria-label="Imprimer la commande"
                  title="Imprimer"
                >
                  <Printer className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleFulfill(allIds)}
                  className="flex-1 bg-[#d4a24e] hover:bg-[#b88a3e] text-white"
                >
                  Servi !
                </Button>
                {audioOn && (() => {
                  const groupMuted = allIds.every((id) => mutedOrders.has(id));
                  return (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Flip the whole group atomically to keep the button state coherent
                        setMutedOrders((prev) => {
                          const next = new Set(prev);
                          if (groupMuted) {
                            for (const id of allIds) next.delete(id);
                          } else {
                            for (const id of allIds) next.add(id);
                          }
                          return next;
                        });
                        // Unmuting: confirm audibly + reset each reminder cycle so the
                        // next auto-ring is 30s from now, not some partial leftover phase.
                        if (groupMuted) {
                          ringBellNow();
                          for (const id of allIds) {
                            const old = reminderTimersRef.current.get(id);
                            if (old) clearInterval(old);
                            const handle = setInterval(() => ringBellForOrder(id), REMINDER_MS);
                            reminderTimersRef.current.set(id, handle);
                          }
                        }
                      }}
                      aria-label={groupMuted ? 'Reactiver le son pour cette commande' : 'Couper le son pour cette commande'}
                      title={groupMuted ? 'Reactiver le son' : 'Couper le son'}
                    >
                      {groupMuted ? (
                        <Volume2 className="h-4 w-4" />
                      ) : (
                        <VolumeX className="h-4 w-4" />
                      )}
                    </Button>
                  );
                })()}
              </div>
            </li>
          );
        })}
      </ul>
      </div>
    </div>
  );
}
