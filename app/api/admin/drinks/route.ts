import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { drinkSchema } from '@/lib/admin/schemas';

export async function GET(request: NextRequest) {
  const categoryId = request.nextUrl.searchParams.get('category_id');

  const drinks = await prisma.drink.findMany({
    where: categoryId
      ? { categories: { some: { category_id: parseInt(categoryId) } } }
      : undefined,
    include: {
      sizes: { orderBy: { size: 'asc' } },
      selections: { orderBy: { sort_order: 'asc' } },
      categories: { include: { category: true } },
    },
    orderBy: [{ name_fr: 'asc' }],
  });

  return NextResponse.json(drinks);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = drinkSchema.parse(body);

    // A flat ('selection') drink's selections are flavor picks with no surcharge, so force
    // every price_delta to 0 server-side. Guards against a stale/buggy client persisting a
    // delta that the customer card would then double-count (base + delta). 'variant' drinks
    // keep their deltas (genuine per-choice price differences).
    const flatDrink = (data.selection_mode || null) === 'selection';

    const drink = await prisma.drink.create({
      data: {
        name_fr: data.name_fr,
        name_en: data.name_en || null,
        name_lb: data.name_lb || null,
        description_fr: data.description_fr || null,
        description_en: data.description_en || null,
        description_lb: data.description_lb || null,
        selection_mode: data.selection_mode || null,
        categories: {
          create: data.category_ids.map((cid) => ({ category_id: cid })),
        },
        sizes: {
          create: data.sizes.map((s) => ({
            size: s.size,
            price_eur: s.price_eur,
            discount: s.discount ?? null,
            image_url: s.image_url || null,
          })),
        },
        selections: {
          create: data.selections.map((s) => ({
            name_fr: s.name_fr,
            name_en: s.name_en || null,
            name_lb: s.name_lb || null,
            price_delta: flatDrink ? 0 : s.price_delta,
            sort_order: s.sort_order,
            is_available: s.is_available,
          })),
        },
      },
      include: {
        sizes: true,
        selections: { orderBy: { sort_order: 'asc' } },
        categories: { include: { category: true } },
      },
    });

    return NextResponse.json(drink, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', details: error }, { status: 400 });
    }
    console.error('Create drink error:', error);
    return NextResponse.json({ error: 'Failed to create drink' }, { status: 500 });
  }
}
