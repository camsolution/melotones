import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 1000;

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { data, error: dbError } = await supabaseAdmin
    .from('human_tasks')
    .select('*')
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { title, description } = await request.json();
  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  if (!trimmedTitle || trimmedTitle.length > MAX_TITLE_LENGTH) {
    return NextResponse.json({ error: `Titre requis (max ${MAX_TITLE_LENGTH} caractères).` }, { status: 400 });
  }
  const trimmedDescription = typeof description === 'string' ? description.trim().slice(0, MAX_DESCRIPTION_LENGTH) : null;

  const { data, error: dbError } = await supabaseAdmin
    .from('human_tasks')
    .insert({ title: trimmedTitle, description: trimmedDescription, source: 'admin', status: 'pending' })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}
