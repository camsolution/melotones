import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getCanvaConnectionStatus } from '@/lib/canva';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const connection = await getCanvaConnectionStatus();
  return NextResponse.json(connection);
}
