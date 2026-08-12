import { NextResponse } from 'next/server';
import { supabaseAdmin, verifyAutomationSecret } from '@/lib/admin';
import { isProviderOutOfCredits } from '@/lib/providerErrors';
import { computeProviderBalanceEstimate } from '@/lib/providerBalance';

export const dynamic = 'force-dynamic';

const RECENT_ERRORS_WINDOW_MS = 4 * 60 * 60 * 1000;
const LOW_BALANCE_GENERATIONS_THRESHOLD = 20;

export async function GET(request: Request) {
  if (!verifyAutomationSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since = new Date(Date.now() - RECENT_ERRORS_WINDOW_MS).toISOString();

  const [outOfCredits, { count: pendingRefunds }, { count: recentErrors }, providerBalance] = await Promise.all([
    isProviderOutOfCredits(),
    supabaseAdmin.from('refund_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('provider_errors').select('*', { count: 'exact', head: true }).gte('created_at', since),
    computeProviderBalanceEstimate(),
  ]);

  const lowBalance = providerBalance.estimatedRemainingGenerations !== null
    && providerBalance.estimatedRemainingGenerations < LOW_BALANCE_GENERATIONS_THRESHOLD;

  const issues: string[] = [];
  if (outOfCredits) issues.push('MusicGPT signale INSUFFICIENT_CREDITS récemment — coupe-circuit actif.');
  if ((pendingRefunds ?? 0) > 0) issues.push(`${pendingRefunds} remboursement(s) en attente d'approbation admin.`);
  if ((recentErrors ?? 0) >= 5) issues.push(`${recentErrors} erreurs fournisseur dans les 4 dernières heures.`);
  if (lowBalance) issues.push(`Solde MusicGPT estimé bas : ~${providerBalance.estimatedRemainingGenerations} générations restantes.`);

  return NextResponse.json({
    ok: issues.length === 0,
    issues,
    outOfCredits,
    pendingRefunds: pendingRefunds ?? 0,
    recentProviderErrors: recentErrors ?? 0,
    providerBalance,
  });
}
