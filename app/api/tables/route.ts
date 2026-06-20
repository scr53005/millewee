/**
 * GET /api/tables
 * Returns the restaurant's valid table numbers (ascending) from the
 * `restaurant_table` model. Used by the customer-editable table control to
 * validate a typed table number client-side.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const rows = await prisma.restaurant_table.findMany({
      select: { table_number: true },
      orderBy: { table_number: 'asc' },
    });
    return NextResponse.json({ tables: rows.map((r) => r.table_number) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/tables] fetch error:', message);
    return NextResponse.json({ error: `Failed to fetch tables: ${message}` }, { status: 500 });
  }
}
