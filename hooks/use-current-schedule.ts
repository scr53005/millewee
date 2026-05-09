'use client';

/**
 * Customer-side schedule cache + helpers.
 *
 * Loader (mounted once near the customer layout root) fetches /api/current-schedule
 * and writes the result into a module-level Map keyed by YYYY-MM-DD. Synchronous
 * helpers (isRestaurantOpen, isKitchenOpen, ...) read from that cache.
 *
 * Components that need their render to react to schedule updates should also call
 * useCurrentScheduleLoader() — React Query memoises per key, so repeated calls
 * don't refetch; they just subscribe.
 */

import { useQuery } from '@tanstack/react-query';

export type ServiceScope = 'restaurant' | 'kitchen';

export interface ResolvedService {
  service_id: number;
  scope: ServiceScope;
  name_fr: string;
  name_en: string;
  name_lb: string;
  open: string;  // "HH:MM"
  close: string; // "HH:MM"
}

export interface ResolvedDay {
  date: string;        // YYYY-MM-DD
  day_of_week: number; // 1=Mon ... 7=Sun (ISO 8601)
  resolved: ResolvedService[];
}

export interface TimeSlot {
  hour: number;
  minute: number;
  date: string; // YYYY-MM-DD (target day)
}

interface ApiRow {
  date: string;        // ISO datetime, e.g. "2026-05-09T00:00:00.000Z"
  day_of_week: number;
  resolved: ResolvedService[];
}

const cache = new Map<string, ResolvedDay>();

// ─── Time helpers ───────────────────────────────────────────────

function isoDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function nowMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function isDevEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.');
}

// ─── Loader ─────────────────────────────────────────────────────

function populateCache(rows: ApiRow[]) {
  cache.clear();
  for (const row of rows) {
    // ISO datetime → YYYY-MM-DD. The schedule date is stored as a UTC-midnight
    // Date in Postgres; slicing the first 10 chars gives the calendar day.
    const key = row.date.slice(0, 10);
    cache.set(key, { date: key, day_of_week: row.day_of_week, resolved: row.resolved });
  }
}

async function fetchSchedule(): Promise<ApiRow[]> {
  const res = await fetch('/api/current-schedule');
  if (!res.ok) throw new Error('Failed to fetch current schedule');
  const data: ApiRow[] = await res.json();
  // Populate the module-level cache before returning so synchronous helpers
  // called during the same render that received `data` see fresh values.
  populateCache(data);
  return data;
}

export function useCurrentScheduleLoader() {
  return useQuery<ApiRow[]>({
    queryKey: ['public-current-schedule'],
    queryFn: fetchSchedule,
    staleTime: 5 * 60 * 1000,
  });
}

export function CurrentScheduleLoader() {
  useCurrentScheduleLoader();
  return null;
}

/**
 * Convenience hook for components: subscribes to the loader (so re-renders
 * trigger when the schedule updates) and returns derived status booleans
 * + the most useful copy strings. Internally calls the synchronous helpers.
 */
export function useScheduleStatus(now: Date = new Date()) {
  useCurrentScheduleLoader();
  return {
    restaurantOpen: isRestaurantOpen(now),
    kitchenOpen: isKitchenOpen(now),
    nextKitchenOpening: getNextKitchenOpening(now),
    kitchenCloseTime: getKitchenCloseTime(now),
    nextOpenDay: getNextOpenDay(now),
  };
}

// ─── Synchronous helpers ────────────────────────────────────────
// Helpers fall back to "open" / loading-tolerant defaults when the cache is
// empty so the UI never flashes a closed banner during initial hydration.

function getDay(now: Date): ResolvedDay | undefined {
  return cache.get(isoDateKey(now));
}

export function isRestaurantOpen(now: Date = new Date()): boolean {
  if (isDevEnvironment()) return true;
  const day = getDay(now);
  if (!day) return true;
  const t = nowMinutes(now);
  return day.resolved.some(
    (s) =>
      (s.scope === 'restaurant' || s.scope === 'kitchen') &&
      t >= toMinutes(s.open) &&
      t < toMinutes(s.close),
  );
}

export function isKitchenOpen(now: Date = new Date()): boolean {
  if (isDevEnvironment()) return true;
  const day = getDay(now);
  if (!day) return true;
  const t = nowMinutes(now);
  return day.resolved.some(
    (s) => s.scope === 'kitchen' && t >= toMinutes(s.open) && t < toMinutes(s.close),
  );
}

