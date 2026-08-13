import crypto from 'crypto';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

// Cohérent avec le SDK PHP officiel PayDunya (Paydunya_Setup) : le mode
// "live" bascule à la fois l'URL de base (api/v1 vs sandbox-api/v1) ET
// l'en-tête PAYDUNYA-MODE envoyé sur chaque requête.
const PAYDUNYA_LIVE = process.env.PAYDUNYA_MODE === 'live';
const API_BASE = PAYDUNYA_LIVE
  ? 'https://app.paydunya.com/api/v1'
  : 'https://app.paydunya.com/sandbox-api/v1';

export function isPayDunyaConfigured(): boolean {
  return !!process.env.PAYDUNYA_MASTER_KEY && !!process.env.PAYDUNYA_PRIVATE_KEY
    && !!process.env.PAYDUNYA_PUBLIC_KEY && !!process.env.PAYDUNYA_TOKEN;
}

// Les 4 clés + PAYDUNYA-MODE sont exigées sur CHAQUE appel (create, confirm,
// etc.) par l'API PayDunya — vérifié dans le SDK PHP officiel (Paydunya_Utilities).
function headers() {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'PAYDUNYA-MASTER-KEY': process.env.PAYDUNYA_MASTER_KEY!,
    'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY!,
    'PAYDUNYA-PUBLIC-KEY': process.env.PAYDUNYA_PUBLIC_KEY!,
    'PAYDUNYA-TOKEN': process.env.PAYDUNYA_TOKEN!,
    'PAYDUNYA-MODE': PAYDUNYA_LIVE ? 'live' : 'test',
  };
}

export async function initiatePayDunyaPayment(params: {
  amountFcfa: number;
  description: string;
  callbackUrl: string;
  returnUrl: string;
  cancelUrl: string;
  customData: Record<string, string>;
}): Promise<{ ok: true; paymentUrl: string; token: string } | { ok: false; error: string }> {
  if (!isPayDunyaConfigured()) return { ok: false, error: 'PayDunya non configuré' };

  const res = await fetchWithTimeout(`${API_BASE}/checkout-invoice/create`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      invoice: {
        total_amount: params.amountFcfa,
        description: params.description,
      },
      store: { name: 'Melotones' },
      actions: {
        callback_url: params.callbackUrl,
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
      custom_data: params.customData,
    }),
  }, 15_000);

  const data = await res.json().catch(() => ({}));
  // PayDunya renvoie response_code "00" en cas de succès ; on compare en
  // nombre pour couvrir aussi bien "00" (string) que 0 (number) selon le client.
  const success = Number(data.response_code) === 0;
  if (!success || !data.response_text) {
    return { ok: false, error: data.response_text || 'Échec de l\'initialisation PayDunya' };
  }
  return { ok: true, paymentUrl: data.response_text, token: data.token };
}

// PayDunya renvoie dans son IPN un hash égal au hash SHA512 de la master key —
// ça permet de vérifier que la notification vient bien d'eux avant de la traiter.
export function verifyPayDunyaWebhookHash(receivedHash: string): boolean {
  const masterKey = process.env.PAYDUNYA_MASTER_KEY;
  if (!masterKey || !receivedHash) return false;
  const expected = Buffer.from(crypto.createHash('sha512').update(masterKey).digest('hex'));
  const received = Buffer.from(receivedHash);
  if (expected.length !== received.length) return false; // timingSafeEqual exige des tailles égales
  return crypto.timingSafeEqual(expected, received);
}

// Comme pour CinetPay, on ne fait jamais confiance au seul contenu du webhook :
// on reconfirme le statut final via cette API avant de créditer quoi que ce soit.
export async function confirmPayDunyaInvoice(token: string): Promise<{ ok: boolean; status: 'completed' | 'pending' | 'cancelled' | 'unknown'; raw?: any }> {
  if (!isPayDunyaConfigured()) return { ok: false, status: 'unknown' };

  const res = await fetchWithTimeout(`${API_BASE}/checkout-invoice/confirm/${encodeURIComponent(token)}`, {
    headers: headers(),
  }, 15_000);
  const data = await res.json().catch(() => ({}));
  // L'orthographe exacte de l'annulation varie selon les sources PayDunya
  // ("cancelled" vs "canceled") et un statut d'échec existe aussi ("failed"/"fail") :
  // on normalise pour ne jamais laisser une commande annulée/échouée bloquée en
  // "pending" indéfiniment côté admin.
  const rawStatus = typeof data?.status === 'string' ? data.status.toLowerCase() : '';
  if (rawStatus === 'completed') return { ok: true, status: 'completed', raw: data };
  if (rawStatus === 'pending') return { ok: true, status: 'pending', raw: data };
  if (rawStatus === 'cancelled' || rawStatus === 'canceled' || rawStatus === 'failed' || rawStatus === 'fail') {
    return { ok: true, status: 'cancelled', raw: data };
  }
  return { ok: false, status: 'unknown', raw: data };
}
