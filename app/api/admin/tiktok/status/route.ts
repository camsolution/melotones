import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getTiktokConnectionStatus } from '@/lib/tiktok';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const connection = await getTiktokConnectionStatus();
  return NextResponse.json(connection);
}
