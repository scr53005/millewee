/**
 * POST /api/fulfill
 * Marks a transfer as fulfilled (called by the CO page when an order is served).
 *
 * Body: { transferId: string | number } or { id: string | number }
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const transferId = body.transferId ?? body.id;

  try {
    if (transferId === undefined || transferId === null || isNaN(Number(transferId))) {
      console.log('[fulfill] Invalid transfer ID:', transferId);
      return NextResponse.json({ error: 'Invalid transfer ID' }, { status: 400 });
    }

    const idBig = BigInt(transferId);

    const transfer = await prisma.transfers.findUnique({
      where: { id: idBig },
    });

    if (!transfer) {
      console.log(`[fulfill] No transfer found for ID: ${transferId}`);
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    await prisma.transfers.update({
      where: {
        id: idBig,
        fulfilled: false, // Only update if not already fulfilled
      },
      data: {
        fulfilled: true,
        fulfilled_at: new Date(),
      },
      select: { id: true },
    });

    console.log(`[fulfill] Fulfilled transfer ID: ${transferId}`);
    return NextResponse.json({ message: 'Transfer fulfilled' }, { status: 200 });
  } catch (error) {
    const err = error as { code?: string; message?: string; stack?: string };
    console.error('[fulfill] Error:', err.message, err.stack);

    if (err.code === 'P2025') {
      return NextResponse.json(
        { error: 'Transfer not found or already fulfilled' },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: `Failed to fulfill transfer: ${err.message}` },
      { status: 500 },
    );
  }
}
