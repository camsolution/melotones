import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin, getEmailsByIds } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { data, error: dbError } = await supabaseAdmin
    .from('testimonials')
    .select('*')
    .order('created_at', { ascending: false });
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  const emailsById = await getEmailsByIds((data || []).map((t) => t.user_id));
  const withEmail = (data || []).map((t) => ({ ...t, user_email: emailsById.get(t.user_id) || t.user_id }));

  return NextResponse.json(withEmail);
}
