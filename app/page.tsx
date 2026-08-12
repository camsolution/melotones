import { redirect } from 'next/navigation';
import { createServerClientWithCookies } from '@/lib/supabase/server';
import { fetchPublicCommunitySongs } from '@/lib/communitySongs';
import HomeContent from '@/components/HomeContent';

export default async function Home() {
  const supabase = createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) redirect('/dashboard');

  const exampleSongs = await fetchPublicCommunitySongs({});
  return <HomeContent exampleSongs={exampleSongs} />;
}
