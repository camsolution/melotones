import crypto from 'crypto';

const API_BASE = process.env.PAYDUNYA_MODE === 'live'
  ? 'https://app.paydunya.com/api/v1'
  : 'https://app.paydunya.com/sandbox-api/v1';

export function isPayDunyaConfigured(): boolean {
  return !!process.env.PAYDUNYA_MASTER_KEY && !!process.env.PAYDUNYA_PRIVATE_KEY
    && !!process.env.PAYDUNYA_PUBLIC_KEY && !!process.env.PAYDUNYA_TOKEN;
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'PAYDUNYA-MASTER-KEY': process.env.PAYDUNYA_MASTER_KEY!,
    'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY!,
    'PAYDUNYA-PUBLIC-KEY': process.env.PAYDUNYA_PUBLIC_KEY!,
    'PAYDUNYA-TOKEN': process.env.PAYDUNYA_TOKEN!,
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

  const res = await fetch(`${API_BASE}/checkout-invoice/create`, {
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
  });

  const data = await res.json().catch(() => ({}));
  if (data.response_code !== '00' || !data.response_text) {
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

  const res = await fetch(`${API_BASE}/checkout-invoice/confirm/${token}`, {
    headers: {
      'PAYDUNYA-MASTER-KEY': process.env.PAYDUNYA_MASTER_KEY!,
      'PAYDUNYA-PRIVATE-KEY': process.env.PAYDUNYA_PRIVATE_KEY!,
    },
  });
  const data = await res.json().catch(() => ({}));
  const status = data?.status;
  if (status === 'completed' || status === 'pending' || status === 'cancelled') {
    return { ok: true, status, raw: data };
  }
  return { ok: false, status: 'unknown', raw: data };
}
