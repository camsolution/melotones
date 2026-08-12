import { redirect } from 'next/navigation';
import { createServerClientWithCookies } from '@/lib/supabase/server';
import AuthForm from '@/components/AuthForm';

export const metadata = {
  title: 'Créer un compte',
  description: 'Créez votre compte Melotones et générez votre première chanson personnalisée par IA.',
  alternates: { canonical: '/signup' },
};

export default async function Signup() {
  const supabase = await createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  if (session) redirect('/dashboard');
  return <AuthForm />;
}
