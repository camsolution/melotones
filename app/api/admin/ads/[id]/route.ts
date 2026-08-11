import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const updates = await request.json();
  const allowed = ['advertiser_name', 'media_url', 'media_type', 'target_url', 'active', 'sort_order'];
  const filtered: Record<string, any> = {};
  for (const key of allowed) if (key in updates) filtered[key] = updates[key];

  const { data, error: dbError } = await supabaseAdmin
    .from('ad_campaigns')
    .update(filtered)
    .eq('id', params.id)
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { error: dbError } = await supabaseAdmin.from('ad_campaigns').delete().eq('id', params.id);
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
