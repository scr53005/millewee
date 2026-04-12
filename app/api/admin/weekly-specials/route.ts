import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { weeklySpecialSchema } from '@/lib/admin/schemas';

export async function GET(request: NextRequest) {
  const activeOnly = request.nextUrl.searchParams.get('active_only') === 'true';

  const specials = await prisma.weekly_special.findMany({
    where: activeOnly ? { is_active: true } : undefined,
    include: { dish: true },
    orderBy: [{ start_date: 'desc' }],
  });

  return NextResponse.json(specials);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = weeklySpecialSchema.parse(body);

    const special = await prisma.weekly_special.create({
      data: {
        dish_id: data.dish_id,
        start_date: new Date(data.start_date),
        end_date: new Date(data.end_date),
        special_price: data.special_price ?? null,
        description: data.description || null,
        is_active: data.is_active,
      },
      include: { dish: true },
    });

    return NextResponse.json(special, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Validation failed', details: error }, { status: 400 });
    }
    console.error('Create weekly special error:', error);
    return NextResponse.json({ error: 'Failed to create weekly special' }, { status: 500 });
  }
}
