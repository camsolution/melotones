import { createServerClientWithCookies } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/admin';
import { generateBotReply } from '@/lib/chatbot';
import { NextResponse } from 'next/server';

const MAX_MESSAGE_LENGTH = 1000;
const COOLDOWN_MS = 3000;
const ESCALATION_NOTICE = "Je transmets votre demande à notre équipe — un conseiller va vous répondre ici même dès que possible. Merci de votre patience 🙏";

export async function POST(request: Request) {
  const authClient = await createServerClientWithCookies();
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { message } = await request.json();
  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Message vide' }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: 'Message trop long' }, { status: 400 });
  }

  const { count: recentCount } = await supabaseAdmin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('sender', 'user')
    .gte('created_at', new Date(Date.now() - COOLDOWN_MS).toISOString());
  if ((recentCount ?? 0) > 0) {
    return NextResponse.json({ error: 'Merci de patienter un instant avant un nouveau message.' }, { status: 429 });
  }

  let { data: conversation } = await supabaseAdmin
    .from('chat_conversations')
    .select('id, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation || conversation.status === 'closed') {
    const { data: created, error: createError } = await supabaseAdmin
      .from('chat_conversations')
      .insert({ user_id: user.id, status: 'open' })
      .select('id, status')
      .single();
    if (createError || !created) return NextResponse.json({ error: 'Erreur création conversation' }, { status: 500 });
    conversation = created;
  }

  const trimmed = message.trim();
  await supabaseAdmin.from('chat_messages').insert({
    conversation_id: conversation.id, user_id: user.id, sender: 'user', content: trimmed,
  });
  await supabaseAdmin.from('chat_conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation.id);

  if (conversation.status !== 'escalated') {
    const { data: historyRows } = await supabaseAdmin
      .from('chat_messages')
      .select('sender, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(20);

    const { reply, escalate } = await generateBotReply(trimmed, historyRows || []);

    if (escalate) {
      await supabaseAdmin.from('chat_conversations').update({ status: 'escalated' }).eq('id', conversation.id);
      await supabaseAdmin.from('chat_messages').insert({
        conversation_id: conversation.id, user_id: user.id, sender: 'bot', content: ESCALATION_NOTICE,
      });
    } else {
      await supabaseAdmin.from('chat_messages').insert({
        conversation_id: conversation.id, user_id: user.id, sender: 'bot', content: reply,
      });
    }
  }

  const { data: messages } = await supabaseAdmin
    .from('chat_messages')
    .select('id, sender, content, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true });

  const { data: refreshedConversation } = await supabaseAdmin
    .from('chat_conversations')
    .select('id, status')
    .eq('id', conversation.id)
    .single();

  return NextResponse.json({ conversation: refreshedConversation, messages: messages || [] });
}
