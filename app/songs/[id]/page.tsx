import { createServerClientWithCookies } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import SongDetail from '@/components/SongDetail';

export default async function SongPage({ params }: { params: { id: string } }) {
  const supabase = createServerClientWithCookies();
  const { data: song, error } = await supabase
    .from('generations')
    .select('*')
    .eq('id', params.id)
    .single();
  if (error || !song) notFound();
  return <SongDetail song={song} />;
}
