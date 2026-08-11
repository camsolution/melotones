import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin, getEmailsByIds } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { data, error: dbError } = await supabaseAdmin
    .from('provider_errors')
    .select('*, generation:generation_id(occasion, style)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  const emailsById = await getEmailsByIds((data || []).map((e) => e.user_id));
  const withEmail = (data || []).map((e) => ({ ...e, user_email: emailsById.get(e.user_id) || e.user_id }));

  return NextResponse.json(withEmail);
}
