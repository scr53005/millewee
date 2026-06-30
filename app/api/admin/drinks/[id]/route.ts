import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const drinkId = parseInt(id);
    const body = await request.json();

    const { category_ids, sizes, selections, ...drinkData } = body;

    // Clean empty strings to null
    const cleanData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(drinkData)) {
      if (value === '') {
        cleanData[key] = null;
      } else if (value !== undefined) {
        cleanData[key] = value;
      }
    }

    await prisma.drink.update({
      where: { drink_id: drinkId },
      data: cleanData,
    });

    // Replace category links
    if (category_ids !== undefined) {
      await prisma.categories_drinks.deleteMany({ where: { drink_id: drinkId } });
      if (category_ids.length > 0) {
        await prisma.categories_drinks.createMany({
          data: category_ids.map((cid: number) => ({ category_id: cid, drink_id: drinkId })),
        });
      }
    }

    // Replace sizes (delete + recreate — composite PK)
    if (sizes !== undefined) {
      await prisma.drink_size.deleteMany({ where: { drink_id: drinkId } });
      if (sizes.length > 0) {
        await prisma.drink_size.createMany({
          data: sizes.map((s: { size: string; price_eur: number; discount?: number; image_url?: string }) => ({
            drink_id: drinkId,
            size: s.size,
            price_eur: s.price_eur,
            discount: s.discount ?? null,
            image_url: s.image_url || null,
          })),
        });
      }
    }

    // Replace selections
    if (selections !== undefined) {
      // A flat ('selection') drink's selections are flavor picks with no surcharge → force
      // every price_delta to 0 (defense-in-depth; the customer card double-counts base + delta).
      // Read the just-updated mode so partial updates that omit selection_mode still apply the
      // right rule. 'variant' drinks keep their deltas (real per-choice price differences).
      const current = await prisma.drink.findUnique({
        where: { drink_id: drinkId },
        select: { selection_mode: true },
      });
      const flatDrink = current?.selection_mode === 'selection';

      await prisma.drink_selection.deleteMany({ where: { drink_id: drinkId } });
      if (selections.length > 0) {
        await prisma.drink_selection.createMany({
          data: selections.map((s: { name_fr: string; name_en?: string; name_lb?: string; price_delta?: number; sort_order?: number; is_available?: boolean }) => ({
            drink_id: drinkId,
            name_fr: s.name_fr,
            name_en: s.name_en || null,
            name_lb: s.name_lb || null,
            price_delta: flatDrink ? 0 : (s.price_delta ?? 0),
            sort_order: s.sort_order ?? 0,
            is_available: s.is_available ?? true,
          })),
        });
      }
    }

    const updated = await prisma.drink.findUnique({
      where: { drink_id: drinkId },
      include: {
        sizes: { orderBy: { size: 'asc' } },
        selections: { orderBy: { sort_order: 'asc' } },
        categories: { include: { category: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update drink error:', error);
    return NextResponse.json({ error: 'Failed to update drink' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const drinkId = parseInt(id);

    await prisma.$transaction([
      prisma.drink_size.deleteMany({ where: { drink_id: drinkId } }),
      prisma.drink_selection.deleteMany({ where: { drink_id: drinkId } }),
      prisma.categories_drinks.deleteMany({ where: { drink_id: drinkId } }),
      prisma.drink.delete({ where: { drink_id: drinkId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete drink error:', error);
    return NextResponse.json({ error: 'Failed to delete drink' }, { status: 500 });
  }
}
