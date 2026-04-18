/**
 * GET /api/transfers/unfulfilled
 * Returns the most recent unfulfilled transfers for the CO (kitchen) page.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const unfulfilledTransfers = await prisma.transfers.findMany({
      where: { fulfilled: false },
      select: {
        id: true,
        from_account: true,
        to_account: true,
        amount: true,
        symbol: true,
        memo: true,
        parsed_memo: true,
        received_at: true,
      },
      orderBy: { id: 'desc' },
      take: 50,
    });

    const formatted = unfulfilledTransfers.map((t) => ({
      id: t.id.toString(),
      from_account: t.from_account,
      to_account: t.to_account,
      amount: t.amount,
      symbol: t.symbol,
      memo: t.memo,
      parsedMemo: t.parsed_memo,
      received_at: t.received_at ? t.received_at.toISOString() : new Date().toISOString(),
    }));

    return NextResponse.json({ transfers: formatted });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error fetching unfulfilled transfers:', message);
    return NextResponse.json(
      { error: `Failed to fetch unfulfilled transfers: ${message}` },
      { status: 500 },
    );
  }
}
