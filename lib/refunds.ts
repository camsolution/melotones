import { supabaseAdmin } from '@/lib/admin';

// Crée une demande de remboursement en attente (jamais de crédit direct) —
// l'admin doit approuver depuis le dashboard. Idempotent : n'insère rien si
// une demande existe déjà pour cette génération (le webhook et le sondage
// peuvent tous deux tomber sur le même échec).
export async function flagRefund(generationId: string, userId: string, reason: string) {
  const { data: creditRow } = await supabaseAdmin
    .from('user_credits')
    .select('is_admin')
    .eq('user_id', userId)
    .single();
  if (creditRow?.is_admin) return; // rien n'a été débité, rien à rembourser

  const { data: existing } = await supabaseAdmin
    .from('refund_requests')
    .select('id')
    .eq('generation_id', generationId)
    .maybeSingle();
  if (existing) return;

  await supabaseAdmin.from('refund_requests').insert({
    generation_id: generationId,
    user_id: userId,
    credits: 1,
    reason,
    status: 'pending',
  });
}
