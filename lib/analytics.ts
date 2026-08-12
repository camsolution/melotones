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

  // user_credits n'a pas de colonne created_at — la date d'inscription fiable
  // est auth.users.created_at (garantie par Supabase Auth).
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const sinceMs = new Date(since).getTime();
  const signupsInPeriod = (authUsers?.users || []).filter((u) => new Date(u.created_at).getTime() >= sinceMs).length;

  const activatedUsers = new Set((completedGens || []).map((g) => g.user_id)).size;
  const payingUsers = new Set((approvedPurchases || []).map((p) => p.user_id)).size;

  const total = totalUsers ?? 0;

  return {
    periodDays: PERIOD_DAYS,
    uniqueVisitors,
    totalPageviews,
    signupsInPeriod,
    signupRate: uniqueVisitors > 0 ? signupsInPeriod / uniqueVisitors : null,
    totalUsers: total,
    activatedUsers,
    activationRate: total > 0 ? activatedUsers / total : null,
    payingUsers,
    conversionRate: total > 0 ? payingUsers / total : null,
  };
}
