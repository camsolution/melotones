import { NextResponse } from 'next/server';
import { verifyCronSecret, getAdminEmails, reportRun } from '@/lib/cron';
import { computeAnalytics } from '@/lib/analytics';
import { computeProviderBalanceEstimate } from '@/lib/providerBalance';
import { sendEmail } from '@/lib/email';
import { getPendingTasks } from '@/lib/humanTasks';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [analytics, providerBalance, pendingTasks] = await Promise.all([
      computeAnalytics(),
      computeProviderBalanceEstimate(),
      getPendingTasks(),
    ]);

    const pct = (v: number | null) => v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`;
    const summaryText = `${analytics.uniqueVisitors} visiteurs uniques, ${analytics.signupsInPeriod} inscriptions, activation ${pct(analytics.activationRate)}, conversion ${pct(analytics.conversionRate)}, ~${providerBalance.estimatedRemainingGenerations ?? '?'} générations MusicGPT restantes, ${pendingTasks.length} tâche(s) en attente.`;

    const adminEmails = await getAdminEmails();
    if (adminEmails.length > 0) {
      const tasksHtml = pendingTasks.length > 0
        ? `<h2>Tâches en attente (${pendingTasks.length})</h2><ul>${pendingTasks.map((t) => `<li><strong>${t.title}</strong>${t.description ? ` — ${t.description}` : ''}</li>`).join('')}</ul><p style="color:#888;font-size:12px;">À traiter ou dans le dashboard admin, onglet Automatisation.</p>`
        : '';
      await sendEmail(
        adminEmails,
        `Rapport de croissance Melotones — ${new Date().toLocaleDateString('fr-FR')}`,
        `<h2>Rapport de croissance (30 derniers jours)</h2>
         <ul>
           <li>Visiteurs uniques : <strong>${analytics.uniqueVisitors}</strong> (${analytics.totalPageviews} pages vues)</li>
           <li>Inscriptions : <strong>${analytics.signupsInPeriod}</strong> (${pct(analytics.signupRate)} des visiteurs)</li>
           <li>Utilisateurs au total : <strong>${analytics.totalUsers}</strong></li>
           <li>Activés (≥1 chanson) : <strong>${analytics.activatedUsers}</strong> (${pct(analytics.activationRate)})</li>
           <li>Payants : <strong>${analytics.payingUsers}</strong> (${pct(analytics.conversionRate)})</li>
           <li>Solde MusicGPT estimé : <strong>~${providerBalance.estimatedRemainingGenerations ?? '?'} générations</strong> (${providerBalance.estimatedRemainingUsd.toFixed(2)} USD)</li>
         </ul>
         ${tasksHtml}`
      );
    }

    await reportRun('growth-digest', 'success', summaryText, { analytics, providerBalance });
    return NextResponse.json({ ok: true, analytics, providerBalance });
  } catch (err: any) {
    await reportRun('growth-digest', 'failure', `Échec : ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
