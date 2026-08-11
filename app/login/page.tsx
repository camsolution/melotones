import { redirect } from 'next/navigation';
import { createServerClientWithCookies } from '@/lib/supabase/server';
import AuthForm from '@/components/AuthForm';

export default async function Login() {
  const supabase = createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) redirect('/dashboard');
  return <AuthForm />;
}
