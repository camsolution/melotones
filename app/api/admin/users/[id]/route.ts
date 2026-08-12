import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error, status, user } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { balance_delta, balance_set, is_admin } = await request.json();

  if (is_admin === false && params.id === user!.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas retirer vos propres privilèges admin." }, { status: 400 });
  }

  const { data: current } = await supabaseAdmin
    .from('user_credits')
    .select('balance')
    .eq('user_id', params.id)
    .single();

  const updates: Record<string, any> = { user_id: params.id };
  if (typeof balance_delta === 'number') {
    updates.balance = (current?.balance ?? 0) + balance_delta;
  } else if (typeof balance_set === 'number') {
    updates.balance = balance_set;
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

const USER_ROW_TABLES = [
  'generations', 'purchase_requests', 'refund_requests', 'chat_messages',
  'chat_conversations', 'presence', 'provider_errors', 'user_credits',
];

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error, status, user } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  if (params.id === user!.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, { status: 400 });
  }

  for (const table of USER_ROW_TABLES) {
    await supabaseAdmin.from(table).delete().eq('user_id', params.id);
  }
  await supabaseAdmin.from('profiles').delete().eq('id', params.id);

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(params.id);
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
