import { supabaseAdmin } from '@/lib/admin';

const PERIOD_DAYS = 30;

export async function computeAnalytics() {
  const since = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: views }, { count: totalUsers }, { data: completedGens }, { data: approvedPurchases }] = await Promise.all([
    supabaseAdmin.from('page_views').select('session_id').gte('created_at', since),
    supabaseAdmin.from('user_credits').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('generations').select('user_id').eq('status', 'completed'),
    supabaseAdmin.from('purchase_requests').select('user_id').eq('status', 'approved'),
  ]);

  const uniqueVisitors = new Set((views || []).map((v) => v.session_id)).size;
  const totalPageviews = (views || []).length;

  const { count: signupsInPeriod } = await supabaseAdmin
    .from('user_credits')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since);

  const activatedUsers = new Set((completedGens || []).map((g) => g.user_id)).size;
  const payingUsers = new Set((approvedPurchases || []).map((p) => p.user_id)).size;

  const total = totalUsers ?? 0;

  return {
    periodDays: PERIOD_DAYS,
    uniqueVisitors,
    totalPageviews,
    signupsInPeriod: signupsInPeriod ?? 0,
    signupRate: uniqueVisitors > 0 ? signupsInPeriod! / uniqueVisitors : null,
    totalUsers: total,
    activatedUsers,
    activationRate: total > 0 ? activatedUsers / total : null,
    payingUsers,
    conversionRate: total > 0 ? payingUsers / total : null,
  };
}
