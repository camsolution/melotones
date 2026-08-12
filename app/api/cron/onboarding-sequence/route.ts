import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';
import { verifyCronSecret, reportRun } from '@/lib/cron';
import { sendEmail, unsubscribeUrl } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://melotones.co';
const DAY_MS = 24 * 60 * 60 * 1000;

type Candidate = { user_id: string; email: string };

async function getCheapestPack() {
  const { data } = await supabaseAdmin
    .from('pricing_packs')
    .select('label, credits, price_fcfa')
    .eq('active', true)
    .order('price_fcfa', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

// Comptes créés il y a >= minDays, jamais générés, jamais achetés, pas admin,
// pas désinscrits, et n'ayant pas déjà reçu cette étape.
// user_credits n'a pas de colonne created_at — la date d'inscription fiable
// est auth.users.created_at (garantie par Supabase Auth).
async function findInactiveCandidates(minDays: number, step: string): Promise<Candidate[]> {
  const cutoffMs = Date.now() - minDays * DAY_MS;

  const [{ data: authUsers }, { data: adminRows }, { data: gens }, { data: purchases }, { data: unsub }, { data: alreadySent }] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('user_credits').select('user_id, is_admin').eq('is_admin', true),
    supabaseAdmin.from('generations').select('user_id'),
    supabaseAdmin.from('purchase_requests').select('user_id').eq('status', 'approved'),
    supabaseAdmin.from('email_unsubscribes').select('user_id'),
    supabaseAdmin.from('onboarding_emails_sent').select('user_id').eq('step', step),
  ]);

  const adminIds = new Set((adminRows || []).map((a) => a.user_id));
  const generatedIds = new Set((gens || []).map((g) => g.user_id));
  const purchasedIds = new Set((purchases || []).map((p) => p.user_id));
  const unsubIds = new Set((unsub || []).map((u) => u.user_id));
  const sentIds = new Set((alreadySent || []).map((s) => s.user_id));

  return (authUsers?.users || [])
    .filter((u) =>
      new Date(u.created_at).getTime() <= cutoffMs &&
      !adminIds.has(u.id) && !generatedIds.has(u.id) && !purchasedIds.has(u.id) &&
      !unsubIds.has(u.id) && !sentIds.has(u.id) && !!u.email
    )
    .map((u) => ({ user_id: u.id, email: u.email! }));
}

function j2Email(pack: { label: string; credits: number; price_fcfa: number } | null, unsub: string) {
  const packLine = pack
    ? `Le pack le plus accessible : <strong>${pack.label}</strong> — ${pack.credits} chanson${pack.credits > 1 ? 's' : ''} pour ${pack.price_fcfa.toLocaleString('fr-FR')} FCFA.`
    : '';
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f3f0fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:20px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#7c3aed,#f23d82);padding:26px 32px;text-align:center;"><span style="font-size:22px;font-weight:700;color:#fff;">🎵 Melotones</span></td></tr>
  <tr><td style="padding:30px 32px;">
    <p style="margin:0 0 14px;font-size:15px;color:#150E29;font-weight:600;">Bonjour,</p>
    <p style="margin:0 0 14px;font-size:14.5px;line-height:1.7;color:#3f3752;">Vous avez créé un compte Melotones il y a deux jours — votre première chanson personnalisée par IA n'attend que vous. Choisissez une occasion, un style musical, écrivez votre message, et recevez un titre unique en quelques minutes.</p>
    <p style="margin:0 0 20px;font-size:14.5px;line-height:1.7;color:#3f3752;">${packLine}</p>
    <div style="text-align:center;"><a href="${SITE_URL}/create" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;text-decoration:none;font-weight:700;font-size:14.5px;padding:14px 32px;border-radius:12px;">Créer ma première chanson</a></div>
  </td></tr>
  <tr><td style="padding:20px 32px 24px;text-align:center;border-top:1px solid #f0edf7;"><p style="margin:0;font-size:12px;color:#b5abcf;"><a href="${unsub}" style="color:#8b7fa8;">Se désinscrire</a></p></td></tr>
  </table></td></tr></table></body></html>`;
}

function j7Email(unsub: string) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f3f0fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:20px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#7c3aed,#f23d82);padding:26px 32px;text-align:center;"><span style="font-size:22px;font-weight:700;color:#fff;">🎵 Melotones</span></td></tr>
  <tr><td style="padding:30px 32px;">
    <p style="margin:0 0 14px;font-size:15px;color:#150E29;font-weight:600;">On vous garde une place,</p>
    <p style="margin:0 0 14px;font-size:14.5px;line-height:1.7;color:#3f3752;">Un anniversaire, un mariage, ou juste une envie de faire plaisir à quelqu'un ? Une chanson personnalisée par IA se crée en quelques minutes sur Melotones — Afrobeat, Amapiano, Zouk, Gospel et bien d'autres styles.</p>
    <div style="text-align:center;margin-top:6px;"><a href="${SITE_URL}/create" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;text-decoration:none;font-weight:700;font-size:14.5px;padding:14px 32px;border-radius:12px;">Découvrir Melotones</a></div>
  </td></tr>
  <tr><td style="padding:20px 32px 24px;text-align:center;border-top:1px solid #f0edf7;"><p style="margin:0;font-size:12px;color:#b5abcf;"><a href="${unsub}" style="color:#8b7fa8;">Se désinscrire</a></p></td></tr>
  </table></td></tr></table></body></html>`;
}

async function runStep(step: 'j2' | 'j7', minDays: number, subject: string, buildHtml: (unsub: string) => string) {
  const candidates = await findInactiveCandidates(minDays, step);
  let sent = 0;
  for (const c of candidates) {
    const unsub = unsubscribeUrl(c.user_id, SITE_URL);
    const result = await sendEmail(c.email, subject, buildHtml(unsub));
    if (result.ok) {
      await supabaseAdmin.from('onboarding_emails_sent').insert({ user_id: c.user_id, step });
      sent++;
    }
  }
  return { candidates: candidates.length, sent };
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pack = await getCheapestPack();

    const [j2, j7] = await Promise.all([
      runStep('j2', 2, 'Votre première chanson Melotones vous attend 🎶', (u) => j2Email(pack, u)),
      runStep('j7', 7, 'On vous garde une place sur Melotones', j7Email),
    ]);

    const summaryText = `J2 : ${j2.sent}/${j2.candidates} envoyés. J7 : ${j7.sent}/${j7.candidates} envoyés.`;
    await reportRun('onboarding-sequence', 'success', summaryText, { j2, j7 });
    return NextResponse.json({ ok: true, j2, j7 });
  } catch (err: any) {
    await reportRun('onboarding-sequence', 'failure', `Échec : ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
