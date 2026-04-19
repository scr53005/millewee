import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};
    if (body.name_fr !== undefined) data.name_fr = body.name_fr;
    if (body.name_en !== undefined) data.name_en = body.name_en;
    if (body.name_lb !== undefined) data.name_lb = body.name_lb;
    if (body.sort_order !== undefined) data.sort_order = body.sort_order;
    if (body.is_active !== undefined) data.is_active = body.is_active;

    const service = await prisma.services.update({
      where: { id: parseInt(id) },
      data,
    });

    return NextResponse.json(service);
  } catch (error) {
    console.error('Update service error:', error);
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // Soft delete — preserves history and current_schedule snapshots remain valid.
    const service = await prisma.services.update({
      where: { id: parseInt(id) },
      data: { is_active: false },
    });
    return NextResponse.json(service);
  } catch (error) {
    console.error('Delete service error:', error);
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 });
  }
}
