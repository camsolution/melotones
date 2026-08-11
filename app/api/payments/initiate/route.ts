import { createServerClientWithCookies } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';

const PAYMENT_METHODS = ['wave', 'orange_money', 'card', 'other'];

export async function POST(request: Request) {
  const supabase = createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: creditRow } = await supabaseAdmin.from('user_credits').select('is_admin').eq('user_id', user.id).single();
  if (creditRow?.is_admin) {
    return NextResponse.json({ error: 'Le compte administrateur génère des chansons sans consommer de Notes — aucun achat nécessaire.' }, { status: 403 });
  }

  const { pack_id, payment_method, payment_reference, coupon_code } = await request.json();
  if (!pack_id || !payment_method) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }
  if (!PAYMENT_METHODS.includes(payment_method)) {
    return NextResponse.json({ error: 'Moyen de paiement invalide' }, { status: 400 });
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

  const { data: reqRow, error: insertError } = await supabaseAdmin
    .from('purchase_requests')
    .insert({
      user_id: user.id,
      pack_id: pack.id,
      credits: pack.credits,
      price_fcfa: finalPrice,
      payment_method,
      payment_reference: payment_reference || null,
      coupon_id: couponId,
      status: 'pending',
    })
    .select()
    .single();

  if (insertError || !reqRow) {
    return NextResponse.json({ error: insertError?.message || 'Échec de la demande' }, { status: 500 });
  }

  return NextResponse.json({
    request_id: reqRow.id,
    credits: reqRow.credits,
    price_fcfa: reqRow.price_fcfa,
    original_price_fcfa: pack.price_fcfa,
    discount_applied: couponId !== null,
  });
}
