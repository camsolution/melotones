import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { data: messages, error: dbError } = await supabaseAdmin
    .from('chat_messages')
    .select('id, sender, content, created_at')
    .eq('conversation_id', params.id)
    .order('created_at', { ascending: true });

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json(messages || []);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { action } = await request.json(); // 'close' | 'reopen'
  if (!['close', 'reopen'].includes(action)) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('chat_conversations')
    .update({ status: action === 'close' ? 'closed' : 'open' })
    .eq('id', params.id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
