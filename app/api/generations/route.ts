import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { generateMusic } from '@/lib/music-generator';
import { styleDescriptors } from '@/lib/styleDescriptors';

export async function POST(request: Request) {
  const supabase = createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { occasion, style, custom_message, voice_gender } = await request.json();
  if (!occasion || !style || !custom_message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  let { data: creditRow, error: creditError } = await supabase
    .from('user_credits')
    .select('balance, is_admin')
    .eq('user_id', user.id)
    .single();

  if (creditError || !creditRow) {
    const { error: insertError } = await supabase
      .from('user_credits')
      .insert({ user_id: user.id, balance: 3 });
    if (insertError) return NextResponse.json({ error: 'Failed to initialize credits' }, { status: 500 });
    creditRow = { balance: 3, is_admin: false };
  }

  const isAdmin = creditRow.is_admin === true;

  if (!isAdmin) {
    if (creditRow.balance < 1) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 });
    }
    const { error: deductError } = await supabase
      .from('user_credits')
      .update({ balance: creditRow.balance - 1 })
      .eq('user_id', user.id);
    if (deductError) return NextResponse.json({ error: 'Credit deduction failed' }, { status: 500 });
  }

  const { data: generation, error: insertError } = await supabase
    .from('generations')
    .insert({ user_id: user.id, occasion, style, custom_message, voice_gender: voice_gender || null, status: 'queued' })
    .select()
    .single();

  if (insertError || !generation) {
    if (!isAdmin) {
      await supabase.from('user_credits').update({ balance: creditRow.balance }).eq('user_id', user.id);
    }
    return NextResponse.json({ error: 'Failed to create generation' }, { status: 500 });
  }

  try {
    const styleKey = style.toLowerCase().replace(/[^a-z]/g, '');
    const enrichedStyle = styleDescriptors[styleKey] || style;
    const prompt = `A ${enrichedStyle} song for ${occasion}, about: ${custom_message}`;

    const genderParam = voice_gender === 'male' || voice_gender === 'female' || voice_gender === 'duet' ? voice_gender : undefined;
    const { predictionId } = await generateMusic(prompt, user.id, genderParam);

    await supabase
      .from('generations')
      .update({ prediction_id: predictionId, status: 'processing' })
      .eq('id', generation.id);

    return NextResponse.json({ id: generation.id, status: 'processing' });
  } catch (err: any) {
    console.error('Generation launch error:', err);
    if (!isAdmin) {
      await supabase.from('user_credits').update({ balance: creditRow.balance }).eq('user_id', user.id);
    }
    await supabase.from('generations').update({ status: 'failed' }).eq('id', generation.id);
    return NextResponse.json({ error: err.message || 'AI generation failed' }, { status: 500 });
  }
}
