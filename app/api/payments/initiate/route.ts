import { createServerClientWithCookies } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';
import { initiatePayDunyaPayment, isPayDunyaConfigured } from '@/lib/payments/paydunya';

export async function POST(request: Request) {
  const supabase = await createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: creditRow } = await supabaseAdmin.from('user_credits').select('is_admin').eq('user_id', user.id).single();
  if (creditRow?.is_admin) {
    return NextResponse.json({ error: 'Le compte administrateur génère des chansons sans rien débiter de son solde — aucun achat nécessaire.' }, { status: 403 });
  }

  const { pack_id, coupon_code } = await request.json();
  if (!pack_id) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }

  const { data: pack, error: packError } = await supabaseAdmin
    .from('pricing_packs')
    .select('*')
    .eq('id', pack_id)
    .eq('active', true)
    .single();
  if (packError || !pack) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 });

  let finalPrice = pack.price_fcfa;
  let couponId: string | null = null;

  if (coupon_code) {
    // .eq (pas .ilike) : un code contenant "%" ou "_" serait interprété comme
    // un joker SQL et pourrait matcher un coupon actif sans le connaître.
    const { data: coupon } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('code', String(coupon_code).trim().toUpperCase())
      .eq('active', true)
      .single();

    if (!coupon) {
      return NextResponse.json({ error: 'Code promo invalide ou expiré' }, { status: 400 });
    }
    if (coupon.quota !== null && coupon.used_count >= coupon.quota) {
      return NextResponse.json({ error: 'Ce code promo a atteint son quota d\'utilisation' }, { status: 400 });
    }
    finalPrice = Math.round(pack.price_fcfa * (1 - coupon.discount_percent / 100));
    couponId = coupon.id;
  }

  if (!isPayDunyaConfigured()) {
    return NextResponse.json({ error: "Le paiement n'est pas encore configuré — merci de réessayer plus tard." }, { status: 503 });
  }

  const { data: reqRow, error: insertError } = await supabaseAdmin
    .from('purchase_requests')
    .insert({
      user_id: user.id,
      pack_id: pack.id,
      credits: pack.credits,
      price_fcfa: finalPrice,
      payment_method: 'paydunya',
      coupon_id: couponId,
      status: 'pending',
      provider: 'paydunya',
    })
    .select()
    .single();

  if (insertError || !reqRow) {
    return NextResponse.json({ error: insertError?.message || 'Échec de la demande' }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const result = await initiatePayDunyaPayment({
    amountFcfa: finalPrice,
    description: `${pack.credits} Chansons Melotones — ${pack.label}`,
    callbackUrl: `${siteUrl}/api/webhooks/paydunya`,
    returnUrl: `${siteUrl}/notes?status=success`,
    cancelUrl: `${siteUrl}/notes?status=cancelled`,
    customData: { purchase_request_id: reqRow.id },
  });

  if (!result.ok) {
    // Rien n'a été débité, la tentative d'initialisation a simplement échoué
    // côté fournisseur — pas la peine de garder une demande fantôme.
    await supabaseAdmin.from('purchase_requests').delete().eq('id', reqRow.id);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  await supabaseAdmin
    .from('purchase_requests')
    .update({ provider_token: result.token, provider_status: 'initiated' })
    .eq('id', reqRow.id);

  return NextResponse.json({ redirect_url: result.paymentUrl });
}
