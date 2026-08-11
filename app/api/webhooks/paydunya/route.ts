import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';
import { confirmPayDunyaInvoice, verifyPayDunyaWebhookHash } from '@/lib/payments/paydunya';
import { approvePurchaseRequest, rejectPurchaseRequest } from '@/lib/purchaseApproval';

// PayDunya envoie l'IPN en formulaire (champ "data" contenant du JSON) selon
// leur intégration standard — on gère aussi le cas JSON direct par sécurité,
// le format exact devant être confirmé en sandbox une fois les clés fournies.
async function parseBody(request: Request): Promise<any> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return request.json().catch(() => ({}));
  }
  const form = await request.formData().catch(() => null);
  if (!form) return {};
  const raw = form.get('data');
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  const obj: Record<string, any> = {};
  form.forEach((v, k) => { obj[k] = v; });
  return obj;
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
