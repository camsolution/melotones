import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { data, error: dbError } = await supabaseAdmin
    .from('ad_campaigns')
    .select('*')
    .order('sort_order', { ascending: true });
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json();
  const { advertiser_name, media_url, media_type, target_url, sort_order } = body;
  if (!advertiser_name || !media_url || !media_type) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
  }
  if (!['image', 'video'].includes(media_type)) {
    return NextResponse.json({ error: 'Type de média invalide' }, { status: 400 });
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('ad_campaigns')
    .insert({ advertiser_name, media_url, media_type, target_url: target_url || null, sort_order: sort_order ?? 0, active: true })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}
