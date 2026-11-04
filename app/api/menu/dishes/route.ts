import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Owners rename/reprice items from the admin; no browser or CDN may keep an old copy
// (iPhones kept showing renamed drinks, 2026-11-04).
export const dynamic = 'force-dynamic';

export async function GET() {
  const [categories, dishes] = await Promise.all([
    prisma.category.findMany({
      where: { type: 'dishes', is_active: true },
      orderBy: { sort_order: 'asc' },
    }),
    prisma.dish.findMany({
      where: { is_available: true },
      include: {
        variants: {
          where: { is_available: true },
          orderBy: { sort_order: 'asc' },
        },
        allergens: { include: { allergen: true } },
        categories: { include: { category: true } },
      },
      orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
    }),
  ]);

  // Convert Decimal fields to numbers for JSON serialization
  const serialized = dishes.map((d) => ({
    ...d,
    price_eur: Number(d.price_eur),
    variants: d.variants.map((v) => ({
      ...v,
      price_eur: v.price_eur != null ? Number(v.price_eur) : null,
    })),
  }));

  return NextResponse.json({ categories, dishes: serialized }, { headers: { 'Cache-Control': 'no-store' } });
}
