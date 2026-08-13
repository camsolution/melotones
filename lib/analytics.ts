import { supabaseAdmin } from '@/lib/admin';

const PERIOD_DAYS = 30;

export type AnalyticsSeriesPoint = { date: string; visitors: number; pageviews: number; signups: number };

export async function computeAnalytics() {
  const since = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: views }, { count: totalUsers }, { data: completedGens }, { data: approvedPurchases }, { data: authUsersData }] = await Promise.all([
    supabaseAdmin.from('page_views').select('session_id, created_at').gte('created_at', since),
    supabaseAdmin.from('user_credits').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('generations').select('user_id').eq('status', 'completed'),
    supabaseAdmin.from('purchase_requests').select('user_id').eq('status', 'approved'),
    // user_credits n'a pas de colonne created_at — la date d'inscription fiable
    // est auth.users.created_at (garantie par Supabase Auth).
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const uniqueVisitors = new Set((views || []).map((v) => v.session_id)).size;
  const totalPageviews = (views || []).length;

  const authUsers = authUsersData?.users || [];
  const sinceMs = new Date(since).getTime();
  const signupsInPeriod = authUsers.filter((u) => new Date(u.created_at).getTime() >= sinceMs).length;

  const activatedUsers = new Set((completedGens || []).map((g) => g.user_id)).size;
  const payingUsers = new Set((approvedPurchases || []).map((p) => p.user_id)).size;

  const total = totalUsers ?? 0;

  // Séries journalières pour le graphique — mêmes données que ci-dessus,
  // reventilées jour par jour plutôt qu'agrégées sur toute la période.
  const days: string[] = [];
  for (let i = PERIOD_DAYS - 1; i >= 0; i--) {
    days.push(new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }
  const visitorsByDay = new Map<string, Set<string>>();
  const pageviewsByDay = new Map<string, number>();
  for (const v of views || []) {
    const day = v.created_at.slice(0, 10);
    pageviewsByDay.set(day, (pageviewsByDay.get(day) || 0) + 1);
    if (!visitorsByDay.has(day)) visitorsByDay.set(day, new Set());
    visitorsByDay.get(day)!.add(v.session_id);
  }
  const signupsByDay = new Map<string, number>();
  for (const u of authUsers) {
    const day = u.created_at.slice(0, 10);
    signupsByDay.set(day, (signupsByDay.get(day) || 0) + 1);
  }
  const series: AnalyticsSeriesPoint[] = days.map((date) => ({
    date,
    visitors: visitorsByDay.get(date)?.size ?? 0,
    pageviews: pageviewsByDay.get(date) ?? 0,
    signups: signupsByDay.get(date) ?? 0,
  }));

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
    series,
  };
}
