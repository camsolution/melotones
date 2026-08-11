import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { data, error: dbError } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { subject, body_html, audience } = await request.json();
  if (!subject?.trim() || !body_html?.trim()) {
    return NextResponse.json({ error: 'Sujet et contenu requis' }, { status: 400 });
  }
  if (!['all', 'active', 'inactive'].includes(audience)) {
    return NextResponse.json({ error: 'Audience invalide' }, { status: 400 });
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('email_campaigns')
    .insert({ subject: subject.trim(), body_html, audience, status: 'draft' })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(data);
}
