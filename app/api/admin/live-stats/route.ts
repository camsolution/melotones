import { requireAdmin, supabaseAdmin } from '@/lib/admin';
import { computeProviderBalanceEstimate } from '@/lib/providerBalance';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const onlineSince = new Date(Date.now() - 60_000).toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { count: onlineCount },
    { count: processingGenerations },
    { count: pendingPurchaseRequests },
    { count: pendingRefundRequests },
    { count: openChatConversations },
    { data: revenueRows },
    { count: newSignupsToday },
    { count: unacknowledgedProviderErrors },
  ] = await Promise.all([
    supabaseAdmin.from('presence').select('*', { count: 'exact', head: true }).gte('last_seen_at', onlineSince),
    supabaseAdmin.from('generations').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
    supabaseAdmin.from('purchase_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('refund_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('chat_conversations').select('*', { count: 'exact', head: true }).eq('status', 'escalated'),
    supabaseAdmin.from('purchase_requests').select('price_fcfa').eq('status', 'approved').gte('created_at', todayStart.toISOString()),
    supabaseAdmin.from('user_credits').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    supabaseAdmin.from('provider_errors').select('*', { count: 'exact', head: true }).eq('acknowledged', false),
  ]);

  const revenueTodayFcfa = (revenueRows || []).reduce((sum, r) => sum + (r.price_fcfa || 0), 0);
  const providerBalance = await computeProviderBalanceEstimate();

  return NextResponse.json({
    providerBalanceUsd: providerBalance.estimatedRemainingUsd,
    providerBalanceGenerations: providerBalance.estimatedRemainingGenerations,
    onlineCount: onlineCount ?? 0,
    processingGenerations: processingGenerations ?? 0,
    pendingPurchaseRequests: pendingPurchaseRequests ?? 0,
    pendingRefundRequests: pendingRefundRequests ?? 0,
    openChatConversations: openChatConversations ?? 0,
    revenueTodayFcfa,
    newSignupsToday: newSignupsToday ?? 0,
    unacknowledgedProviderErrors: unacknowledgedProviderErrors ?? 0,
  });
}
