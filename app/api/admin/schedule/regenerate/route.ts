import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { prisma } from '@/lib/prisma';
import { regenerateScheduleSchema } from '@/lib/admin/schemas';
import { regenerate } from '@/lib/schedule/regenerate';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { weeks } = regenerateScheduleSchema.parse(body);

    const generated = await regenerate(prisma, weeks);
    return NextResponse.json({ generated });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    console.error('Regenerate schedule error:', error);
    return NextResponse.json({ error: 'Failed to regenerate schedule' }, { status: 500 });
  }
}
