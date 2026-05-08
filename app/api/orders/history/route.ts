import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skip = Number.parseInt(searchParams.get('skip') || '0', 10);
    const daysToFetch = Number.parseInt(searchParams.get('days') || '3', 10);

    const datesWithOrders: { date: Date }[] = await prisma.$queryRaw`
      SELECT DISTINCT DATE(fulfilled_at AT TIME ZONE 'Europe/Paris') as date
      FROM transfers
      WHERE fulfilled = true
      AND fulfilled_at IS NOT NULL
      ORDER BY date DESC
      LIMIT ${daysToFetch}
      OFFSET ${skip}
    `;

    if (datesWithOrders.length === 0) {
      const anyFulfilled = await prisma.transfers.findFirst({
        where: { fulfilled: true },
        select: { id: true },
      });

      return NextResponse.json({
        orders: [],
        hasMore: false,
        totalDaysWithOrders: anyFulfilled ? -1 : 0,
      });
    }

    const latestDate = new Date(datesWithOrders[0].date);
    const earliestDate = new Date(datesWithOrders[datesWithOrders.length - 1].date);

    const startOfEarliestDay = new Date(earliestDate);
    startOfEarliestDay.setHours(0, 0, 0, 0);

    const endOfLatestDay = new Date(latestDate);
    endOfLatestDay.setHours(23, 59, 59, 999);

    const fulfilledOrders = await prisma.transfers.findMany({
      where: {
        fulfilled: true,
        fulfilled_at: {
          gte: startOfEarliestDay,
          lte: endOfLatestDay,
        },
      },
      select: {
        id: true,
        from_account: true,
        to_account: true,
        amount: true,
        symbol: true,
        memo: true,
        parsed_memo: true,
        received_at: true,
        fulfilled_at: true,
      },
      orderBy: { fulfilled_at: 'desc' },
    });

    const moreDates: { date: Date }[] = await prisma.$queryRaw`
      SELECT DISTINCT DATE(fulfilled_at AT TIME ZONE 'Europe/Paris') as date
      FROM transfers
      WHERE fulfilled = true
      AND fulfilled_at IS NOT NULL
      AND DATE(fulfilled_at AT TIME ZONE 'Europe/Paris') < ${earliestDate}
      LIMIT 1
    `;

    return NextResponse.json({
      orders: fulfilledOrders.map((order) => ({
        id: order.id.toString(),
        from_account: order.from_account,
        to_account: order.to_account,
        amount: order.amount,
        symbol: order.symbol,
        memo: order.memo,
        parsed_memo: order.parsed_memo,
        received_at: order.received_at ? order.received_at.toISOString() : null,
        fulfilled_at: order.fulfilled_at ? order.fulfilled_at.toISOString() : null,
      })),
      hasMore: moreDates.length > 0,
      daysReturned: datesWithOrders.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Order history fetch error:', message);
    return NextResponse.json(
      { error: `Failed to fetch order history: ${message}` },
      { status: 500 },
    );
  }
}
