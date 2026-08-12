import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';
import { confirmPayDunyaInvoice, verifyPayDunyaWebhookHash } from '@/lib/payments/paydunya';
import { approvePurchaseRequest, rejectPurchaseRequest } from '@/lib/purchaseApproval';

// Insère une valeur dans un objet imbriqué à partir d'une clé façon PHP,
// ex. "data[invoice][token]" -> { data: { invoice: { token: value } } }.
function setBracketPath(obj: Record<string, any>, key: string, value: any) {
  const segments = key.split(/\[|\]/).filter(s => s !== '');
  let cur = obj;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (i === segments.length - 1) {
      cur[seg] = value;
    } else {
      if (typeof cur[seg] !== 'object' || cur[seg] === null) cur[seg] = {};
      cur = cur[seg];
    }
  }
}

// PayDunya poste son IPN en application/x-www-form-urlencoded avec des champs
// façon PHP "data[hash]", "data[status]", "data[invoice][token]", etc. (le
// SDK officiel les relit via $_POST['data']['hash']) — on reconstruit donc la
// même structure imbriquée. On gère aussi, par sécurité, le cas où "data"
// serait un champ unique contenant du JSON, ou un corps JSON direct.
async function parseBody(request: Request): Promise<any> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return request.json().catch(() => ({}));
  }
  const form = await request.formData().catch(() => null);
  if (!form) return {};

  const rawData = form.get('data');
  if (typeof rawData === 'string') {
    try {
      const parsed = JSON.parse(rawData);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch { /* pas du JSON, on tente le format à crochets ci-dessous */ }
  }

  const nested: Record<string, any> = {};
  form.forEach((v, k) => setBracketPath(nested, k, v));
  if (nested.data && typeof nested.data === 'object') return nested.data;
  return nested;
}

export async function POST(request: Request) {
  const body = await parseBody(request);

  const hash = body?.hash;
  if (!hash || !verifyPayDunyaWebhookHash(hash)) {
    console.warn('Webhook PayDunya : hash manquant ou invalide');
    return NextResponse.json({ received: true });
  }

  const token = body?.invoice?.token || body?.token;
  const purchaseRequestId = body?.custom_data?.purchase_request_id;

  if (!token && !purchaseRequestId) {
    console.warn('Webhook PayDunya : ni token ni purchase_request_id dans le payload');
    return NextResponse.json({ received: true });
  }

  // Jamais confiance dans le statut annoncé par le webhook : on reconfirme
  // toujours auprès de l'API PayDunya elle-même avant de créditer.
  let purchaseRequest = null as any;
  if (purchaseRequestId) {
    const { data } = await supabaseAdmin.from('purchase_requests').select('*').eq('id', purchaseRequestId).single();
    purchaseRequest = data;
  } else if (token) {
    const { data } = await supabaseAdmin.from('purchase_requests').select('*').eq('provider_token', token).single();
    purchaseRequest = data;
  }

  if (!purchaseRequest) {
    console.warn('Webhook PayDunya : aucune demande d\'achat correspondante trouvée');
    return NextResponse.json({ received: true });
  }

  const invoiceToken = purchaseRequest.provider_token || token;
  const confirmation = invoiceToken ? await confirmPayDunyaInvoice(invoiceToken) : { ok: false, status: 'unknown' as const };

  await supabaseAdmin.from('purchase_requests').update({ provider_status: confirmation.status }).eq('id', purchaseRequest.id);

  if (confirmation.ok && confirmation.status === 'completed') {
    await approvePurchaseRequest(purchaseRequest.id, null);
  } else if (confirmation.ok && confirmation.status === 'cancelled') {
    await rejectPurchaseRequest(purchaseRequest.id, null);
  }
  // status "pending" : on ne fait rien, on attend une prochaine notification.

  return NextResponse.json({ received: true });
}
