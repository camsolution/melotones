import { fetchPublicCommunitySongs } from '@/lib/communitySongs';
import ExploreContent from '@/components/ExploreContent';

export const dynamic = 'force-dynamic';

export default async function ExplorePage({ searchParams }: { searchParams: { occasion?: string; style?: string; q?: string } }) {
  const songs = await fetchPublicCommunitySongs(searchParams);
  return <ExploreContent songs={songs} />;
}
