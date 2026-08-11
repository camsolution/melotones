const API_BASE = 'https://api-checkout.cinetpay.com/v2';

export function isCinetPayConfigured(): boolean {
  return !!process.env.CINETPAY_APIKEY && !!process.env.CINETPAY_SITE_ID;
}

export async function initiateCinetPayPayment(params: {
  transactionId: string;
  amountFcfa: number;
  description: string;
  customerName: string;
  customerEmail: string;
  notifyUrl: string;
  returnUrl: string;
}): Promise<{ ok: true; paymentUrl: string } | { ok: false; error: string }> {
  const apikey = process.env.CINETPAY_APIKEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  if (!apikey || !siteId) return { ok: false, error: 'CinetPay non configuré' };

  const res = await fetch(`${API_BASE}/payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey,
      site_id: siteId,
      transaction_id: params.transactionId,
      amount: params.amountFcfa,
      currency: 'XOF',
      description: params.description,
      customer_name: params.customerName,
      customer_email: params.customerEmail,
      notify_url: params.notifyUrl,
      return_url: params.returnUrl,
      channels: 'ALL', // mobile money (Orange Money, Wave, Free Money...) + carte Visa/Mastercard
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.code !== '201' || !data.data?.payment_url) {
    return { ok: false, error: data.message || data.description || 'Échec de l\'initialisation CinetPay' };
  }
  return { ok: true, paymentUrl: data.data.payment_url };
}

// CinetPay ne signe pas ses notifications webhook — la seule façon fiable de
// confirmer un paiement est de rappeler cette API de vérification avec nos
// propres identifiants, jamais de faire confiance au contenu du webhook lui-même.
export async function verifyCinetPayTransaction(transactionId: string): Promise<{ ok: boolean; status: 'ACCEPTED' | 'REFUSED' | 'PENDING' | 'UNKNOWN'; raw?: any }> {
  const apikey = process.env.CINETPAY_APIKEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  if (!apikey || !siteId) return { ok: false, status: 'UNKNOWN' };

  const res = await fetch(`${API_BASE}/payment/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey, site_id: siteId, transaction_id: transactionId }),
  });
  const data = await res.json().catch(() => ({}));
  const status = data?.data?.status;
  if (status === 'ACCEPTED' || status === 'REFUSED' || status === 'PENDING') {
    return { ok: true, status, raw: data };
  }
  return { ok: false, status: 'UNKNOWN', raw: data };
}
