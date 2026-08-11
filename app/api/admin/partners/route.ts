import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { data: partners, error: dbError } = await supabaseAdmin
    .from('partners')
    .select('*')
    .order('created_at', { ascending: false });
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  const { data: coupons } = await supabaseAdmin.from('coupons').select('*');
  const withCoupons = (partners || []).map((p) => ({
    ...p,
    coupons: (coupons || []).filter((c) => c.partner_id === p.id),
  }));

  return NextResponse.json(withCoupons);
}

export async function POST(request: Request) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json();
  const { name, contact_email, contact_phone, notes } = body;
  if (!name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 });

  const { data, error: dbError } = await supabaseAdmin
    .from('partners')
    .insert({ name, contact_email: contact_email || null, contact_phone: contact_phone || null, notes: notes || null })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}
