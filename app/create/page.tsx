import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createServerClientWithCookies } from '@/lib/supabase/server';
import CreateForm from '@/components/CreateForm';

export default async function CreatePage() {
  const supabase = await createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');
  return (
    <Suspense>
      <CreateForm />
    </Suspense>
  );
}
