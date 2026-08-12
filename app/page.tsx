import { redirect } from 'next/navigation';
import { createServerClientWithCookies } from '@/lib/supabase/server';
import { fetchPublicCommunitySongs } from '@/lib/communitySongs';
import { fetchPublicTestimonials } from '@/lib/testimonials';
import HomeContent from '@/components/HomeContent';

export default async function Home() {
  const supabase = await createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) redirect('/dashboard');

  const [exampleSongs, testimonials] = await Promise.all([
    fetchPublicCommunitySongs({}),
    fetchPublicTestimonials(),
  ]);
  return <HomeContent exampleSongs={exampleSongs} testimonials={testimonials} />;
}
