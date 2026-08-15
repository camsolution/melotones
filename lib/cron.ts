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

// Tous les comptes admin reçoivent les alertes système — auparavant un seul
// (le premier retourné par la requête, sans ORDER BY donc non garanti) recevait
// tout, ce qui laissait le ou les autres admins dans le noir sans qu'on le sache.
export async function getAdminEmails(): Promise<string[]> {
  const { data: adminCredits } = await supabaseAdmin
    .from('user_credits')
    .select('user_id')
    .eq('is_admin', true);
  if (!adminCredits || adminCredits.length === 0) return [];
  const emails = await Promise.all(
    adminCredits.map(async (row) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
      return data.user?.email || null;
    })
  );
  return emails.filter((e): e is string => !!e);
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
