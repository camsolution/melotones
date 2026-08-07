import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = params;

  const { data: generation, error } = await supabase
    .from('generations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !generation) {
    return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
  }

  if (generation.status === 'completed' || generation.status === 'failed') {
    return NextResponse.json(generation);
  }

  if (generation.status === 'processing' || generation.status === 'queued') {
    if (generation.prediction_id && !generation.prediction_id.startsWith('mock-')) {
      try {
        const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });
        const prediction = await replicate.predictions.get(generation.prediction_id);

        if (prediction.status === 'succeeded') {
          const audioUrl = (prediction.output as any)?.audio;
          if (audioUrl) {
            const response = await fetch(audioUrl);
            if (!response.ok) throw new Error('Failed to fetch audio from Replicate');
            const audioBuffer = await response.arrayBuffer();
            const fileName = `${user.id}/${generation.id}.mp3`;
            const { error: uploadError } = await supabaseAdmin
              .storage.from('songs')
              .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true });

            if (uploadError) {
              await supabase.from('generations').update({ status: 'failed' }).eq('id', id);
              generation.status = 'failed';
            } else {
              const { data: publicUrlData } = supabaseAdmin.storage.from('songs').getPublicUrl(fileName);
              const publicUrl = publicUrlData.publicUrl;
              await supabase.from('generations').update({ status: 'completed', audio_url: publicUrl }).eq('id', id);
              generation.status = 'completed';
              generation.audio_url = publicUrl;
            }
          } else {
            await supabase.from('generations').update({ status: 'failed' }).eq('id', id);
            generation.status = 'failed';
          }
        } else if (prediction.status === 'failed') {
          await supabase.from('generations').update({ status: 'failed' }).eq('id', id);
          generation.status = 'failed';
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    } else if (generation.prediction_id && generation.prediction_id.startsWith('mock-')) {
      const elapsed = Date.now() - parseInt(generation.prediction_id.split('-')[1]);
      if (elapsed > 3000) {
        await supabase.from('generations').update({ status: 'completed', audio_url: '/audio/sample.mp3' }).eq('id', id);
        generation.status = 'completed';
        generation.audio_url = '/audio/sample.mp3';
      }
    }
  }

  return NextResponse.json(generation);
}
