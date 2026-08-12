import { supabaseAdmin } from '@/lib/admin';
import { logProviderError } from '@/lib/providerErrors';

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

  // CAS avec relecture en boucle : deux approbations concurrentes pour le même
  // utilisateur (ex. deux webhooks PayDunya rapprochés pour deux achats
  // distincts) ne doivent jamais s'écraser l'une l'autre et faire perdre des Chansons.
  let credited = false;
  for (let attempt = 0; attempt < 5 && !credited; attempt++) {
    const { data: creditRow } = await supabaseAdmin.from('user_credits').select('balance').eq('user_id', req.user_id).single();
    if (!creditRow) {
      const { error: insertErr } = await supabaseAdmin.from('user_credits').insert({ user_id: req.user_id, balance: req.credits });
      if (!insertErr) { credited = true; break; }
      continue; // une ligne a été créée entre-temps par une autre requête concurrente : on relit
    }
    const { data: updated } = await supabaseAdmin
      .from('user_credits')
      .update({ balance: creditRow.balance + req.credits })
      .eq('user_id', req.user_id)
      .eq('balance', creditRow.balance)
      .select()
      .single();
    if (updated) credited = true;
  }
  if (!credited) {
    await logProviderError(null, req.user_id, `Paiement approuvé (purchase_request ${req.id}) mais échec du crédit de ${req.credits} Chansons après 5 tentatives — intervention manuelle requise.`, 'paydunya');
    return { ok: false, error: 'Échec du crédit des Chansons après plusieurs tentatives (contention)', status: 500 };
  }

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
