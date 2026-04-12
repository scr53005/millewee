import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const category = await prisma.category.update({
      where: { id: parseInt(id) },
      data: {
        ...(body.name_fr !== undefined && { name_fr: body.name_fr }),
        ...(body.name_en !== undefined && { name_en: body.name_en || null }),
        ...(body.name_lb !== undefined && { name_lb: body.name_lb || null }),
        ...(body.sort_order !== undefined && { sort_order: body.sort_order }),
        ...(body.is_active !== undefined && { is_active: body.is_active }),
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const categoryId = parseInt(id);

    // Check for linked dishes/drinks
    const [dishLinks, drinkLinks] = await Promise.all([
      prisma.categories_dishes.count({ where: { category_id: categoryId } }),
      prisma.categories_drinks.count({ where: { category_id: categoryId } }),
    ]);

    if (dishLinks > 0 || drinkLinks > 0) {
      return NextResponse.json(
        { error: `Impossible de supprimer: ${dishLinks} plat(s) et ${drinkLinks} boisson(s) liés` },
        { status: 409 }
      );
    }

    await prisma.category.delete({ where: { id: categoryId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
