'use client';

/**
 * Banner shown above the menu when the restaurant or kitchen is closed.
 *
 *  - !restaurantOpen → red banner with the next *restaurant* opening time
 *    (e.g. "Restaurant fermé. Réouverture à 09:00." at 03:00 the same day,
 *    or "Réouverture demain à 09:00." after the restaurant has shut for the
 *    night). Always shown regardless of the active tab.
 *  - restaurantOpen && !kitchenOpen → bordeaux banner with the next *kitchen*
 *    opening time (e.g. "Cuisine fermée. Réouverture à 18:00." between lunch
 *    and dinner). Suppressed via `hideKitchenWarning` when the customer is
 *    on a drinks-only tab — drinks are still orderable, so the banner would
 *    only confuse them.
 *  - both open → renders nothing.
 *
 * Dev bypass (localhost / 192.168.*) keeps the helpers returning true so the
 * banner stays hidden during local development.
 */

import { useScheduleStatus, type NextOpening } from '@/hooks/use-current-schedule';
import { useI18n, type Language } from '@/lib/i18n';

interface ScheduleClosedBannerProps {
  /** Set true on tabs where the kitchen-closed warning is irrelevant
   *  (e.g. the drinks-only tab). The restaurant-closed banner is unaffected. */
  hideKitchenWarning?: boolean;
}

function dayLabelFor(opening: NextOpening, language: Language): string {
  if (language === 'en') return opening.en;
  if (language === 'lb') return opening.lb;
  return opening.fr;
}

function reopeningCopy(
  opening: NextOpening,
  language: Language,
  t: (key: string) => string,
): string {
  if (opening.sameDay) {
    return t('schedule.reopensAt').replace('{time}', opening.openTime);
  }
  return t('schedule.reopensOn')
    .replace('{day}', dayLabelFor(opening, language))
    .replace('{time}', opening.openTime);
}

export function ScheduleClosedBanner({ hideKitchenWarning = false }: ScheduleClosedBannerProps) {
  const { language, t } = useI18n();
  const status = useScheduleStatus();

  if (status.restaurantOpen && status.kitchenOpen) return null;

  // Restaurant closed → always show, regardless of tab.
  if (!status.restaurantOpen) {
    const opening = status.nextRestaurantOpening;
    const message = opening
      ? reopeningCopy(opening, language, t)
      : t('schedule.reopensAt').replace('{time}', '—');
    return (
      <div className="px-3 py-2 bg-destructive/15 border-b border-destructive/40 text-sm text-destructive font-medium text-center">
        {t('schedule.restaurantClosed')}. {message}.
      </div>
    );
  }

  // Restaurant open but kitchen closed → suppress on drinks-only tabs.
  if (hideKitchenWarning) return null;

  const opening = status.nextKitchenOpening;
  const message = opening
    ? reopeningCopy(opening, language, t)
    : t('schedule.reopensAt').replace('{time}', '—');

  // Bordeaux / blood-red gradient + bright yellow text. Matches indiesmenu's
  // kitchen-closed banner aesthetic. Same colors in light and dark mode by
  // design — the contrast is meant to grab attention regardless of theme.
  return (
    <div className="px-3 py-2 bg-gradient-to-r from-red-800 to-red-950 border-b border-red-900 text-sm text-yellow-300 font-semibold text-center">
      {t('schedule.kitchenClosed')}. {message}.
    </div>
  );
}
