'use client';

/**
 * Banner shown above the menu when the restaurant or kitchen is closed.
 *
 *  - !restaurantOpen → red banner: "Restaurant fermé. Réouverture demain à 10:00."
 *  - restaurantOpen && !kitchenOpen → amber banner: "Cuisine fermée.
 *    Réouverture à 18:00." (or "Réouverture demain à 11:45." if no more
 *    kitchen windows today).
 *  - both open → renders nothing.
 *
 * Dev bypass (localhost / 192.168.*) keeps both helpers returning true so
 * this banner stays hidden during local development.
 */

import { useScheduleStatus } from '@/hooks/use-current-schedule';
import { useI18n } from '@/lib/i18n';

export function ScheduleClosedBanner() {
  const { language, t } = useI18n();
  const status = useScheduleStatus();

  if (status.restaurantOpen && status.kitchenOpen) return null;

  const dayLabel = (() => {
    const d = status.nextOpenDay;
    if (language === 'en') return d.en;
    if (language === 'lb') return d.lb;
    return d.fr;
  })();

  if (!status.restaurantOpen) {
    const message = t('schedule.reopensOn')
      .replace('{day}', dayLabel)
      .replace('{time}', status.nextOpenDay.openTime);
    return (
      <div className="px-3 py-2 bg-destructive/15 border-b border-destructive/40 text-sm text-destructive font-medium text-center">
        {t('schedule.restaurantClosed')}. {message}.
      </div>
    );
  }

  // Restaurant open but kitchen closed.
  const reopenTime = status.nextKitchenOpening;
  const message = reopenTime
    ? t('schedule.reopensAt').replace('{time}', reopenTime)
    : t('schedule.reopensOn')
        .replace('{day}', dayLabel)
        .replace('{time}', status.nextOpenDay.openTime);

  return (
    <div className="px-3 py-2 bg-amber-100 border-b border-amber-300 text-sm text-amber-900 font-medium text-center dark:bg-amber-900/30 dark:border-amber-700/50 dark:text-amber-200">
      {t('schedule.kitchenClosed')}. {message}.
    </div>
  );
}
