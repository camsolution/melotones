import { supabaseAdmin } from '@/lib/admin';

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown';
}

// Limite par IP en plus du cooldown par compte déjà en place sur ces routes —
// protège contre un botnet qui crée plusieurs comptes depuis la même IP pour
// contourner le cooldown par compte et épuiser le budget MusicGPT/Gemini.
// N'importe jamais l'IP réelle du serveur car ce n'est jamais 'unknown'
// en production sur Vercel (x-forwarded-for toujours présent) — le fallback
// ne joue qu'en local/dev.
export async function checkIpRateLimit(
  request: Request,
  endpoint: string,
  opts: { windowMs: number; max: number }
): Promise<boolean> {
  const ip = getClientIp(request);
  if (ip === 'unknown') return true;

  const since = new Date(Date.now() - opts.windowMs).toISOString();
  const { count } = await supabaseAdmin
    .from('rate_limit_events')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .eq('endpoint', endpoint)
    .gte('created_at', since);

  if ((count ?? 0) >= opts.max) return false;

  await supabaseAdmin.from('rate_limit_events').insert({ ip, endpoint });

  // Nettoyage opportuniste (~1% des appels) pour éviter une croissance illimitée
  // de la table sans avoir besoin d'un cron dédié.
  if (Math.random() < 0.01) {
    await supabaseAdmin.from('rate_limit_events').delete().lt('created_at', new Date(Date.now() - 3_600_000).toISOString());
  }

  return true;
}
