import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { standardWeekSchema } from '@/lib/admin/schemas';
import { regenerate } from '@/lib/schedule/regenerate';

export async function GET() {
  const services = await prisma.services.findMany({
    where: { is_active: true },
    orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
  });

  const rows = await Promise.all(
    services.map(async (s: typeof services[number]) => {
      const active = await prisma.standard_week.findFirst({
        where: { service_id: s.id },
        orderBy: { created_at: 'desc' },
      });
      return {
        service_id: s.id,
        service_name_fr: s.name_fr,
        service_name_en: s.name_en,
        service_name_lb: s.name_lb,
        sort_order: s.sort_order,
        mon: active?.mon ?? null,
        tue: active?.tue ?? null,
        wed: active?.wed ?? null,
        thu: active?.thu ?? null,
        fri: active?.fri ?? null,
        sat: active?.sat ?? null,
        sun: active?.sun ?? null,
      };
    }),
  );

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = standardWeekSchema.parse(body);

    const service = await prisma.services.findUnique({ where: { id: data.service_id } });
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const created = await prisma.standard_week.create({
      data: {
        service_id: data.service_id,
        mon: data.mon,
        tue: data.tue,
        wed: data.wed,
        thu: data.thu,
        fri: data.fri,
        sat: data.sat,
        sun: data.sun,
      },
    });

    // Automatic regeneration — next 4 weeks.
    const generated = await regenerate(prisma, 4);

    return NextResponse.json({ row: created, generated }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('Save standard_week error:', error);
    return NextResponse.json({ error: 'Failed to save standard week' }, { status: 500 });
  }
}
