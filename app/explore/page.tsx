import { fetchPublicCommunitySongs } from '@/lib/communitySongs';
import ExploreContent from '@/components/ExploreContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Explorer les chansons créées par la communauté',
  description: "Écoutez des chansons personnalisées créées par la communauté Melotones grâce à l'intelligence artificielle.",
  alternates: { canonical: '/explore' },
};

export default async function ExplorePage(
  props: { searchParams: Promise<{ occasion?: string; style?: string; q?: string }> }
) {
  const searchParams = await props.searchParams;
  const songs = await fetchPublicCommunitySongs(searchParams);
  return <ExploreContent songs={songs} />;
}
