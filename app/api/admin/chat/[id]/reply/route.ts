import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { message } = await request.json();
  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Message vide' }, { status: 400 });
  }

  const { data: conversation } = await supabaseAdmin
    .from('chat_conversations')
    .select('id, user_id')
    .eq('id', params.id)
    .single();

  if (!conversation) return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 });

  await supabaseAdmin.from('chat_messages').insert({
    conversation_id: conversation.id, user_id: conversation.user_id, sender: 'admin', content: message.trim(),
  });
  await supabaseAdmin
    .from('chat_conversations')
    .update({ status: 'escalated', last_message_at: new Date().toISOString() })
    .eq('id', conversation.id);

  return NextResponse.json({ ok: true });
}
