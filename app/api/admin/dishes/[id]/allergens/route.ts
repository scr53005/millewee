import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Replace all allergens for a dish
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dishId = parseInt(id);
    const { allergen_ids } = await request.json();

    await prisma.dish_allergen.deleteMany({ where: { dish_id: dishId } });

    if (allergen_ids && allergen_ids.length > 0) {
      await prisma.dish_allergen.createMany({
        data: allergen_ids.map((aid: number) => ({ dish_id: dishId, allergen_id: aid })),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update dish allergens error:', error);
    return NextResponse.json({ error: 'Failed to update allergens' }, { status: 500 });
  }
}
