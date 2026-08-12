import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { action } = await request.json();
  if (!['done', 'dismiss', 'reopen'].includes(action)) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  }

  const newStatus = action === 'done' ? 'done' : action === 'dismiss' ? 'dismissed' : 'pending';
  const { data, error: dbError } = await supabaseAdmin
    .from('human_tasks')
    .update({ status: newStatus, completed_at: newStatus === 'pending' ? null : new Date().toISOString() })
    .eq('id', params.id)
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { error: dbError } = await supabaseAdmin.from('human_tasks').delete().eq('id', params.id);
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
