import { createServerClientWithCookies } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';

export async function POST() {
  const authClient = await createServerClientWithCookies();
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await supabaseAdmin
    .from('presence')
    .upsert({ user_id: user.id, last_seen_at: new Date().toISOString() });

  return NextResponse.json({ ok: true });
}
