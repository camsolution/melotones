import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json();
  const patch: Record<string, any> = {};
  if (typeof body.subject === 'string') patch.subject = body.subject.trim();
  if (typeof body.body_html === 'string') patch.body_html = body.body_html;
  if (typeof body.audience === 'string' && ['all', 'active', 'inactive'].includes(body.audience)) patch.audience = body.audience;

  const { data, error: dbError } = await supabaseAdmin
    .from('email_campaigns')
    .update(patch)
    .eq('id', params.id)
    .eq('status', 'draft')
    .select()
    .single();

  if (dbError || !data) return NextResponse.json({ error: "Introuvable ou déjà envoyée" }, { status: 409 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { error: dbError } = await supabaseAdmin
    .from('email_campaigns')
    .delete()
    .eq('id', params.id)
    .eq('status', 'draft');

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
