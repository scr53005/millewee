'use client';

import { useEffect } from 'react';

/**
 * Force-light scope for the admin section.
 *
 * The customer side uses next-themes with `attribute="class"` + `enableSystem`
 * + `defaultTheme="dark"`, so on a phone in dark system mode the `<html>`
 * element carries `class="dark"`. Every `dark:` Tailwind utility inside the
 * admin pages (tabs.tsx, table.tsx, etc.) then kicks in and overrides the
 * explicit `text-gray-900` / `bg-[#fdf6e9]` classes — producing the
 * "white on light grey" mobile readability bug on Plats/Boissons tabs and
 * table headers.
 *
 * Admin pages are always intended to be light. This mounts in the admin
 * layout, strips `.dark` while mounted, and restores it on unmount.
 */
export function AdminLightMode() {
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains('dark');
    if (wasDark) html.classList.remove('dark');
    return () => {
      if (wasDark) html.classList.add('dark');
    };
  }, []);
  return null;
}
