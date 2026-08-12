import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export async function GET() {
  const supabase = createServerClientWithCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ user: null });

  const { data: credit } = await supabaseAdmin
    .from('user_credits')
    .select('balance, is_admin, language')
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    balance: credit?.balance ?? 0,
    is_admin: credit?.is_admin ?? false,
    language: credit?.language ?? 'fr',
  });
}

export async function PATCH(request: Request) {
  const supabase = createServerClientWithCookies();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { language } = await request.json();
  if (language !== 'fr' && language !== 'en') {
    return NextResponse.json({ error: 'Langue invalide' }, { status: 400 });
  }

  // La ligne user_credits peut ne pas encore exister si l'utilisateur n'a jamais
  // généré de chanson (elle n'est sinon créée qu'à la première génération) — dans
  // ce cas on la crée avec les mêmes valeurs par défaut que le lazy-init de
  // /api/generations, pour ne pas priver le nouvel utilisateur de ses 3 Chansons offertes.
  const { data: updated } = await supabaseAdmin
    .from('user_credits')
    .update({ language })
    .eq('user_id', user.id)
    .select()
    .maybeSingle();

  if (!updated) {
    const { error: insertError } = await supabaseAdmin
      .from('user_credits')
      .insert({ user_id: user.id, balance: 3, language });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ language });
}
