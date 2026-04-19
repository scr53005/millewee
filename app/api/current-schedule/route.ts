import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.current_schedule.findMany({
    where: { date: { gte: today } },
    orderBy: { date: 'asc' },
    select: { date: true, day_of_week: true, resolved: true },
  });

  return NextResponse.json(rows, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
