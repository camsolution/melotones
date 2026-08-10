import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { data, error: dbError } = await supabaseAdmin
    .from('pricing_packs')
    .select('*')
    .order('sort_order', { ascending: true });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json();
  const { id, credits, price_fcfa, label, sort_order } = body;
  if (!id || !credits || !price_fcfa || !label) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('pricing_packs')
    .insert({ id, credits, price_fcfa, label, sort_order: sort_order ?? 0, active: true })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}
