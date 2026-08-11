import { supabaseAdmin } from '@/lib/admin';
import { occasionTranslations } from '@/lib/listTranslations';
import { ExampleSong } from '@/types';

// Les chansons "communauté" sont de vraies générations utilisateur, montrées
// uniquement si le propriétaire a explicitement activé le partage public
// (generations.is_public). Lu via service role : RLS restreint generations
// à "ses propres lignes" pour le client, donc cette lecture volontairement
// cross-utilisateurs doit passer par le serveur de confiance, qui applique
// lui-même le filtre is_public=true.
export async function fetchPublicCommunitySongs(filters: {
  occasion?: string;
  style?: string;
  q?: string;
}): Promise<ExampleSong[]> {
  let query = supabaseAdmin
    .from('generations')
    .select('id, occasion, style, audio_url')
    .eq('is_public', true)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(30);

  if (filters.occasion) query = query.eq('occasion', filters.occasion);
  if (filters.style) query = query.eq('style', filters.style);

  const { data, error } = await query;
  if (error || !data) return [];

  const songs: ExampleSong[] = data
    .filter((g) => g.audio_url)
    .map((g) => ({
      id: g.id,
      title: occasionTranslations[g.occasion]?.fr ?? g.occasion,
      occasion: g.occasion,
      style: g.style,
      audio_url: g.audio_url as string,
      description: null,
      plays: 0,
    }));

  if (!filters.q) return songs;
  const q = filters.q.toLowerCase();
  return songs.filter((s) => s.title.toLowerCase().includes(q) || s.style.toLowerCase().includes(q));
}
