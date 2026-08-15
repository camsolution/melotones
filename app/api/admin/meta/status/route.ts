import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getMetaConnectionStatus } from '@/lib/meta';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const connection = await getMetaConnectionStatus();
  return NextResponse.json(connection);
}
