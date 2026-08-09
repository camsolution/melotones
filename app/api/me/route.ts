import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function GET() {
  const supabase = createServerClientWithCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ user: null });

  const { data: credit } = await supabaseAdmin
    .from('user_credits')
    .select('balance, is_admin')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    balance: credit?.balance ?? 0,
    is_admin: credit?.is_admin ?? false,
  });
}
