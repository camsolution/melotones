import { createServerClientWithCookies } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function requireAdmin() {
  const supabase = createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' as const, status: 401, user: null };

  const { data: credit } = await supabaseAdmin
    .from('user_credits')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (!credit?.is_admin) return { error: 'Forbidden' as const, status: 403, user: null };
  return { error: null, status: 200, user };
}

export { supabaseAdmin };
