import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = createServerClientWithCookies();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { occasion, style, custom_message } = await request.json();
  if (!occasion || !style || !custom_message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // 1. Vérifier ou créer les crédits
  let { data: creditRow, error: creditError } = await supabase
    .from('user_credits')
    .select('balance')
    .eq('user_id', session.user.id)
    .single();

  if (creditError || !creditRow) {
    const { error: insertError } = await supabase
      .from('user_credits')
      .insert({ user_id: session.user.id, balance: 3 });
    if (insertError) {
      return NextResponse.json({ error: 'Failed to initialize credits' }, { status: 500 });
    }
    creditRow = { balance: 3 };
  }

  if (creditRow.balance < 1) {
    return NextResponse.json({ error: 'Insufficient credits. You need at least 1 credit to generate a song.' }, { status: 402 });
  }

  // 2. Déduire 1 crédit
  const { error: deductError } = await supabase
    .from('user_credits')
    .update({ balance: creditRow.balance - 1 })
    .eq('user_id', session.user.id);
  if (deductError) return NextResponse.json({ error: 'Credit deduction failed' }, { status: 500 });

  // 3. Insérer la génération
  const { data: generation, error: insertGenError } = await supabase
    .from('generations')
    .insert({
      user_id: session.user.id,
      occasion,
      style,
      custom_message,
      status: 'processing',
    })
    .select()
    .single();

  if (insertGenError || !generation) {
    await supabase.from('user_credits').update({ balance: creditRow.balance }).eq('user_id', session.user.id);
    return NextResponse.json({ error: 'Failed to create generation' }, { status: 500 });
  }

  // 4. Génération (mock ou réelle selon config)
  try {
    const { generateMusic } = await import('@/lib/ai-generate');
    const { audioUrl } = await generateMusic(occasion, style, custom_message);
    const { error: updateError } = await supabase
      .from('generations')
      .update({ status: 'completed', audio_url: audioUrl })
      .eq('id', generation.id);

    if (updateError) {
      await supabase.from('generations').update({ status: 'failed' }).eq('id', generation.id);
      return NextResponse.json({ error: 'Generation update failed' }, { status: 500 });
    }

    return NextResponse.json({ id: generation.id, status: 'completed' });
  } catch (err) {
    console.error(err);
    await supabase.from('generations').update({ status: 'failed' }).eq('id', generation.id);
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
  }
}
