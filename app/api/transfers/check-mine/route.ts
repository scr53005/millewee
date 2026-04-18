/**
 * GET /api/transfers/check-mine?memo_prefix=<prefix>&since=<iso>
 * Lightweight endpoint for Level 3 guardrail: customer-side order confirmation polling.
 *
 * Checks whether any transfer with a memo starting with <prefix> exists in our
 * local `transfers` table. If any of the matching transfers is fulfilled, reports
 * fulfilled=true (so a late-arriving unfulfilled HBD transfer doesn't mask a
 * fulfilled EURO transfer sharing the same memo prefix).
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memoPrefix = searchParams.get('memo_prefix');

    if (!memoPrefix || memoPrefix.length < 5) {
      return NextResponse.json(
        { error: 'memo_prefix parameter is required (min 5 chars)' },
        { status: 400 },
      );
    }

    const sinceParam = searchParams.get('since');
    const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 60 * 60 * 1000);

    const transfers = await prisma.transfers.findMany({
      where: {
        memo: { startsWith: memoPrefix },
        received_at: { gte: since },
      },
      orderBy: { received_at: 'desc' },
      select: {
        id: true,
        received_at: true,
        fulfilled: true,
      },
    });

    if (transfers.length === 0) {
      console.warn(
        `[check-mine] No transfer found for prefix="${memoPrefix}" since=${since.toISOString()}`,
      );
      return NextResponse.json({ found: false });
    }

    const anyFulfilled = transfers.some((t) => t.fulfilled === true);
    const primary = transfers[0];
    console.warn(
      `[check-mine] Found ${transfers.length} transfer(s) for prefix="${memoPrefix}" anyFulfilled=${anyFulfilled}`,
    );
    return NextResponse.json({
      found: true,
      received_at: primary.received_at?.toISOString() ?? null,
      fulfilled: anyFulfilled,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[check-mine] Error:', message);
    return NextResponse.json(
      { error: `Failed to check transfer: ${message}` },
      { status: 500 },
    );
  }
}
