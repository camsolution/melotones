import { youtubeApi } from '@/lib/youtube';
import { tiktokApi, isTiktokConfigured } from '@/lib/tiktok';

export type VideoStats = {
  externalVideoId: string;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
};

// youtube.readonly est déjà accordé (voir authorize route) — fonctionne dès
// maintenant, contrairement à TikTok ci-dessous.
export async function fetchYoutubeVideoStats(videoIds: string[]): Promise<VideoStats[]> {
  if (videoIds.length === 0) return [];
  const res = await youtubeApi(`/videos?part=statistics&id=${videoIds.join(',')}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((item: any) => ({
    externalVideoId: item.id,
    viewCount: item.statistics?.viewCount != null ? Number(item.statistics.viewCount) : null,
    likeCount: item.statistics?.likeCount != null ? Number(item.statistics.likeCount) : null,
    commentCount: item.statistics?.commentCount != null ? Number(item.statistics.commentCount) : null,
    shareCount: null, // pas exposé par l'API YouTube
  }));
}

// Non vérifié en réel : le scope video.list n'est pas encore accordé sur le
// compte TikTok connecté (voir human_tasks — "TikTok — Ajouter le scope
// video.list"). De plus, external_video_id stocké est le publish_id du dépôt
// en brouillon, pas forcément le video_id final une fois publié par l'humain
// — cet appel échouera probablement tant que ces deux points ne sont pas
// résolus. Retourne un tableau vide plutôt que de planter le digest.
export async function fetchTiktokVideoStats(videoIds: string[]): Promise<VideoStats[]> {
  if (videoIds.length === 0 || !isTiktokConfigured()) return [];
  try {
    const res = await tiktokApi('/video/query/?fields=id,view_count,like_count,comment_count,share_count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters: { video_ids: videoIds } }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data?.videos || []).map((v: any) => ({
      externalVideoId: v.id,
      viewCount: v.view_count ?? null,
      likeCount: v.like_count ?? null,
      commentCount: v.comment_count ?? null,
      shareCount: v.share_count ?? null,
    }));
  } catch {
    return [];
  }
}
