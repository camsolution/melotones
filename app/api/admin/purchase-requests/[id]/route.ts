import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { error, status, user } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { action } = await request.json(); // 'approve' | 'reject'
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  }

  const { data: req, error: fetchError } = await supabaseAdmin
    .from('purchase_requests')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchError || !req) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
  if (req.status !== 'pending') return NextResponse.json({ error: 'Déjà traitée' }, { status: 409 });

  if (action === 'approve') {
    const { data: creditRow } = await supabaseAdmin
      .from('user_credits')
      .select('balance')
      .eq('user_id', req.user_id)
      .single();

    const newBalance = (creditRow?.balance ?? 0) + req.credits;

    const { error: updateCreditError } = await supabaseAdmin
      .from('user_credits')
      .upsert({ user_id: req.user_id, balance: newBalance });

    if (updateCreditError) {
      return NextResponse.json({ error: updateCreditError.message }, { status: 500 });
    }

    if (req.coupon_id) {
      const { data: coupon } = await supabaseAdmin.from('coupons').select('used_count').eq('id', req.coupon_id).single();
      if (coupon) {
        await supabaseAdmin.from('coupons').update({ used_count: coupon.used_count + 1 }).eq('id', req.coupon_id);
      }
    }
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('purchase_requests')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user!.id,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json(updated);
}
