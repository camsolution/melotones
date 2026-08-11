import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { error, status, user } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { action } = await request.json(); // 'approve' | 'reject'
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  }

  // Compare-and-swap : ne bascule le statut que s'il est encore "pending".
  // Fait AVANT tout octroi de crédits, pour qu'un double-clic (ou deux
  // requêtes concurrentes) ne puisse pas créditer deux fois le même achat.
  const { data: req, error: casError } = await supabaseAdmin
    .from('purchase_requests')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user!.id,
    })
    .eq('id', params.id)
    .eq('status', 'pending')
    .select()
    .single();

  if (casError || !req) {
    return NextResponse.json({ error: 'Demande introuvable ou déjà traitée' }, { status: 409 });
  }

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

  return NextResponse.json(req);
}
