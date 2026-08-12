import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';
import { verifyCronSecret, getAdminEmail, reportRun } from '@/lib/cron';
import { isProviderOutOfCredits } from '@/lib/providerErrors';
import { computeProviderBalanceEstimate } from '@/lib/providerBalance';
import { sendEmail } from '@/lib/email';
import { createHumanTask } from '@/lib/humanTasks';

export const dynamic = 'force-dynamic';

const RECENT_ERRORS_WINDOW_MS = 24 * 60 * 60 * 1000; // rythme quotidien (limite Vercel Hobby : 1 exécution/jour max)
const LOW_BALANCE_GENERATIONS_THRESHOLD = 20;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const since = new Date(Date.now() - RECENT_ERRORS_WINDOW_MS).toISOString();

    const [outOfCredits, { count: pendingRefunds }, { count: recentErrors }, providerBalance] = await Promise.all([
      isProviderOutOfCredits(),
      supabaseAdmin.from('refund_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('provider_errors').select('*', { count: 'exact', head: true }).gte('created_at', since),
      computeProviderBalanceEstimate(),
    ]);

    const lowBalance = providerBalance.estimatedRemainingGenerations !== null
      && providerBalance.estimatedRemainingGenerations < LOW_BALANCE_GENERATIONS_THRESHOLD;

    const issues: string[] = [];
    if (outOfCredits) {
      issues.push('MusicGPT signale INSUFFICIENT_CREDITS récemment — coupe-circuit actif.');
      await createHumanTask('Recharger le solde MusicGPT', "Le coupe-circuit s'est déclenché suite à une erreur INSUFFICIENT_CREDITS réelle du fournisseur — rechargez le compte MusicGPT.", 'agent:health-monitor');
    }
    if ((pendingRefunds ?? 0) > 0) {
      issues.push(`${pendingRefunds} remboursement(s) en attente d'approbation admin.`);
      await createHumanTask('Traiter les demandes de remboursement en attente', `${pendingRefunds} demande(s) attendent une approbation manuelle dans l'onglet Remboursements.`, 'agent:health-monitor');
    }
    if ((recentErrors ?? 0) >= 5) {
      issues.push(`${recentErrors} erreurs fournisseur dans les dernières 24h.`);
      await createHumanTask('Vérifier les erreurs fournisseur fréquentes', `${recentErrors} erreurs MusicGPT dans les dernières 24h — voir l'onglet Alertes.`, 'agent:health-monitor');
    }
    if (lowBalance) {
      issues.push(`Solde MusicGPT estimé bas : ~${providerBalance.estimatedRemainingGenerations} générations restantes.`);
      await createHumanTask('Recharger bientôt le solde MusicGPT', `Solde estimé : ~${providerBalance.estimatedRemainingGenerations} générations restantes.`, 'agent:health-monitor');
    }

    const details = { issues, outOfCredits, pendingRefunds: pendingRefunds ?? 0, recentProviderErrors: recentErrors ?? 0, providerBalance };

    if (issues.length === 0) {
      await reportRun('health-monitor', 'success', 'RAS — tout est normal.', details);
      return NextResponse.json({ ok: true, ...details });
    }

    const summaryText = issues.join(' ');
    const adminEmail = await getAdminEmail();
    if (adminEmail) {
      await sendEmail(
        adminEmail,
        `⚠️ Alerte Melotones — ${issues.length} problème(s) détecté(s)`,
        `<h2>Surveillance santé Melotones</h2><ul>${issues.map((i) => `<li>${i}</li>`).join('')}</ul><p style="color:#888;font-size:12px;">Ajouté aussi comme tâche à traiter dans le dashboard admin (onglet Automatisation).</p>`
      );
    }

    await reportRun('health-monitor', 'alert', summaryText, details);
    return NextResponse.json({ ok: false, ...details });
  } catch (err: any) {
    await reportRun('health-monitor', 'failure', `Échec : ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
