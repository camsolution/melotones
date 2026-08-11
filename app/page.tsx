import { redirect } from 'next/navigation';
import { createServerClientWithCookies } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  redirect(session ? '/dashboard' : '/login');
}
