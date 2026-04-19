import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { servicesSchema } from '@/lib/admin/schemas';

export async function GET(request: NextRequest) {
  const activeOnly = request.nextUrl.searchParams.get('active_only') === 'true';

  const services = await prisma.services.findMany({
    where: activeOnly ? { is_active: true } : undefined,
    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
  });

  return NextResponse.json(services);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = servicesSchema.parse(body);

    const service = await prisma.services.create({ data });
    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    console.error('Create service error:', error);
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}
