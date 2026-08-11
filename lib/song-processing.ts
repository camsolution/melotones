import { supabaseAdmin } from '@/lib/admin';
import { checkPrediction } from '@/lib/music-generator';
import { flagRefund } from '@/lib/refunds';

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

  const audioUrl = await checkPrediction(gen.prediction_id);
  if (!audioUrl) return 'still_processing';

  const resp = await fetch(audioUrl);
  if (!resp.ok) {
    await supabaseAdmin.from('generations').update({ status: 'failed' }).eq('id', generationId);
    await flagRefund(generationId, gen.user_id, 'Échec du téléchargement audio depuis le fournisseur');
    return 'failed';
  }

  const buffer = await resp.arrayBuffer();
  const fileName = `${gen.user_id}/${gen.id}.mp3`;
  const { error: uploadErr } = await supabaseAdmin.storage
    .from('songs')
    .upload(fileName, buffer, { contentType: 'audio/mpeg', upsert: true });

  if (uploadErr) {
    await supabaseAdmin.from('generations').update({ status: 'failed' }).eq('id', generationId);
    await flagRefund(generationId, gen.user_id, 'Échec de l\'enregistrement du fichier audio');
    return 'failed';
  }

  const { data: publicData } = supabaseAdmin.storage.from('songs').getPublicUrl(fileName);
  await supabaseAdmin
    .from('generations')
    .update({ status: 'completed', audio_url: publicData.publicUrl })
    .eq('id', generationId);

  return 'completed';
}
