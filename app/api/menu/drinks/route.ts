import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const [categories, drinks] = await Promise.all([
    prisma.category.findMany({
      where: { type: 'drinks', is_active: true },
      orderBy: { sort_order: 'asc' },
    }),
    prisma.drink.findMany({
      include: {
        sizes: { orderBy: { size: 'asc' } },
        selections: {
          where: { is_available: true },
          orderBy: { sort_order: 'asc' },
        },
        categories: { include: { category: true } },
      },
      orderBy: [{ name_fr: 'asc' }],
    }),
  ]);

  // Filter to drinks that have at least one size (no size = not orderable)
  // Convert Decimal fields to numbers
  const serialized = drinks
    .filter((d) => d.sizes.length > 0)
    .map((d) => ({
      ...d,
      sizes: d.sizes.map((s) => ({
        ...s,
        price_eur: Number(s.price_eur),
      })),
      selections: d.selections.map((s) => ({
        ...s,
        price_delta: Number(s.price_delta),
      })),
    }));

  return NextResponse.json({ categories, drinks: serialized });
}
