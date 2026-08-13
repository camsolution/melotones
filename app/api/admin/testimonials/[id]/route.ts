import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error, status, user } = await requireAdmin();
  if (error || !user) return NextResponse.json({ error }, { status });

  const { action, notes } = await request.json();
  const allowedActions = ['approve', 'reject', 'hide', 'restore', 'mark_spam', 'mark_abuse'];
  if (!allowedActions.includes(action)) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  }

  // Mapper l'action vers le statut public
  let newStatus: string | null = null;
  if (action === 'approve' || action === 'restore') newStatus = 'approved';
  else if (action === 'reject' || action === 'hide' || action === 'mark_spam' || action === 'mark_abuse') newStatus = 'rejected';

  const updatePayload: Record<string, any> = {};
  if (newStatus) updatePayload.status = newStatus;
  if (notes) updatePayload.admin_notes = notes;
  updatePayload.reviewed_by = user.id;
  updatePayload.reviewed_at = new Date().toISOString();

  const { data, error: dbError } = await supabaseAdmin
    .from('testimonials')
    .update(updatePayload)
    .eq('id', params.id)
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  // Enregistrer l'événement d'audit
  await supabaseAdmin.from('moderation_events').insert({
    testimonial_id: params.id,
    action,
    performed_by: user.id,
    notes: notes || null,
  });

  return NextResponse.json(data);
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { error: dbError } = await supabaseAdmin.from('testimonials').delete().eq('id', params.id);
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
