import { supabaseAdmin } from '@/lib/admin';
import crypto from 'crypto';

// Vercel injecte automatiquement 'Authorization: Bearer $CRON_SECRET' sur les
// appels Cron Jobs quand cette variable d'env existe — donc une requête qui ne
// porte pas ce header exact ne vient pas de Vercel (protège contre un curl direct
// sur la route par quelqu'un qui devine le chemin). Comparaison à temps constant,
// comme les autres secrets d'automatisation du projet.
export function verifyCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get('authorization') || '';
  const expectedHeader = `Bearer ${expected}`;
  const expectedBuf = Buffer.from(expectedHeader);
  const providedBuf = Buffer.from(header);
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export async function getAdminEmail(): Promise<string | null> {
  const { data: adminCredit } = await supabaseAdmin
    .from('user_credits')
    .select('user_id')
    .eq('is_admin', true)
    .limit(1)
    .maybeSingle();
  if (!adminCredit) return null;
  const { data } = await supabaseAdmin.auth.admin.getUserById(adminCredit.user_id);
  return data.user?.email || null;
}

type RunStatus = 'success' | 'alert' | 'failure';

export async function reportRun(agentSlug: string, status: RunStatus, summary: string, details?: unknown) {
  await supabaseAdmin.from('automation_runs').insert({
    agent_slug: agentSlug,
    status,
    summary: summary.slice(0, 2000),
    details: details ?? null,
  });
}
