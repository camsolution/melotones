import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin, getEmailsByIds } from '@/lib/admin';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { data, error: dbError } = await supabaseAdmin
    .from('refund_requests')
    .select('*, generation:generation_id(occasion, style, status)')
    .order('created_at', { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  const emailsById = await getEmailsByIds((data || []).map((r) => r.user_id));
  const withEmail = (data || []).map((r) => ({ ...r, user_email: emailsById.get(r.user_id) || r.user_id }));

  return NextResponse.json(withEmail);
}
