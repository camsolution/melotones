import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { generateMusic } from '@/lib/ai-generate';
import Replicate from 'replicate';

export async function POST(request: Request) {
  const supabase = createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { occasion, style, custom_message } = await request.json();
  if (!occasion || !style || !custom_message) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // 1. Vérifier ou créer les crédits
  let { data: creditRow, error: creditError } = await supabase
    .from('user_credits')
    .select('balance')
    .eq('user_id', user.id)
    .single();

  if (creditError || !creditRow) {
    const { error: insertError } = await supabase
      .from('user_credits')
      .insert({ user_id: user.id, balance: 3 });
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
    .eq('user_id', user.id);
  if (deductError) return NextResponse.json({ error: 'Credit deduction failed' }, { status: 500 });

  // 3. Créer l'enregistrement de la génération
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

  // 4. Lancer la génération (mock ou réelle)
  try {
    let predictionId: string | null = null;

    if (process.env.NEXT_PUBLIC_MOCK_AI !== 'true' && process.env.REPLICATE_API_TOKEN) {
      const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });
      const prompt = `A ${style} song for ${occasion}, about: ${custom_message}`;
      // Utilisation du modèle sans version (dernière disponible)
      const prediction = await replicate.predictions.create({
        model: "riffusion/riffusion",
        input: {
          prompt_a: prompt,
          denoising: 0.75,
          seed_image_id: "vibes",
          num_inference_steps: 50,
        },
      });
      predictionId = prediction.id;
    } else {
      // Mode mock : on simule une prediction_id
      predictionId = `mock-${Date.now()}`;
    }

    // Mettre à jour avec le prediction_id et passer en "processing"
    await supabase
      .from('generations')
      .update({ prediction_id: predictionId, status: 'processing' })
      .eq('id', generation.id);

    return NextResponse.json({ id: generation.id, status: 'processing' });
  } catch (err) {
    console.error('Generation launch error:', err);
    // Rembourser le crédit
    await supabase.from('user_credits').update({ balance: creditRow.balance }).eq('user_id', user.id);
    await supabase.from('generations').update({ status: 'failed' }).eq('id', generation.id);
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
  }
}
