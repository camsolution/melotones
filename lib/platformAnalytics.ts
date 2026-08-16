import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from '@/lib/admin';
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

export type PublicationRow = {
  content_asset_id: string;
  platform: string;
  external_video_id: string;
  published_at: string;
  content_assets: { title: string } | null;
  stats: VideoStats | null;
};

export type SocialSnapshot = {
  rows: PublicationRow[];
  withStats: PublicationRow[];
  strategyNote: string | null;
};

// Ne demande une analyse à Gemini que s'il y a de vraies données à analyser —
// jamais de "stratégie" générée à partir de rien, conforme au principe du
// projet de ne jamais fabriquer de statistique ou de conclusion. Partagée
// entre le cron hebdomadaire (social-analytics) et le rapport agent
// à la demande, pour ne jamais avoir deux versions de cette logique.
async function generateStrategyNote(rows: PublicationRow[]): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const dataLines = rows
    .filter((r) => r.stats)
    .map((r) => `- [${r.platform}] "${r.content_assets?.title ?? r.content_asset_id}" — vues: ${r.stats!.viewCount ?? 'n/a'}, likes: ${r.stats!.likeCount ?? 'n/a'}, commentaires: ${r.stats!.commentCount ?? 'n/a'}`)
    .join('\n');
  if (!dataLines) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  const prompt = `Tu analyses les performances réelles des contenus marketing de Melotones (chansons personnalisées par IA, diaspora africaine) sur les réseaux sociaux.

Données réelles (${rows.filter((r) => r.stats).length} vidéo(s)) :
${dataLines}

Écris une note courte en français (5-8 lignes max) :
- Ce qui ressort de CES chiffres précis (ne compare/déduis qu'à partir de ce qui est donné, n'invente aucun chiffre supplémentaire).
- Si l'échantillon est petit (moins de 5 vidéos), dis-le explicitement et qualifie toute conclusion de préliminaire.
- 2-3 suggestions concrètes et actionnables pour la suite, ancrées dans ces données, pas des conseils marketing génériques.
Réponds uniquement avec le texte de la note, sans titre ni préambule.`;

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('generateStrategyNote failed:', err);
    return null;
  }
}

export async function computeSocialSnapshot(): Promise<SocialSnapshot> {
  const { data: publications, error: dbError } = await supabaseAdmin
    .from('platform_publications')
    .select('content_asset_id, platform, external_video_id, published_at, content_assets(title)')
    .order('published_at', { ascending: false });
  if (dbError) throw new Error(dbError.message);

  const rows = (publications || []) as unknown as Omit<PublicationRow, 'stats'>[];
  const youtubeIds = rows.filter((r) => r.platform === 'youtube').map((r) => r.external_video_id);
  const tiktokIds = rows.filter((r) => r.platform === 'tiktok').map((r) => r.external_video_id);

  const [youtubeStats, tiktokStats] = await Promise.all([
    fetchYoutubeVideoStats(youtubeIds),
    fetchTiktokVideoStats(tiktokIds),
  ]);
  const statsById = new Map<string, VideoStats>();
  for (const s of [...youtubeStats, ...tiktokStats]) statsById.set(s.externalVideoId, s);

  const enriched: PublicationRow[] = rows.map((r) => ({ ...r, stats: statsById.get(r.external_video_id) ?? null }));
  const withStats = enriched.filter((r) => r.stats);
  const strategyNote = await generateStrategyNote(enriched);

  return { rows: enriched, withStats, strategyNote };
}
