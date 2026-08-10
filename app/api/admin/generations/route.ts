import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function GET(request: Request) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');

  let query = supabaseAdmin
    .from('generations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error: dbError } = await query;
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
  const emailMap = new Map((authUsers?.users || []).map(u => [u.id, u.email]));

  const enriched = (data || []).map(g => ({ ...g, user_email: emailMap.get(g.user_id) || g.user_id }));
  return NextResponse.json(enriched);
}
