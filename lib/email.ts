import crypto from 'crypto';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

const RESEND_API_URL = 'https://api.resend.com/emails';

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_EMAIL;
}

// Signe un token léger (HMAC tronqué) à partir de la clé service-role — pas besoin
// d'un secret dédié, elle n'est jamais exposée côté client et sert ici uniquement
// à prouver que le lien de désinscription a été généré par notre serveur.
export function signUnsubscribeToken(userId: string): string {
  return crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY!).update(userId).digest('hex').slice(0, 32);
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  return signUnsubscribeToken(userId) === token;
}

export function unsubscribeUrl(userId: string, baseUrl: string): string {
  return `${baseUrl}/api/unsubscribe?user=${userId}&token=${signUnsubscribeToken(userId)}`;
}

const FEATURES = [
  'Anniversaire, remerciement, surprise : à vous de choisir l\'occasion',
  'Composée avec le prénom et l\'histoire que vous racontez',
  'Prête en quelques minutes',
  'Plus de 15 styles musicaux, d\'Afrobeat à Coupé-Décalé en passant par Gospel et Zouk',
];

export function renderCampaignEmail(params: {
  firstName: string | null;
  headline?: string | null;
  bodyHtml: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  promoCode?: string | null;
  unsubscribeLink: string;
}): string {
  const { firstName, headline, bodyHtml, promoCode, unsubscribeLink } = params;
  const ctaLabel = params.ctaLabel?.trim() || 'Créer ma chanson';
  const ctaUrl = params.ctaUrl?.trim() || `${process.env.NEXT_PUBLIC_SITE_URL || 'https://melotones.vercel.app'}/create`;
  const greeting = firstName ? `Bonjour ${firstName},` : 'Bonjour,';
  const supportWhatsapp = process.env.MELOTONES_SUPPORT_WHATSAPP;

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f0fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f0fa;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(93,45,180,.08);">

<tr><td style="background:linear-gradient(135deg,#7c3aed,#f23d82);padding:28px 32px;text-align:center;">
<span style="font-family:Georgia,serif;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:.5px;">🎵 Melotones</span>
${headline ? `<div style="margin-top:6px;font-size:13px;color:#ffe0ed;text-transform:uppercase;letter-spacing:1px;">${headline}</div>` : ''}
</td></tr>

<tr><td style="padding:32px 32px 8px;">
<p style="margin:0 0 16px;font-size:15px;color:#150E29;font-weight:600;">${greeting}</p>
<div style="font-size:14.5px;line-height:1.7;color:#3f3752;">${bodyHtml}</div>
</td></tr>

${promoCode ? `
<tr><td style="padding:8px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;border:1px dashed #a78bfa;border-radius:12px;">
<tr><td style="padding:14px;text-align:center;">
<div style="font-size:11px;color:#6d28d9;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Code promo</div>
<div style="font-size:20px;font-weight:700;color:#5b21b6;letter-spacing:2px;">${promoCode}</div>
</td></tr>
</table>
</td></tr>` : ''}

<tr><td style="padding:24px 32px 8px;">
<ul style="margin:0;padding:0;list-style:none;">
${FEATURES.map((f) => `<li style="padding:6px 0;font-size:13.5px;color:#3f3752;"><span style="color:#7c3aed;font-weight:700;margin-right:8px;">✓</span>${f}</li>`).join('')}
</ul>
</td></tr>

<tr><td style="padding:24px 32px 8px;text-align:center;">
<a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#ffffff;text-decoration:none;font-weight:700;font-size:14.5px;padding:14px 32px;border-radius:12px;">${ctaLabel}</a>
</td></tr>

${supportWhatsapp ? `
<tr><td style="padding:16px 32px 0;text-align:center;">
<p style="margin:0;font-size:12.5px;color:#8b7fa8;">Besoin d'aide ? Notre équipe vous répond sur WhatsApp : <a href="https://wa.me/${supportWhatsapp.replace(/[^0-9]/g, '')}" style="color:#7c3aed;font-weight:600;">${supportWhatsapp}</a></p>
</td></tr>` : ''}

<tr><td style="padding:28px 32px 24px;text-align:center;border-top:1px solid #f0edf7;margin-top:20px;">
<p style="margin:20px 0 8px;font-size:13px;color:#8b7fa8;">Faites plaisir autrement. Offrez une chanson.</p>
<p style="margin:0;font-size:12px;color:#b5abcf;">Vous recevez cet email car vous êtes inscrit sur Melotones.<br>
<a href="${unsubscribeLink}" style="color:#8b7fa8;">Se désinscrire</a></p>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: string }[]
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false, error: 'Emailing non configuré (RESEND_API_KEY / RESEND_FROM_EMAIL manquants)' };

  const res = await fetchWithTimeout(RESEND_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, ...(attachments ? { attachments } : {}) }),
  }, 10_000);

  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true };
}
