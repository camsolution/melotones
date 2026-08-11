import { supabaseAdmin } from '@/lib/admin';
import { checkPrediction } from '@/lib/music-generator';
import { autoRefund, requestRefundApproval, autoRejectIfPending } from '@/lib/refunds';

const STALE_THRESHOLD_MS = 15 * 60 * 1000;

// Télécharge le MP3 depuis le provider et l'upload vers Supabase Storage,
// puis marque la génération comme terminée. Réutilisé par le webhook ET le polling.
export async function finalizeIfReady(generationId: string): Promise<'completed' | 'still_processing' | 'failed'> {
  const { data: gen, error } = await supabaseAdmin
    .from('generations')
    .select('*')
    .eq('id', generationId)
    .single();

  if (error || !gen) throw new Error('Génération introuvable');
  if (gen.status === 'completed') return 'completed';
  if (gen.status === 'failed') return 'failed';
  if (!gen.prediction_id) return 'still_processing';

  const prediction = await checkPrediction(gen.prediction_id);

  if (prediction.status === 'processing') {
    const ageMs = Date.now() - new Date(gen.created_at).getTime();
    if (ageMs > STALE_THRESHOLD_MS) {
      // Cause incertaine : ni succès ni échec signalé après un délai anormalement
      // long. On ne marque PAS la génération en échec (elle peut encore aboutir),
      // on demande simplement une confirmation admin avant tout remboursement.
      await requestRefundApproval(
        generationId,
        gen.user_id,
        `Génération bloquée depuis plus de ${Math.round(ageMs / 60000)} minutes sans réponse claire du fournisseur — cause incertaine, confirmation nécessaire.`
      );
    }
    return 'still_processing';
  }

  if (prediction.status === 'failed') {
    // CAS : n'agit que si on est le premier à faire basculer ce statut, pour éviter
    // un double remboursement si le webhook et le polling arrivent en même temps.
    const { data: updated } = await supabaseAdmin
      .from('generations')
      .update({ status: 'failed' })
      .eq('id', generationId)
      .eq('status', gen.status)
      .select()
      .single();
    if (updated) await autoRefund(generationId, gen.user_id, prediction.reason);
    return 'failed';
  }

  // prediction.status === 'completed'
  const resp = await fetch(prediction.url);
  if (!resp.ok) {
    const { data: updated } = await supabaseAdmin
      .from('generations').update({ status: 'failed' }).eq('id', generationId).eq('status', gen.status).select().single();
    if (updated) await autoRefund(generationId, gen.user_id, 'Échec du téléchargement audio depuis le fournisseur');
    return 'failed';
  }

  const buffer = await resp.arrayBuffer();
  const fileName = `${gen.user_id}/${gen.id}.mp3`;
  const { error: uploadErr } = await supabaseAdmin.storage
    .from('songs')
    .upload(fileName, buffer, { contentType: 'audio/mpeg', upsert: true });

  if (uploadErr) {
    const { data: updated } = await supabaseAdmin
      .from('generations').update({ status: 'failed' }).eq('id', generationId).eq('status', gen.status).select().single();
    if (updated) await autoRefund(generationId, gen.user_id, "Échec de l'enregistrement du fichier audio");
    return 'failed';
  }

  const { data: publicData } = supabaseAdmin.storage.from('songs').getPublicUrl(fileName);
  await supabaseAdmin
    .from('generations')
    .update({ status: 'completed', audio_url: publicData.publicUrl })
    .eq('id', generationId);

  await autoRejectIfPending(generationId);

  return 'completed';
}
