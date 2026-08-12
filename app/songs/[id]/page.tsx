import { createServerClientWithCookies } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/admin';
import { notFound } from 'next/navigation';
import SongDetail from '@/components/SongDetail';
import { occasionTranslations } from '@/lib/listTranslations';
import type { Metadata } from 'next';

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const { data: song } = await supabaseAdmin
    .from('generations')
    .select('occasion, style, is_public, status')
    .eq('id', params.id)
    .single();

  if (!song || !song.is_public || song.status !== 'completed') {
    return { title: 'Chanson', robots: { index: false, follow: false } };
  }

  const occasion = occasionTranslations[song.occasion]?.fr ?? song.occasion;
  const title = `Chanson pour ${occasion} — créée avec Melotones`;
  const description = `Écoutez cette chanson personnalisée (style ${song.style}) composée par intelligence artificielle sur Melotones, pour ${occasion}.`;

  return {
    title,
    description,
    alternates: { canonical: `/songs/${params.id}` },
    openGraph: { title, description, type: 'music.song' },
  };
}

export default async function SongPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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

  const supabase = await createServerClientWithCookies();
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === song.user_id;

  return <SongDetail song={song} isOwner={isOwner} />;
}
