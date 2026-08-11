import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { data, error: dbError } = await supabaseAdmin
    .from('featured_songs')
    .select('*, generation:generation_id(id, occasion, style, audio_url, cover_url, status)')
    .order('created_at', { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { generation_id } = await request.json();
  if (!generation_id) return NextResponse.json({ error: 'generation_id requis' }, { status: 400 });

  const { data: gen } = await supabaseAdmin.from('generations').select('id, status').eq('id', generation_id).single();
  if (!gen) return NextResponse.json({ error: 'Chanson introuvable' }, { status: 404 });
  if (gen.status !== 'completed') return NextResponse.json({ error: 'La chanson doit être terminée' }, { status: 400 });

  const { data, error: dbError } = await supabaseAdmin
    .from('featured_songs')
    .insert({ generation_id, active: true })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}
