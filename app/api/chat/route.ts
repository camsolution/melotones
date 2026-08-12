import { createServerClientWithCookies } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authClient = await createServerClientWithCookies();
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: conversation } = await supabaseAdmin
    .from('chat_conversations')
    .select('id, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) return NextResponse.json({ conversation: null, messages: [] });

  const { data: messages } = await supabaseAdmin
    .from('chat_messages')
    .select('id, sender, content, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ conversation, messages: messages || [] });
}
