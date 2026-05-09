import type { Prisma, PrismaClient } from '@prisma/client';

type PrismaTx = Pick<PrismaClient, 'services' | 'standard_week' | 'current_schedule' | '$transaction'>;

const DAY_COLUMNS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export type ServiceScope = 'restaurant' | 'kitchen';

export interface ResolvedService {
  service_id: number;
  scope: ServiceScope;
  name_fr: string;
  name_en: string;
  name_lb: string;
  open: string;
  close: string;
}

function isoDayOfWeek(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function regenerate(prisma: PrismaTx, weeks = 4): Promise<number> {
  const today = toDateOnly(new Date());
  const endDate = addDays(today, weeks * 7);

  const services = await prisma.services.findMany({
    where: { is_active: true },
    orderBy: { sort_order: 'asc' },
  });

  const activeRows = await Promise.all(
    services.map((s) =>
      prisma.standard_week.findFirst({
        where: { service_id: s.id },
        orderBy: { created_at: 'desc' },
      }).then((row) => (row ? { service: s, row } : null)),
    ),
  );

  const pairs = activeRows.filter((x): x is { service: typeof services[number]; row: NonNullable<typeof activeRows[number]>['row'] } => x !== null);

  const dates: Date[] = [];
  for (let d = new Date(today); d <= endDate; d = addDays(d, 1)) {
    dates.push(new Date(d));
  }

  const inserts = dates.map((d) => {
    const dow = isoDayOfWeek(d);
    const col = DAY_COLUMNS[dow - 1];
    const resolved: ResolvedService[] = [];
    const sourceIds: number[] = [];

    for (const { service, row } of pairs) {
      const cell = row[col];
      if (cell && typeof cell === 'string' && cell.includes('-')) {
        const [open, close] = cell.split('-');
        resolved.push({
          service_id: service.id,
          scope: service.scope as ServiceScope,
          name_fr: service.name_fr,
          name_en: service.name_en,
          name_lb: service.name_lb,
          open,
          close,
        });
        sourceIds.push(row.id);
      }
    }

    return { date: d, day_of_week: dow, resolved, source_standard_ids: sourceIds };
  });

  await prisma.$transaction([
    prisma.current_schedule.deleteMany({
      where: { date: { gte: today, lte: endDate } },
    }),
    ...inserts.map((ins) =>
      prisma.current_schedule.create({
        data: {
          date: ins.date,
          day_of_week: ins.day_of_week,
          resolved: ins.resolved as unknown as Prisma.InputJsonValue,
          source_standard_ids: ins.source_standard_ids,
        },
      }),
    ),
  ]);

  return inserts.length;
}
