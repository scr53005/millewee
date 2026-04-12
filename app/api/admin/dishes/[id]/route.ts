import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dishId = parseInt(id);
    const body = await request.json();

    // Extract category_ids, allergen_ids, variants from body — handle them separately
    const { category_ids, allergen_ids, variants, ...dishData } = body;

    // Clean up empty strings to null
    const cleanData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dishData)) {
      if (value === '') {
        cleanData[key] = null;
      } else if (value !== undefined) {
        cleanData[key] = value;
      }
    }

    // Update dish fields
    await prisma.dish.update({
      where: { dish_id: dishId },
      data: cleanData,
    });

    // Replace category links if provided
    if (category_ids !== undefined) {
      await prisma.categories_dishes.deleteMany({ where: { dish_id: dishId } });
      if (category_ids.length > 0) {
        await prisma.categories_dishes.createMany({
          data: category_ids.map((cid: number) => ({ category_id: cid, dish_id: dishId })),
        });
      }
    }

    // Replace allergen links if provided
    if (allergen_ids !== undefined) {
      await prisma.dish_allergen.deleteMany({ where: { dish_id: dishId } });
      if (allergen_ids.length > 0) {
        await prisma.dish_allergen.createMany({
          data: allergen_ids.map((aid: number) => ({ allergen_id: aid, dish_id: dishId })),
        });
      }
    }

    // Replace variants if provided
    if (variants !== undefined) {
      await prisma.dish_variant.deleteMany({ where: { dish_id: dishId } });
      if (variants.length > 0) {
        await prisma.dish_variant.createMany({
          data: variants.map((v: { name_fr: string; name_en?: string; name_lb?: string; price_eur?: number; sort_order?: number; is_available?: boolean }) => ({
            dish_id: dishId,
            name_fr: v.name_fr,
            name_en: v.name_en || null,
            name_lb: v.name_lb || null,
            price_eur: v.price_eur ?? null,
            sort_order: v.sort_order ?? 0,
            is_available: v.is_available ?? true,
          })),
        });
      }
    }

    const updated = await prisma.dish.findUnique({
      where: { dish_id: dishId },
      include: {
        variants: { orderBy: { sort_order: 'asc' } },
        allergens: { include: { allergen: true } },
        categories: { include: { category: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update dish error:', error);
    return NextResponse.json({ error: 'Failed to update dish' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dishId = parseInt(id);

    // Cascade: delete variants, allergen links, category links, weekly specials links
    await prisma.$transaction([
      prisma.dish_variant.deleteMany({ where: { dish_id: dishId } }),
      prisma.dish_allergen.deleteMany({ where: { dish_id: dishId } }),
      prisma.categories_dishes.deleteMany({ where: { dish_id: dishId } }),
      prisma.weekly_special.deleteMany({ where: { dish_id: dishId } }),
      prisma.dish.delete({ where: { dish_id: dishId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete dish error:', error);
    return NextResponse.json({ error: 'Failed to delete dish' }, { status: 500 });
  }
}
