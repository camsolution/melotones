import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function POST(request: Request) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json();
  const { code, partner_id, discount_percent, quota } = body;
  if (!code || !partner_id || !discount_percent) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }
  if (discount_percent < 1 || discount_percent > 100) {
    return NextResponse.json({ error: 'Remise invalide (1-100%)' }, { status: 400 });
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('coupons')
    .insert({
      code: String(code).trim().toUpperCase(),
      partner_id,
      discount_percent,
      quota: quota || null,
    })
    .select()
    .single();

  if (dbError) {
    const msg = dbError.message.includes('duplicate') ? 'Ce code existe déjà' : dbError.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json(data);
}
