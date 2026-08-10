import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const [{ data: authUsers }, { data: credits }, { data: generations }] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers(),
    supabaseAdmin.from('user_credits').select('*'),
    supabaseAdmin.from('generations').select('user_id, status'),
  ]);

  const creditMap = new Map((credits || []).map(c => [c.user_id, c]));
  const genCountMap = new Map<string, number>();
  (generations || []).forEach(g => {
    genCountMap.set(g.user_id, (genCountMap.get(g.user_id) || 0) + 1);
  });

  const users = (authUsers?.users || []).map(u => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    balance: creditMap.get(u.id)?.balance ?? 0,
    is_admin: creditMap.get(u.id)?.is_admin ?? false,
    generations_count: genCountMap.get(u.id) ?? 0,
  }));

  return NextResponse.json(users);
}
