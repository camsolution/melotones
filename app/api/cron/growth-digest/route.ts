import { NextResponse } from 'next/server';
import { verifyCronSecret, getAdminEmail, reportRun } from '@/lib/cron';
import { computeAnalytics } from '@/lib/analytics';
import { computeProviderBalanceEstimate } from '@/lib/providerBalance';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [analytics, providerBalance] = await Promise.all([
      computeAnalytics(),
      computeProviderBalanceEstimate(),
    ]);

    const pct = (v: number | null) => v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`;
    const summaryText = `${analytics.uniqueVisitors} visiteurs uniques, ${analytics.signupsInPeriod} inscriptions, activation ${pct(analytics.activationRate)}, conversion ${pct(analytics.conversionRate)}, ~${providerBalance.estimatedRemainingGenerations ?? '?'} générations MusicGPT restantes.`;

    const adminEmail = await getAdminEmail();
    if (adminEmail) {
      await sendEmail(
        adminEmail,
        `Rapport de croissance Melotones — ${new Date().toLocaleDateString('fr-FR')}`,
        `<h2>Rapport de croissance (30 derniers jours)</h2>
         <ul>
           <li>Visiteurs uniques : <strong>${analytics.uniqueVisitors}</strong> (${analytics.totalPageviews} pages vues)</li>
           <li>Inscriptions : <strong>${analytics.signupsInPeriod}</strong> (${pct(analytics.signupRate)} des visiteurs)</li>
           <li>Utilisateurs au total : <strong>${analytics.totalUsers}</strong></li>
           <li>Activés (≥1 chanson) : <strong>${analytics.activatedUsers}</strong> (${pct(analytics.activationRate)})</li>
           <li>Payants : <strong>${analytics.payingUsers}</strong> (${pct(analytics.conversionRate)})</li>
           <li>Solde MusicGPT estimé : <strong>~${providerBalance.estimatedRemainingGenerations ?? '?'} générations</strong> (${providerBalance.estimatedRemainingUsd.toFixed(2)} USD)</li>
         </ul>`
      );
    }

    await reportRun('growth-digest', 'success', summaryText, { analytics, providerBalance });
    return NextResponse.json({ ok: true, analytics, providerBalance });
  } catch (err: any) {
    await reportRun('growth-digest', 'failure', `Échec : ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
