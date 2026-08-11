import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin, getEmailsByIds } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { data, error: dbError } = await supabaseAdmin
    .from('chat_conversations')
    .select('*')
    .order('last_message_at', { ascending: false });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  const emailsById = await getEmailsByIds((data || []).map((c) => c.user_id));
  const withEmail = (data || []).map((c) => ({ ...c, user_email: emailsById.get(c.user_id) || c.user_id }));

  return NextResponse.json(withEmail);
}
