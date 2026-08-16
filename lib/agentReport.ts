import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '@/lib/admin';
import { getPendingTasks } from '@/lib/humanTasks';
import { computeSocialSnapshot, SocialSnapshot } from '@/lib/platformAnalytics';

const ASSET_STATUS_LABELS_FR: Record<string, string> = {
  DISCOVERED: 'Découvert', CLASSIFIED: 'Classé', DRAFT: 'Brouillon', READY_FOR_REVIEW: 'Prêt pour révision',
  APPROVED: 'Approuvé', EXPORTING: 'Export en cours', EXPORTED: 'Exporté', SCHEDULED: 'Programmé',
  PUBLISHED: 'Publié', FAILED: 'Échec', ARCHIVED: 'Archivé', REJECTED: 'Rejeté',
  MANUAL_UPLOAD_REQUIRED: 'Action manuelle requise',
};

export type AgentReportData = {
  generatedAt: string;
  pipelineCounts: { status: string; label: string; count: number }[];
  failedAssets: { title: string; error: string | null }[];
  pendingTasks: { title: string; description: string | null }[];
  social: SocialSnapshot;
  recentRuns: { agentSlug: string; status: string; summary: string; ranAt: string }[];
};

// Consolide tout ce que les agents ont fait/appris récemment en un seul état
// des lieux — même source de données que le PDF (buildAgentReportPdf) et le
// mail quotidien (cron agent-report), pour ne jamais avoir deux versions.
export async function computeAgentReport(): Promise<AgentReportData> {
  const [assetsRes, pendingTasks, social, runsRes] = await Promise.all([
    supabaseAdmin.from('content_assets').select('status, title, sync_error'),
    getPendingTasks(),
    computeSocialSnapshot(),
    supabaseAdmin.from('automation_runs').select('agent_slug, status, summary, ran_at').order('ran_at', { ascending: false }).limit(10),
  ]);

  const assets = assetsRes.data || [];
  const counts = new Map<string, number>();
  for (const a of assets) counts.set(a.status, (counts.get(a.status) || 0) + 1);
  const pipelineCounts = Array.from(counts.entries())
    .map(([status, count]) => ({ status, label: ASSET_STATUS_LABELS_FR[status] || status, count }))
    .sort((a, b) => b.count - a.count);

  const failedAssets = assets
    .filter((a) => a.status === 'FAILED')
    .map((a) => ({ title: a.title, error: a.sync_error }));

  return {
    generatedAt: new Date().toISOString(),
    pipelineCounts,
    failedAssets,
    pendingTasks: pendingTasks.map((t) => ({ title: t.title, description: t.description })),
    social,
    recentRuns: (runsRes.data || []).map((r) => ({ agentSlug: r.agent_slug, status: r.status, summary: r.summary, ranAt: r.ran_at })),
  };
}

// Même contournement pdfkit que app/api/admin/partners/[id]/report (polices
// standard indisponibles dans le bundle serverless Vercel).
export async function buildAgentReportPdf(data: AgentReportData): Promise<Buffer> {
  const regularFont = fs.readFileSync(path.join(process.cwd(), 'assets/fonts/Ubuntu-Regular.ttf'));
  const boldFont = fs.readFileSync(path.join(process.cwd(), 'assets/fonts/Ubuntu-Bold.ttf'));

  const doc = new PDFDocument({ margin: 40, size: 'A4', font: false as any });
  doc.registerFont('Ubuntu', regularFont);
  doc.registerFont('Ubuntu-Bold', boldFont);
  doc.font('Ubuntu');

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const section = (title: string) => {
    doc.moveDown(1);
    doc.font('Ubuntu-Bold').fillColor('#7c3aed').fontSize(13).text(title);
    doc.moveTo(40, doc.y + 2).lineTo(555, doc.y + 2).strokeColor('#e4def2').stroke();
    doc.moveDown(0.5);
    doc.font('Ubuntu').fillColor('#150E29').fontSize(10);
  };

  doc.font('Ubuntu-Bold').fillColor('#7c3aed').fontSize(20).text('Melotones');
  doc.font('Ubuntu-Bold').fillColor('#150E29').fontSize(14).text('Rapport agents — marketing & réseaux sociaux');
  doc.font('Ubuntu').fillColor('#666666').fontSize(9).text(`Généré le ${new Date(data.generatedAt).toLocaleString('fr-FR')}`);

  section('Pipeline créatif Canva');
  if (data.pipelineCounts.length === 0) {
    doc.text('Aucun asset synchronisé.');
  } else {
    for (const c of data.pipelineCounts) doc.text(`${c.label} : ${c.count}`);
  }
  if (data.failedAssets.length > 0) {
    doc.moveDown(0.3);
    doc.font('Ubuntu-Bold').fillColor('#dc2626').text('Échecs à vérifier :');
    doc.font('Ubuntu').fillColor('#150E29');
    for (const f of data.failedAssets) doc.text(`• ${f.title}${f.error ? ` — ${f.error}` : ''}`, { width: 500 });
  }

  section('Tâches en attente pour toi');
  if (data.pendingTasks.length === 0) {
    doc.text('Aucune tâche en attente — tout est à jour.');
  } else {
    for (const t of data.pendingTasks) {
      doc.font('Ubuntu-Bold').text(`• ${t.title}`, { width: 500 });
      if (t.description) doc.font('Ubuntu').fontSize(9).fillColor('#555555').text(t.description, { width: 500, indent: 10 });
      doc.fontSize(10).fillColor('#150E29');
      doc.moveDown(0.2);
    }
  }

  section('Performance réseaux sociaux (chiffres réels)');
  if (data.social.withStats.length === 0) {
    doc.text(data.social.rows.length === 0
      ? "Aucune publication suivie pour le moment — approuve un visuel dans la bibliothèque Canva pour démarrer le suivi."
      : `${data.social.rows.length} publication(s) suivie(s), mais pas encore de statistiques lisibles (TikTok en attente du scope video.list).`);
  } else {
    for (const r of data.social.withStats) {
      doc.text(`[${r.platform}] ${r.content_assets?.title ?? r.content_asset_id} — vues: ${r.stats!.viewCount ?? '—'}, likes: ${r.stats!.likeCount ?? '—'}, commentaires: ${r.stats!.commentCount ?? '—'}`, { width: 500 });
    }
    if (data.social.strategyNote) {
      doc.moveDown(0.4);
      doc.font('Ubuntu-Bold').text('Analyse et suggestions :');
      doc.font('Ubuntu').text(data.social.strategyNote, { width: 500 });
    }
  }

  section('Dernières exécutions automatiques');
  if (data.recentRuns.length === 0) {
    doc.text('Aucune exécution enregistrée.');
  } else {
    for (const r of data.recentRuns) {
      const toneColor = r.status === 'failure' ? '#dc2626' : r.status === 'alert' ? '#d97706' : '#150E29';
      doc.fillColor(toneColor).text(`${new Date(r.ranAt).toLocaleString('fr-FR')} — ${r.agentSlug} (${r.status}) : ${r.summary}`, { width: 500 });
    }
    doc.fillColor('#150E29');
  }

  doc.end();
  return done;
}
