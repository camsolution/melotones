import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const updates = await request.json();
  if ('discount_percent' in updates && (updates.discount_percent < 1 || updates.discount_percent > 100)) {
    return NextResponse.json({ error: 'Remise invalide (1-100%)' }, { status: 400 });
  }
  const allowed = ['discount_percent', 'quota', 'active'];
  const filtered: Record<string, any> = {};
  for (const key of allowed) if (key in updates) filtered[key] = updates[key];

  const { data, error: dbError } = await supabaseAdmin
    .from('coupons')
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

  const { error: dbError } = await supabaseAdmin.from('coupons').delete().eq('id', params.id);
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
