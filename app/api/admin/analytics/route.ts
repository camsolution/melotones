import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { computeAnalytics } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const analytics = await computeAnalytics();
  return NextResponse.json(analytics);
}
