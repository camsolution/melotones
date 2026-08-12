import { NextResponse } from 'next/server';
import { verifyAutomationSecret } from '@/lib/admin';
import { computeAnalytics } from '@/lib/analytics';
import { computeProviderBalanceEstimate } from '@/lib/providerBalance';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!verifyAutomationSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [analytics, providerBalance] = await Promise.all([
    computeAnalytics(),
    computeProviderBalanceEstimate(),
  ]);

  return NextResponse.json({ analytics, providerBalance });
}
