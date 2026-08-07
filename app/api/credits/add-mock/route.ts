import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_MOCK_PAYMENTS !== 'true') {
    return NextResponse.json({ error: 'Mock mode disabled' }, { status: 400 });
  }
  const supabase = createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { amount } = await request.json();
  
  // Vérifier si l'utilisateur a une ligne de crédits
  const { data: creditRow } = await supabase
    .from('user_credits')
    .select('balance')
    .eq('user_id', session.user.id)
    .single();

  if (!creditRow) {
    // Créer une ligne avec le montant demandé
    const { error: insertError } = await supabase
      .from('user_credits')
      .insert({ user_id: session.user.id, balance: amount });
    if (insertError) return NextResponse.json({ error: 'Failed to create credits' }, { status: 500 });
    return NextResponse.json({ success: true, newBalance: amount });
  }

  // Mettre à jour le solde existant
  const { error } = await supabase
    .from('user_credits')
    .update({ balance: creditRow.balance + amount })
    .eq('user_id', session.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  
  return NextResponse.json({ success: true, newBalance: creditRow.balance + amount });
}