/** Close time of the kitchen window the user is currently in, or just exited. */
export function getKitchenCloseTime(now: Date = new Date()): string | null {
  const day = getDay(now);
  if (!day) return null;
  const t = nowMinutes(now);
  const kitchen = day.resolved
    .filter((s) => s.scope === 'kitchen')
    .sort((a, b) => a.open.localeCompare(b.open));

  for (const s of kitchen) {
    const open = toMinutes(s.open);
    const close = toMinutes(s.close);
    if (t >= open && t < close) return s.close;
  }

  for (let i = kitchen.length - 1; i >= 0; i--) {
    const s = kitchen[i];
    const close = toMinutes(s.close);
    if (t >= close) {
      const next = kitchen[i + 1];
      if (!next || t < toMinutes(next.open)) return s.close;
    }
  }

  return null;
}

/** Opening time of the next kitchen window today, or null if none remain. */
export function getNextKitchenOpening(now: Date = new Date()): string | null {
  const day = getDay(now);
  if (!day) return null;
  const t = nowMinutes(now);
  const kitchen = day.resolved
    .filter((s) => s.scope === 'kitchen')
    .map((s) => ({ open: s.open, openMin: toMinutes(s.open) }))
    .sort((a, b) => a.openMin - b.openMin);
  for (const k of kitchen) {
    if (k.openMin > t) return k.open;
  }
  return null;
}

/** Trilingual day name + opening time of the first day the restaurant reopens. */
export function getNextOpenDay(now: Date = new Date()): {
  fr: string;
  en: string;
  lb: string;
  openTime: string;
} {
  const frDays = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const enDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const lbDays = ['Sonndeg', 'Méindeg', 'Dënschdeg', 'Mëttwoch', 'Donneschdeg', 'Freideg', 'Samschdeg'];

  for (let offset = 1; offset <= 7; offset++) {
    const target = new Date(now);
    target.setDate(target.getDate() + offset);
    const day = cache.get(isoDateKey(target));
    if (!day) continue;
    const earliest = day.resolved
      .filter((s) => s.scope === 'restaurant' || s.scope === 'kitchen')
      .map((s) => s.open)
      .sort()[0];
    if (!earliest) continue;
    const dow = target.getDay();
    return {
      fr: offset === 1 ? 'demain' : frDays[dow],
      en: offset === 1 ? 'tomorrow' : enDays[dow],
      lb: offset === 1 ? 'muer' : lbDays[dow],
      openTime: earliest,
    };
  }
  return { fr: 'bientôt', en: 'soon', lb: 'geschwënn', openTime: '10:00' };
}

/**
 * 5-min increment time slots starting now+10min, walking forward up to 7 days
 * until at least one slot is found. requireKitchen narrows to kitchen-scoped
 * windows (delayed dish orders); false uses any open service (drinks).
 */
export function getValidTimeSlots(requireKitchen: boolean, now: Date = new Date()): TimeSlot[] {
  const isDev = isDevEnvironment();
  const nowMin = nowMinutes(now);

  for (let offset = 0; offset < 7; offset++) {
    const target = new Date(now);
    target.setDate(target.getDate() + offset);
    const dateStr = isoDateKey(target);
    const day = cache.get(dateStr);

    const minMin = offset === 0 ? nowMin + 10 : 0;

    if (isDev) {
      // Dev fallback: today (offset 0) is always wide open from now+10 to 23:55.
      const slots: TimeSlot[] = [];
      const start = offset === 0 ? minMin : 10 * 60;
      const end = 23 * 60 + 55;
      for (let t = start; t <= end; t += 5) {
        slots.push({ hour: Math.floor(t / 60), minute: t % 60, date: dateStr });
      }
      if (slots.length > 0) return slots;
      continue;
    }

    if (!day) continue;

    const services = requireKitchen
      ? day.resolved.filter((s) => s.scope === 'kitchen')
      : day.resolved.filter((s) => s.scope === 'restaurant' || s.scope === 'kitchen');

    const slots: TimeSlot[] = [];
    for (const s of services) {
      for (let t = toMinutes(s.open); t < toMinutes(s.close); t += 5) {
        if (t >= minMin) {
          slots.push({ hour: Math.floor(t / 60), minute: t % 60, date: dateStr });
        }
      }
    }
    if (slots.length > 0) return slots;
  }

  return [];
}
