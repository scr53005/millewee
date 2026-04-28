// Restaurant hours configuration for Millewee
// Will be refactored to DB-driven (current_schedule table) in a later iteration

/** Returns true when running on localhost / dev — bypasses opening hours checks */
function isDevEnvironment(): boolean {
  if (typeof window === 'undefined') return false; // SSR: don't bypass
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.');
}

export interface ServiceWindow {
  open: number;  // minutes from midnight (e.g., 570 = 09h30)
  close: number;
}

// Millewee is open Mon-Sat 09:30-01:00 (crosses midnight).
// Per calendar day this translates to:
//   Sunday:    00:00-00:59 (Saturday night spillover)
//   Monday:    09:30-23:59
//   Tue-Sat:   00:00-00:59 (previous night spillover) + 09:30-23:59
//
// 0=Sunday, 1=Monday ... 6=Saturday
export const RESTAURANT_WINDOWS: Record<number, ServiceWindow[]> = {
  0: [{ open: 0, close: 59 }],                              // Sun: 00:00-00:59 only
  1: [{ open: 570, close: 1439 }],                           // Mon: 09:30-23:59
  2: [{ open: 0, close: 59 }, { open: 570, close: 1439 }],   // Tue
  3: [{ open: 0, close: 59 }, { open: 570, close: 1439 }],   // Wed
  4: [{ open: 0, close: 59 }, { open: 570, close: 1439 }],   // Thu
  5: [{ open: 0, close: 59 }, { open: 570, close: 1439 }],   // Fri
  6: [{ open: 0, close: 59 }, { open: 570, close: 1439 }],   // Sat
};

/** Check if the restaurant is open at a given time on a given day */
export function isRestaurantOpen(dayOfWeek: number, totalMinutes: number): boolean {
  if (isDevEnvironment()) return true;
  const windows = RESTAURANT_WINDOWS[dayOfWeek];
  if (!windows) return false;
  return windows.some(w => totalMinutes >= w.open && totalMinutes <= w.close);
}

/** Check if the restaurant is open right now */
export function isRestaurantOpenNow(): boolean {
  const now = new Date();
  return isRestaurantOpen(now.getDay(), now.getHours() * 60 + now.getMinutes());
}
