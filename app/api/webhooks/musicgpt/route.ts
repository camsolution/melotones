import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';
import { finalizeIfReady } from '@/lib/song-processing';

export async function POST(request: Request) {
  let taskId: string | null = null;
  try {
    const body = await request.json();
    taskId = body.task_id || null;
  } catch (err) {
    console.error('Webhook MusicGPT: payload illisible', err);
    return NextResponse.json({ received: true });
  }

  if (!taskId) return NextResponse.json({ received: true });

  const predictionId = `musicgpt_${taskId}`;
  const { data: gen } = await supabaseAdmin
    .from('generations')
    .select('id')
    .eq('prediction_id', predictionId)
    .single();

  if (!gen) {
    console.warn('Webhook MusicGPT: aucune génération trouvée pour', predictionId);
    return NextResponse.json({ received: true });
  }

  try {
    await finalizeIfReady(gen.id);
  } catch (err) {
    console.error('Webhook MusicGPT: erreur finalisation', err);
  }

  return NextResponse.json({ received: true });
}
