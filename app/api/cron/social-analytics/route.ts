import { NextResponse } from 'next/server';
import { verifyCronSecret, getAdminEmails, reportRun } from '@/lib/cron';
import { sendEmail } from '@/lib/email';
import { computeSocialSnapshot } from '@/lib/platformAnalytics';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { rows, withStats, strategyNote } = await computeSocialSnapshot();

    if (withStats.length === 0) {
      const youtubeCount = rows.filter((r) => r.platform === 'youtube').length;
      const tiktokCount = rows.filter((r) => r.platform === 'tiktok').length;
      const summary = rows.length === 0
        ? 'Aucune publication suivie pour le moment.'
        : `${rows.length} publication(s) suivie(s), mais aucune statistique lisible pour l'instant (YouTube: ${youtubeCount}, TikTok: ${tiktokCount} — TikTok nécessite le scope video.list, pas encore accordé).`;
      await reportRun('social-analytics', 'success', summary);
      return NextResponse.json({ ok: true, tracked: rows.length, withStats: 0 });
    }

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
