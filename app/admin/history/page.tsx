'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw } from 'lucide-react';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  hydrateMemoFull,
  type HydratedOrderLine,
  type MenuDataForHydration,
} from '@/lib/innopay/utils';
import { isRestaurantOpenNow } from '@/lib/config/kitchen-hours';

function getMerchantHubUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MERCHANT_HUB_URL || 'https://merchant-hub-theta.vercel.app'
  ).replace(/\/$/, '');
}

interface HistoryOrder {
  id: string;
  from_account: string;
  to_account: string;
  amount: string;
  symbol: string;
  memo: string | null;
  parsed_memo: string | null;
  received_at: string | null;
  fulfilled_at: string | null;
}

interface HydratedHistoryOrder extends HistoryOrder {
  lines: HydratedOrderLine[];
  table: string | null;
  tip: string | null;
  dateKey: string;
  dateLabel: string;
  timeLabel: string;
}

function localDateKey(iso: string | null): string {
  if (!iso) return 'unknown';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date(iso));
}

function formatDateLabel(iso: string | null): string {
  if (!iso) return 'Date inconnue';
  return new Date(iso).toLocaleDateString('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTimeLabel(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getOrderContent(memo: string | null): string {
  const safeMemo = memo || '';
  const tableIndex = safeMemo.lastIndexOf('TABLE ');
  return tableIndex !== -1 ? safeMemo.substring(0, tableIndex).trim() : safeMemo;
}

export default function HistoryPage() {
  const [orders, setOrders] = useState<HydratedHistoryOrder[]>([]);
  const [menuData, setMenuData] = useState<MenuDataForHydration | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [daysLoaded, setDaysLoaded] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [totalDaysWithOrders, setTotalDaysWithOrders] = useState<number | null>(null);

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

        const dishes = new Map<number, { dish_id: number; name: string }>();
        for (const d of dishesJson || []) {
          dishes.set(d.dish_id, { dish_id: d.dish_id, name: d.name_fr });
        }

        const drinks = new Map<number, { drink_id: number; name: string }>();
        for (const b of drinksJson || []) {
          drinks.set(b.drink_id, { drink_id: b.drink_id, name: b.name_fr });
        }

        setMenuData({ dishes, drinks, loaded: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setMenuData({ dishes: new Map(), drinks: new Map(), loaded: false });
      }
    }

    loadMenu();
    return () => {
      cancelled = true;
    };
  }, []);

  // Merchant-hub election + sync, mirroring the CO page's robust pattern:
  //   - joins the poller election under its OWN identity ('millewee-history') and
  //     re-runs wake-up every 30s
  //   - drives the 6s HAF poll loop ONLY while it holds the poller role
  //   - pauses all loops when the tab is hidden or the restaurant is closed
  // Purpose: a kitchen tablet left on the history page keeps the HAF→Redis pipeline
  // alive and jumps back to the CO page as soon as an unfulfilled order lands.
  useEffect(() => {
    const merchantHubUrl = getMerchantHubUrl();
    const shopId = 'millewee-history';

    let paused = false;
    let wakeUpId: ReturnType<typeof setInterval> | null = null;
    let syncId: ReturnType<typeof setInterval> | null = null;
    let hafPollId: ReturnType<typeof setInterval> | null = null;

    const triggerPoll = async () => {
      try {
        await fetch(`${merchantHubUrl}/api/poll`);
      } catch { /* silent */ }
    };

    const stopHafPollLoop = () => {
      if (hafPollId) { clearInterval(hafPollId); hafPollId = null; }
    };

    const triggerWakeUp = async () => {
      try {
        const res = await fetch(`${merchantHubUrl}/api/wake-up`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shopId }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.shouldStartPolling && !paused) {
          if (!hafPollId) { triggerPoll(); hafPollId = setInterval(triggerPoll, 6000); }
        } else {
          stopHafPollLoop();
        }
      } catch { /* silent */ }
    };

    const syncAndCheckForNewOrders = async () => {
      try {
        await fetch('/api/transfers/sync-from-merchant-hub', { method: 'POST' });
        const res = await fetch('/api/transfers/unfulfilled');
        if (res.ok) {
          const data = await res.json();
          if (data.transfers && data.transfers.length > 0) {
            console.warn(`[HISTORY] ${data.transfers.length} unfulfilled order(s) detected — redirecting to CO page`);
            window.location.href = '/admin/current_orders';
          }
        }
      } catch { /* silent */ }
    };

    const startLoops = () => {
      if (wakeUpId || syncId) return; // already running
      triggerWakeUp();
      syncAndCheckForNewOrders();
      wakeUpId = setInterval(triggerWakeUp, 30_000);
      syncId = setInterval(syncAndCheckForNewOrders, 6_000);
    };

    const stopLoops = () => {
      if (wakeUpId) { clearInterval(wakeUpId); wakeUpId = null; }
      if (syncId) { clearInterval(syncId); syncId = null; }
      stopHafPollLoop();
    };

    const updatePauseState = () => {
      const shouldPause = document.hidden || !isRestaurantOpenNow();
      if (shouldPause && !paused) {
        paused = true;
        stopLoops();
      } else if (!shouldPause && paused) {
        paused = false;
        startLoops();
      }
    };

    document.addEventListener('visibilitychange', updatePauseState);
    const hoursId = setInterval(updatePauseState, 60_000);

    if (!document.hidden && isRestaurantOpenNow()) {
      startLoops();
    } else {
      paused = true;
    }

    return () => {
      document.removeEventListener('visibilitychange', updatePauseState);
      clearInterval(hoursId);
      stopLoops();
    };
  }, []);

  const hydrateOrder = useCallback((order: HistoryOrder): HydratedHistoryOrder => {
    const result = hydrateMemoFull(getOrderContent(order.memo), menuData ?? undefined);
    return {
      ...order,
      lines: result.lines,
      table: result.table,
      tip: result.tip,
      dateKey: localDateKey(order.fulfilled_at),
      dateLabel: formatDateLabel(order.fulfilled_at),
      timeLabel: formatTimeLabel(order.fulfilled_at),
    };
  }, [menuData]);

  const fetchOrders = useCallback(async (skipDays: number, replace = false) => {
    if (!menuData) return;
    if (skipDays === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetch(`/api/orders/history?skip=${skipDays}&days=3`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `history fetch ${res.status}`);

      if (data.totalDaysWithOrders === 0) {
        setTotalDaysWithOrders(0);
        setHasMore(false);
        setOrders([]);
        return;
      }

      const hydrated = (data.orders || []).map(hydrateOrder);
      setOrders((prev) => replace ? hydrated : [...prev, ...hydrated]);
      setHasMore(Boolean(data.hasMore));
      setDaysLoaded((prev) => replace ? (data.daysReturned || 0) : prev + (data.daysReturned || 0));

      if (replace) {
        const firstKey = hydrated[0]?.dateKey;
        setExpandedDays(firstKey ? new Set([firstKey]) : new Set());
      }
      setTotalDaysWithOrders(data.totalDaysWithOrders ?? null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [hydrateOrder, menuData]);

  useEffect(() => {
    if (menuData) fetchOrders(0, true);
  }, [fetchOrders, menuData]);

  const grouped = useMemo(() => {
    const map = new Map<string, HydratedHistoryOrder[]>();
    for (const order of orders) {
      const existing = map.get(order.dateKey);
      if (existing) existing.push(order);
      else map.set(order.dateKey, [order]);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, dayOrders]) => ({ dateKey, dateLabel: dayOrders[0].dateLabel, orders: dayOrders }));
  }, [orders]);

  const toggleDay = (dateKey: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  return (
    <div>
      <AdminHeader />
      <div className="max-w-5xl mx-auto p-4">
        <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Historique des commandes</h1>
            <p className="text-sm text-gray-500">Commandes servies, groupees par jour</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/current_orders" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Commandes en cours
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchOrders(0, true)}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Actualiser
            </Button>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-3 py-2 rounded mb-3 text-sm">
            Erreur: {error}
          </div>
        )}

        {loading && orders.length === 0 ? (
          <div className="flex items-center gap-2 text-gray-500 py-8">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement de l historique...
          </div>
        ) : grouped.length === 0 ? (
          <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
            {totalDaysWithOrders === 0 ? "Aucune commande dans l historique" : 'Aucune commande sur la periode chargee'}
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map((group) => {
              const expanded = expandedDays.has(group.dateKey);
              return (
                <section key={group.dateKey} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleDay(group.dateKey)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 text-left text-gray-900 font-semibold"
                  >
                    <span>{group.dateLabel}</span>
                    <span className="text-sm text-gray-500">
                      {group.orders.length} commande{group.orders.length > 1 ? 's' : ''} {expanded ? 'v' : '>'}
                    </span>
                  </button>

                  {expanded && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-[#fdf6e9]">
                          <tr>
                            <th className="px-3 py-2 text-left text-gray-900">Commande</th>
                            <th className="px-3 py-2 text-left text-gray-900">Client</th>
                            <th className="px-3 py-2 text-left text-gray-900">Table</th>
                            <th className="px-3 py-2 text-left text-gray-900">Heure</th>
                            <th className="px-3 py-2 text-left text-gray-900">Montant</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {group.orders.map((order) => (
                            <tr key={order.id}>
                              <td className="px-3 py-2 text-gray-900">
                                {order.lines.map((line, idx) => (
                                  <div key={idx}>
                                    {line.type === 'item' ? (
                                      <span>
                                        <strong className="mr-1">{line.quantity}x</strong>
                                        <span className={line.categoryType === 'drink' ? 'text-green-700 font-semibold' : 'text-red-900 font-semibold'}>
                                          {line.description}
                                        </span>
                                        {line.comment && <span className="text-xs italic text-gray-600"> - {line.comment}</span>}
                                      </span>
                                    ) : line.type === 'separator' ? (
                                      <hr className="my-1 border-dashed border-gray-300" />
                                    ) : (
                                      <span>{line.content}</span>
                                    )}
                                  </div>
                                ))}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs text-blue-700">@{order.from_account}</td>
                              <td className="px-3 py-2 text-gray-900">{order.table || '-'}</td>
                              <td className="px-3 py-2 text-gray-900">{order.timeLabel}</td>
                              <td className="px-3 py-2 text-gray-900">
                                {order.amount} {order.symbol}
                                {order.tip && (
                                  <div className="text-xs font-semibold text-green-700 whitespace-nowrap">
                                    💶 dont pourboire {order.tip} €
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {hasMore && grouped.length > 0 && (
          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => fetchOrders(daysLoaded)}
              disabled={loadingMore}
            >
              {loadingMore ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Charger plus
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
