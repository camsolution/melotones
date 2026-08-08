import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { generateMusic } from '@/lib/music-generator';

export async function POST(request: Request) {
  const supabase = createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { occasion, style, custom_message } = await request.json();
  if (!occasion || !style || !custom_message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // 1. Vérifier / créer les crédits
  let { data: creditRow, error: creditError } = await supabase
    .from('user_credits')
    .select('balance')
    .eq('user_id', user.id)
    .single();
  if (creditError || !creditRow) {
    const { error: insertError } = await supabase
      .from('user_credits')
      .insert({ user_id: user.id, balance: 3 });
    if (insertError) return NextResponse.json({ error: 'Failed to initialize credits' }, { status: 500 });
    creditRow = { balance: 3 };
  }
  if (creditRow.balance < 1) {
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
  }

  // 2. Déduire 1 crédit
  const { error: deductError } = await supabase
    .from('user_credits')
    .update({ balance: creditRow.balance - 1 })
    .eq('user_id', user.id);
  if (deductError) return NextResponse.json({ error: 'Credit deduction failed' }, { status: 500 });

  // 3. Créer l’enregistrement
  const { data: generation, error: insertError } = await supabase
    .from('generations')
    .insert({
      user_id: user.id,
      occasion,
      style,
      custom_message,
      status: 'queued',
    })
    .select()
    .single();
  if (insertError || !generation) {
    await supabase.from('user_credits').update({ balance: creditRow.balance }).eq('user_id', user.id);
    return NextResponse.json({ error: 'Failed to create generation' }, { status: 500 });
  }

  // 4. Lancer la génération via l’orchestrateur vocal (Suno, Udio, Mureka)
  try {
    const styleDescriptors: Record<string, string> = {
      mbalax: 'Mbalax Senegalese style: fast sabar drum percussion, polyrhythmic tama talking drum, call-and-response vocal structure, energetic griot-style singing, danceable groove',
      afrobeat: 'Afrobeat style: syncopated horn sections, funky basslines, layered percussion, call-and-response chants',
      coupedecale: 'Coupé-Décalé style: upbeat Ivorian dance rhythm, electronic percussion, chant-driven vocals, festive energy',
    };
    const styleKey = style.toLowerCase().replace(/[^a-z]/g, '');
    const enrichedStyle = styleDescriptors[styleKey] || style;
    const prompt = `A ${enrichedStyle} song for ${occasion}, about: ${custom_message}`;
    const { predictionId } = await generateMusic(prompt, user.id);

    await supabase
      .from('generations')
      .update({ prediction_id: predictionId, status: 'processing' })
      .eq('id', generation.id);

    return NextResponse.json({ id: generation.id, status: 'processing' });
  } catch (err: any) {
    console.error('Generation launch error:', err);
    // Rembourser le crédit
    await supabase.from('user_credits').update({ balance: creditRow.balance }).eq('user_id', user.id);
    await supabase.from('generations').update({ status: 'failed' }).eq('id', generation.id);
    const message = err.message || 'AI generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
