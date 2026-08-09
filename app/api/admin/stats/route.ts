import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const [{ count: totalUsers }, { count: totalGenerations }, { count: pendingRequests }, { data: approvedRequests }] = await Promise.all([
    supabaseAdmin.from('user_credits').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('generations').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('purchase_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('purchase_requests').select('price_fcfa').eq('status', 'approved'),
  ]);

  const totalRevenueFcfa = (approvedRequests || []).reduce((sum, r) => sum + (r.price_fcfa || 0), 0);

  return NextResponse.json({
    totalUsers: totalUsers ?? 0,
    totalGenerations: totalGenerations ?? 0,
    pendingRequests: pendingRequests ?? 0,
    totalRevenueFcfa,
  });
}
