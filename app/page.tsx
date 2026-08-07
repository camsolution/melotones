import { createServerClientWithCookies } from '@/lib/supabase/server';
import HomeContent from '@/components/HomeContent';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: { occasion?: string; style?: string; q?: string } }) {
  const supabase = createServerClientWithCookies();
  let query = supabase.from('example_songs').select('*').order('created_at', { ascending: false });
  if (searchParams.occasion) query = query.eq('occasion', searchParams.occasion);
  if (searchParams.style) query = query.eq('style', searchParams.style);
  if (searchParams.q) query = query.ilike('title', `%${searchParams.q}%`);
  const { data: exampleSongs, error } = await query;
  if (error) console.error(error);
  return <HomeContent exampleSongs={exampleSongs || []} />;
}
