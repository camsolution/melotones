import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { PACKS } from '@/lib/pricing';

export async function POST(request: Request) {
  const supabase = createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { pack_id, payment_method, payment_reference } = await request.json();
  const pack = PACKS.find(p => p.id === pack_id);
  if (!pack) return NextResponse.json({ error: 'Pack invalide' }, { status: 400 });
  if (!payment_method) return NextResponse.json({ error: 'Méthode de paiement requise' }, { status: 400 });

  const { data, error } = await supabase
    .from('purchase_requests')
    .insert({
      user_id: user.id,
      pack_id: pack.id,
      credits: pack.credits,
      price_fcfa: pack.priceFcfa,
      payment_method,
      payment_reference: payment_reference || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function GET() {
  const supabase = createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('purchase_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
