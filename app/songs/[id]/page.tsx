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
    .select('occasion, style, is_public, status, cover_url')
    .eq('id', params.id)
    .single();

  if (!song || !song.is_public || song.status !== 'completed') {
    return { title: 'Chanson', robots: { index: false, follow: false } };
  }

  const occasion = occasionTranslations[song.occasion]?.fr ?? song.occasion;
  const title = `Chanson pour ${occasion} — créée avec Melotones`;
  const description = `Quelqu'un a créé cette chanson (style ${song.style}) spécialement pour cette occasion, avec Melotones. Écoute-la.`;
  // Sans cover_url (rare, génération très ancienne), on retombe sur l'image
  // sociale par défaut du site plutôt que de ne rien montrer — un aperçu vide
  // sur WhatsApp/Facebook est le principal frein au clic.
  const images = song.cover_url ? [{ url: song.cover_url, width: 1024, height: 1024 }] : undefined;

  return {
    title,
    description,
    alternates: { canonical: `/songs/${params.id}` },
    openGraph: { title, description, type: 'music.song', images, siteName: 'Melotones' },
    twitter: { card: 'summary_large_image', title, description, images: song.cover_url ? [song.cover_url] : undefined },
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
