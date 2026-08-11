import crypto from 'crypto';

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

export async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false, error: 'Emailing non configuré (RESEND_API_KEY / RESEND_FROM_EMAIL manquants)' };

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) return { ok: false, error: await res.text() };
  return { ok: true };
}
