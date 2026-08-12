import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin, getEmailsByIds } from '@/lib/admin';

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { data: partner } = await supabaseAdmin.from('partners').select('name').eq('id', params.id).single();
  if (!partner) return NextResponse.json({ error: 'Partenaire introuvable' }, { status: 404 });

  const { data: coupons } = await supabaseAdmin.from('coupons').select('id, code').eq('partner_id', params.id);
  const couponIds = (coupons || []).map((c) => c.id);
  const couponByIdCode = new Map((coupons || []).map((c) => [c.id, c.code]));

  let rows: any[] = [];
  if (couponIds.length > 0) {
    const { data, error: dbError } = await supabaseAdmin
      .from('purchase_requests')
      .select('*')
      .in('coupon_id', couponIds)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    rows = data || [];
  }

  const emailsById = await getEmailsByIds(rows.map((r) => r.user_id));

  const header = ['Email', 'Coupon', 'Pack', 'Chansons', 'Prix payé (FCFA)', 'Date'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      csvEscape(emailsById.get(r.user_id) || r.user_id),
      csvEscape(couponByIdCode.get(r.coupon_id) || ''),
      csvEscape(r.pack_id),
      String(r.credits),
      String(r.price_fcfa),
      new Date(r.created_at).toLocaleString('fr-FR'),
    ].join(','));
  }

  const csv = lines.join('\n');
  const fileName = `rapport-${partner.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
