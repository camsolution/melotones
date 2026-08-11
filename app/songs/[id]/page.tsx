import { createServerClientWithCookies } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/admin';
import { notFound } from 'next/navigation';
import SongDetail from '@/components/SongDetail';

export default async function SongPage({ params }: { params: { id: string } }) {
  // Lecture via service role : les chansons sont accessibles par lien
  // partageable (cadeau musical), pas réservées au propriétaire — voir
  // la discussion sécurité. isOwner détermine juste l'affichage du
  // bouton "Partager publiquement", pas l'accès à la page elle-même.
  const { data: song, error } = await supabaseAdmin
    .from('generations')
    .select('*')
    .eq('id', params.id)
    .single();
  if (error || !song) notFound();

  const supabase = createServerClientWithCookies();
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === song.user_id;

  return <SongDetail song={song} isOwner={isOwner} />;
}
