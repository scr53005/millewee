import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { categorySchema } from '@/lib/admin/schemas';

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type');

  const categories = await prisma.category.findMany({
    where: type ? { type } : undefined,
    orderBy: [{ type: 'asc' }, { sort_order: 'asc' }, { name_fr: 'asc' }],
  });

  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = categorySchema.parse(body);

    const category = await prisma.category.create({
      data: {
        name_fr: data.name_fr,
        name_en: data.name_en || null,
        name_lb: data.name_lb || null,
        type: data.type,
        sort_order: data.sort_order,
        is_active: data.is_active,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', details: error }, { status: 400 });
    }
    console.error('Create category error:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
