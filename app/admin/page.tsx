import { createServerClientWithCookies } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import AdminDashboard from '@/components/AdminDashboard';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function AdminPage() {
  const supabase = await createServerClientWithCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: credit } = await supabaseAdmin
    .from('user_credits')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (!credit?.is_admin) redirect('/dashboard');

  return <AdminDashboard />;
}
