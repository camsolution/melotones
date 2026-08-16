import { NextResponse } from 'next/server';
import { verifyCronSecret, getAdminEmails, reportRun } from '@/lib/cron';
import { sendEmail } from '@/lib/email';
import { computeAgentReport, buildAgentReportPdf } from '@/lib/agentReport';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await computeAgentReport();
    const pdfBuffer = await buildAgentReportPdf(data);
    const dateStr = new Date().toISOString().slice(0, 10);

    const adminEmails = await getAdminEmails();
    if (adminEmails.length > 0) {
      await sendEmail(
        adminEmails,
        `Rapport agents Melotones — ${new Date().toLocaleDateString('fr-FR')}`,
        `<p>Le rapport quotidien des agents marketing/réseaux sociaux est en pièce jointe (PDF) : pipeline créatif, tâches en attente, performance réelle des publications, dernières exécutions automatiques.</p>
         <p style="color:#888;font-size:12px;">Aussi consultable à tout moment dans le dashboard admin, onglet Automatisation → "Rapport agents (PDF)".</p>`,
        [{ filename: `rapport-agents-${dateStr}.pdf`, content: pdfBuffer.toString('base64') }]
      );
    }

    await reportRun('agent-report', 'success', `Rapport généré : ${data.pipelineCounts.reduce((s, c) => s + c.count, 0)} asset(s), ${data.pendingTasks.length} tâche(s) en attente, ${data.social.withStats.length} publication(s) avec stats.`);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    await reportRun('agent-report', 'failure', `Échec : ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
