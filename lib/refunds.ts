import { supabaseAdmin } from '@/lib/admin';

async function creditUser(userId: string, credits: number) {
  const { data: fresh } = await supabaseAdmin.from('user_credits').select('balance').eq('user_id', userId).single();
  if (!fresh) return;
  await supabaseAdmin.from('user_credits').update({ balance: fresh.balance + credits }).eq('user_id', userId).eq('balance', fresh.balance);
}

// Panne technique avérée (le fournisseur a explicitement signalé un échec, ou le
// téléchargement/enregistrement du fichier a échoué) : on rembourse immédiatement
// et on log quand même la demande — déjà "approved" — pour que ce soit visible et
// traçable dans le dashboard, sans action requise de l'admin.
export async function autoRefund(generationId: string, userId: string, reason: string) {
  const { data: creditRow } = await supabaseAdmin.from('user_credits').select('is_admin').eq('user_id', userId).single();
  if (creditRow?.is_admin) return; // rien n'a été débité, rien à rembourser

  const { data: existing } = await supabaseAdmin
    .from('refund_requests')
    .select('id, status')
    .eq('generation_id', generationId)
    .maybeSingle();

  if (!existing) {
    await supabaseAdmin.from('refund_requests').insert({
      generation_id: generationId, user_id: userId, credits: 1, reason, status: 'approved', reviewed_at: new Date().toISOString(),
    });
    await creditUser(userId, 1);
    return;
  }

  // Une demande "incertaine" avait déjà été créée (génération bloquée) — on a
  // maintenant la certitude que c'est technique, on la fait passer à approuvée.
  if (existing.status === 'pending') {
    const { data: updated } = await supabaseAdmin
      .from('refund_requests')
      .update({ status: 'approved', reason, reviewed_at: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('status', 'pending')
      .select()
      .single();
    if (updated) await creditUser(userId, 1);
  }
}

// Cause incertaine (génération bloquée sans signal clair de succès ou d'échec) :
// on ne rembourse pas tout seul, on demande une confirmation admin explicite.
export async function requestRefundApproval(generationId: string, userId: string, reason: string) {
  const { data: creditRow } = await supabaseAdmin.from('user_credits').select('is_admin').eq('user_id', userId).single();
  if (creditRow?.is_admin) return;

  const { data: existing } = await supabaseAdmin
    .from('refund_requests')
    .select('id')
    .eq('generation_id', generationId)
    .maybeSingle();
  if (existing) return;

  await supabaseAdmin.from('refund_requests').insert({
    generation_id: generationId, user_id: userId, credits: 1, reason, status: 'pending',
  });
}

// La génération a finalement abouti après avoir été signalée comme bloquée :
// la demande de remboursement en attente n'a plus lieu d'être.
export async function autoRejectIfPending(generationId: string) {
  await supabaseAdmin
    .from('refund_requests')
    .update({
      status: 'rejected',
      reason: "Annulée automatiquement : la génération a finalement abouti avec succès.",
      reviewed_at: new Date().toISOString(),
    })
    .eq('generation_id', generationId)
    .eq('status', 'pending');
}
