import { supabaseAdmin } from '@/lib/admin';

// Réutilisé par l'approbation manuelle admin ET par les webhooks fournisseur
// (paiement confirmé automatiquement) — même verrou anti-double-crédit dans
// les deux cas : compare-and-swap sur le statut avant tout octroi de crédits.
export async function approvePurchaseRequest(id: string, reviewedBy: string | null): Promise<{ ok: boolean; error?: string; status?: number }> {
  const { data: req, error: casError } = await supabaseAdmin
    .from('purchase_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: reviewedBy })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single();

  if (casError || !req) return { ok: false, error: 'Demande introuvable ou déjà traitée', status: 409 };

  const { data: creditRow } = await supabaseAdmin.from('user_credits').select('balance').eq('user_id', req.user_id).single();
  const newBalance = (creditRow?.balance ?? 0) + req.credits;

  const { error: updateCreditError } = await supabaseAdmin.from('user_credits').upsert({ user_id: req.user_id, balance: newBalance });
  if (updateCreditError) return { ok: false, error: updateCreditError.message, status: 500 };

  if (req.coupon_id) {
    const { data: coupon } = await supabaseAdmin.from('coupons').select('used_count').eq('id', req.coupon_id).single();
    if (coupon) await supabaseAdmin.from('coupons').update({ used_count: coupon.used_count + 1 }).eq('id', req.coupon_id);
  }

  return { ok: true };
}

export async function rejectPurchaseRequest(id: string, reviewedBy: string | null): Promise<{ ok: boolean }> {
  const { data } = await supabaseAdmin
    .from('purchase_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: reviewedBy })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single();
  return { ok: !!data };
}
