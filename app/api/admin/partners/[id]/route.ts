import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const updates = await request.json();
  const allowed = ['name', 'contact_email', 'contact_phone', 'notes', 'active', 'commission_percent'];
  const filtered: Record<string, any> = {};
  for (const key of allowed) if (key in updates) filtered[key] = updates[key];

  if ('commission_percent' in filtered) {
    const pct = Number(filtered.commission_percent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return NextResponse.json({ error: 'Commission invalide (0 à 100).' }, { status: 400 });
    }
    filtered.commission_percent = pct;
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('partners')
    .update(filtered)
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

  await supabaseAdmin.from('coupons').delete().eq('partner_id', params.id);
  const { error: dbError } = await supabaseAdmin.from('partners').delete().eq('id', params.id);
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
