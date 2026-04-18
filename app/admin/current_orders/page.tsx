/**
 * Admin CO (Current Orders) page for millewee.
 *
 * Polls merchant-hub for new transfers every 6s, hydrates memos against the menu,
 * groups multi-leg payments (EURO + optional HBD) by Distriate identifier, rings a
 * bell on new arrivals, and exposes a single "Servi" button to mark fulfilled.
 *
 * MVP scope (kept intentionally lean):
 *   - no thermal printer (no printing logic)
 *   - no delayed orders (data model supports P@/T@ timing but not displayed here)
 *   - no poller rotation (single instance drains the stream)
 *
 * Call-waiter transfers are rendered with a red pulsing card and are never grouped.
 *
 * Sound model:
 *   - Global sound on/off. Enabling plays a confirmation bell so the user knows audio works.
 *   - On arrival of a new transfer, the bell rings once and a 30s per-order reminder starts.
 *   - Each card has its own mute button; muting stops that order's reminder only.
 *
 * Merchant-hub wake-up:
 *   - On page mount we hit merchant-hub /api/poll once to wake it up immediately,
 *     instead of waiting up to 5 min for the Vercel cron fallback. (Relevant mostly in
 *     dev or after an idle period — in a busy restaurant the active poller is always hot.)
 */

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Home, LogOut, Loader2, VolumeX, Volume2 } from 'lucide-react';
import Link from 'next/link';
import {
  hydrateMemo,
  extractDistriateIdentifier,
  type HydratedOrderLine,
  type MenuDataForHydration,
} from '@/lib/innopay/utils';

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
}

interface GroupedOrder {
  key: string;
  transfers: Transfer[];
  primary: Transfer;
  secondary?: Transfer;
  allIds: string[];
}

const POLL_MS = 6000;
const REMINDER_MS = 30000;
const LATE_THRESHOLD_MS = 10 * 60 * 1000;
const CALL_WAITER_HINT = /appel|serveur|waiter|kellner/i;

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

export default function CurrentOrdersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [menuData, setMenuData] = useState<MenuDataForHydration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<string>('');
  const [audioOn, setAudioOn] = useState(false);
  const [mutedOrders, setMutedOrders] = useState<Set<string>>(new Set());

  const bellRef = useRef<HTMLAudioElement | null>(null);
  const previousIdsRef = useRef<Set<string>>(new Set());
  const audioOnRef = useRef(audioOn);
  const mutedOrdersRef = useRef(mutedOrders);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reminderTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    audioOnRef.current = audioOn;
  }, [audioOn]);

  useEffect(() => {
    mutedOrdersRef.current = mutedOrders;
  }, [mutedOrders]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      bellRef.current = new Audio('/sounds/bell.mp3');
      bellRef.current.load();
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

  // --- Menu fetch for memo hydration ---
  useEffect(() => {
    let cancelled = false;

    async function loadMenu() {
      try {
        const [dishesRes, drinksRes] = await Promise.all([
          fetch('/api/menu/dishes'),
          fetch('/api/menu/drinks'),
        ]);
        if (!dishesRes.ok || !drinksRes.ok) throw new Error('menu fetch failed');

        const dishesJson = await dishesRes.json();
        const drinksJson = await drinksRes.json();

        if (cancelled) return;

        const dishMap = new Map<number, { dish_id: number; name: string }>();
        for (const d of dishesJson.dishes || []) {
          dishMap.set(d.dish_id, { dish_id: d.dish_id, name: d.name_fr });
        }

        const drinkMap = new Map<number, { drink_id: number; name: string }>();
        for (const b of drinksJson.drinks || []) {
          drinkMap.set(b.drink_id, { drink_id: b.drink_id, name: b.name_fr });
        }

        setMenuData({ dishes: dishMap, drinks: drinkMap, loaded: true });
      } catch (err) {
        console.error('[MENU] load error:', err);
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
        const tableIdx = tx.memo.lastIndexOf('TABLE ');
        const orderContent = tableIdx !== -1 ? tx.memo.substring(0, tableIdx).trim() : tx.memo;
        const isCallWaiter = detectCallWaiter(tx.memo);

        let parsedMemo: HydratedOrderLine[];
        try {
          parsedMemo = hydrateMemo(orderContent, menuData ?? undefined);
        } catch {
          parsedMemo = [{ type: 'raw', content: orderContent }];
        }

        return {
          ...tx,
          parsedMemo,
          isCallWaiter,
          table: getTableFromMemo(tx.memo),
        };
      });
    },
    [menuData],
  );

  // --- Re-hydrate when menu arrives ---
  useEffect(() => {
    if (menuData && transfers.length > 0) {
      setTransfers((prev) => hydrate(prev));
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
        setSyncInfo(`Sync: ${syncData.inserted || 0} new, ${syncData.acked || 0} acked`);
      }

      const unfulRes = await fetch('/api/transfers/unfulfilled');
      if (!unfulRes.ok) throw new Error(`unfulfilled fetch ${unfulRes.status}`);
      const { transfers: raw } = await unfulRes.json();
      const hydrated = hydrate(raw || []);

      const newOnes = hydrated.filter((t) => !previousIdsRef.current.has(t.id));
      if (newOnes.length > 0) {
        ringBellNow();
        for (const tx of newOnes) {
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
      setTransfers(hydrated);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[SYNC] error:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [hydrate, ringBellNow, ringBellForOrder]);

  // One-shot merchant-hub wake-up on mount: trigger the HAF poller immediately so
  // new transfers hit our Redis stream within seconds rather than waiting up to 5 min
  // for the Vercel cron fallback. Relevant mostly during dev or after an idle period.
  useEffect(() => {
    const merchantHubUrl = getMerchantHubUrl();
    fetch(`${merchantHubUrl}/api/poll`)
      .then((res) => {
        if (res.ok) {
          res
            .json()
            .then((data) => {
              console.warn(
                `[POLL] Wake-up poll: ${data.transfersFound ?? 0} transfers found`,
              );
            })
            .catch(() => {});
        } else {
          console.warn(`[POLL] Wake-up poll failed: ${res.status}`);
        }
      })
      .catch((err) => console.error('[POLL] Wake-up error:', err));
  }, []);

  useEffect(() => {
    syncAndReload();
    pollTimerRef.current = setInterval(syncAndReload, POLL_MS);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      reminderTimersRef.current.forEach((h) => clearInterval(h));
      reminderTimersRef.current.clear();
    };
  }, [syncAndReload]);

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
          <Link href="/admin">
            <Button size="sm" variant="ghost">
              <Home className="h-4 w-4 mr-1" />
              Tableau
            </Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-1" />
            Sortir
          </Button>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 px-3 py-2 rounded mb-3 text-sm">
          Erreur: {error}
        </div>
      )}
      {isDev && syncInfo && (
        <div className="text-xs text-gray-500 mb-2 inline-block bg-gray-100 px-2 py-1 rounded">
          {syncInfo}
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
              ? 'bg-amber-50 border-amber-400 border-2'
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
  );
}
