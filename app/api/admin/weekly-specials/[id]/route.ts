import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (body.dish_id !== undefined) data.dish_id = body.dish_id;
    if (body.start_date !== undefined) data.start_date = new Date(body.start_date);
    if (body.end_date !== undefined) data.end_date = new Date(body.end_date);
    if (body.special_price !== undefined) data.special_price = body.special_price;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.is_active !== undefined) data.is_active = body.is_active;

    const special = await prisma.weekly_special.update({
      where: { id: parseInt(id) },
      data,
      include: { dish: true },
    });

    return NextResponse.json(special);
  } catch (error) {
    console.error('Update weekly special error:', error);
    return NextResponse.json({ error: 'Failed to update weekly special' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.weekly_special.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete weekly special error:', error);
    return NextResponse.json({ error: 'Failed to delete weekly special' }, { status: 500 });
  }
}
