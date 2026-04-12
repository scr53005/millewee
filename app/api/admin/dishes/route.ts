import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { dishSchema } from '@/lib/admin/schemas';

export async function GET(request: NextRequest) {
  const categoryId = request.nextUrl.searchParams.get('category_id');

  const dishes = await prisma.dish.findMany({
    where: categoryId
      ? { categories: { some: { category_id: parseInt(categoryId) } } }
      : undefined,
    include: {
      variants: { orderBy: { sort_order: 'asc' } },
      allergens: { include: { allergen: true } },
      categories: { include: { category: true } },
    },
    orderBy: [{ sort_order: 'asc' }, { name_fr: 'asc' }],
  });

  return NextResponse.json(dishes);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = dishSchema.parse(body);

    const dish = await prisma.dish.create({
      data: {
        name_fr: data.name_fr,
        name_en: data.name_en || null,
        name_lb: data.name_lb || null,
        description_fr: data.description_fr || null,
        description_en: data.description_en || null,
        description_lb: data.description_lb || null,
        price_eur: data.price_eur,
        discount: data.discount,
        image_url: data.image_url || null,
        is_available: data.is_available,
        is_popular: data.is_popular,
        is_new: data.is_new,
        sort_order: data.sort_order,
        has_variants: data.has_variants,
        selection_label: data.selection_label || null,
        categories: {
          create: data.category_ids.map((cid) => ({ category_id: cid })),
        },
        allergens: {
          create: data.allergen_ids.map((aid) => ({ allergen_id: aid })),
        },
        variants: {
          create: data.variants.map((v) => ({
            name_fr: v.name_fr,
            name_en: v.name_en || null,
            name_lb: v.name_lb || null,
            price_eur: v.price_eur ?? null,
            sort_order: v.sort_order,
            is_available: v.is_available,
          })),
        },
      },
      include: {
        variants: true,
        allergens: { include: { allergen: true } },
        categories: { include: { category: true } },
      },
    });

    return NextResponse.json(dish, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', details: error }, { status: 400 });
    }
    console.error('Create dish error:', error);
    return NextResponse.json({ error: 'Failed to create dish' }, { status: 500 });
  }
}
