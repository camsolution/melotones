import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabaseAdmin } from '@/lib/admin';
import { verifyCronSecret, getAdminEmails, reportRun } from '@/lib/cron';
import { sendEmail } from '@/lib/email';
import { fetchYoutubeVideoStats, fetchTiktokVideoStats, VideoStats } from '@/lib/platformAnalytics';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type PublicationRow = {
  content_asset_id: string;
  platform: string;
  external_video_id: string;
  published_at: string;
  content_assets: { title: string } | null;
};

// Ne demande une analyse à Gemini que s'il y a de vraies données à analyser —
// jamais de "stratégie" générée à partir de rien, conforme au principe du
// projet de ne jamais fabriquer de statistique ou de conclusion.
async function generateStrategyNote(rows: (PublicationRow & { stats: VideoStats | null })[]): Promise<string | null> {
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

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: publications, error: dbError } = await supabaseAdmin
      .from('platform_publications')
      .select('content_asset_id, platform, external_video_id, published_at, content_assets(title)')
      .order('published_at', { ascending: false });
    if (dbError) throw new Error(dbError.message);

    const rows = (publications || []) as unknown as PublicationRow[];
    const youtubeIds = rows.filter((r) => r.platform === 'youtube').map((r) => r.external_video_id);
    const tiktokIds = rows.filter((r) => r.platform === 'tiktok').map((r) => r.external_video_id);

    const [youtubeStats, tiktokStats] = await Promise.all([
      fetchYoutubeVideoStats(youtubeIds),
      fetchTiktokVideoStats(tiktokIds),
    ]);
    const statsById = new Map<string, VideoStats>();
    for (const s of [...youtubeStats, ...tiktokStats]) statsById.set(s.externalVideoId, s);

    const enriched = rows.map((r) => ({ ...r, stats: statsById.get(r.external_video_id) ?? null }));
    const withStats = enriched.filter((r) => r.stats);

    if (withStats.length === 0) {
      const summary = rows.length === 0
        ? 'Aucune publication suivie pour le moment.'
        : `${rows.length} publication(s) suivie(s), mais aucune statistique lisible pour l'instant (YouTube: ${youtubeIds.length}, TikTok: ${tiktokIds.length} — TikTok nécessite le scope video.list, pas encore accordé).`;
      await reportRun('social-analytics', 'success', summary);
      return NextResponse.json({ ok: true, tracked: rows.length, withStats: 0 });
    }

    const strategyNote = await generateStrategyNote(enriched);
    const summaryText = `${withStats.length}/${rows.length} publication(s) avec statistiques réelles.`;

    const adminEmails = await getAdminEmails();
    if (adminEmails.length > 0) {
      const rowsHtml = withStats
        .map((r) => `<tr><td>${r.platform}</td><td>${r.content_assets?.title ?? r.content_asset_id}</td><td>${r.stats!.viewCount ?? '—'}</td><td>${r.stats!.likeCount ?? '—'}</td><td>${r.stats!.commentCount ?? '—'}</td></tr>`)
        .join('');
      await sendEmail(
        adminEmails,
        `Performance réseaux sociaux Melotones — ${new Date().toLocaleDateString('fr-FR')}`,
        `<h2>Statistiques réelles (${withStats.length} vidéo(s))</h2>
         <table cellpadding="6" style="border-collapse:collapse;font-size:13px;"><tr style="text-align:left;border-bottom:1px solid #ddd;"><th>Réseau</th><th>Titre</th><th>Vues</th><th>Likes</th><th>Commentaires</th></tr>${rowsHtml}</table>
         ${strategyNote ? `<h2>Analyse</h2><p>${strategyNote.replace(/\n/g, '<br>')}</p>` : ''}
         <p style="color:#888;font-size:12px;">TikTok : lecture des stats indisponible tant que le scope video.list n'est pas accordé (voir tâche dans le dashboard admin).</p>`
      );
    }

    await reportRun('social-analytics', 'success', summaryText, { withStats: withStats.length, total: rows.length });
    return NextResponse.json({ ok: true, tracked: rows.length, withStats: withStats.length });
  } catch (err: any) {
    await reportRun('social-analytics', 'failure', `Échec : ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
