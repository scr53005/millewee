import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const specials = await prisma.weekly_special.findMany({
    where: {
      is_active: true,
      start_date: { lte: today },
      end_date: { gte: today },
    },
    include: {
      dish: {
        include: {
          allergens: { include: { allergen: true } },
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  // Convert Decimal fields to numbers
  const serialized = specials.map((s) => ({
    ...s,
    special_price: s.special_price != null ? Number(s.special_price) : null,
    dish: {
      ...s.dish,
      price_eur: Number(s.dish.price_eur),
    },
  }));

  return NextResponse.json(serialized);
}
