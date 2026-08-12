import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { balance_delta, is_admin } = await request.json();

  const { data: current } = await supabaseAdmin
    .from('user_credits')
    .select('balance')
    .eq('user_id', params.id)
    .single();

  const updates: Record<string, any> = { user_id: params.id };
  if (typeof balance_delta === 'number') {
    updates.balance = (current?.balance ?? 0) + balance_delta;
  }
  if (typeof is_admin === 'boolean') {
    updates.is_admin = is_admin;
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('user_credits')
    .upsert(updates, { onConflict: 'user_id' })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}
