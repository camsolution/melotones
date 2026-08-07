import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { checkPrediction } from '@/lib/music-generator';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: gen, error } = await supabase
    .from('generations')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (error || !gen) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (gen.status === 'completed' || gen.status === 'failed') return NextResponse.json(gen);

  if (gen.status === 'processing' || gen.status === 'queued') {
    if (gen.prediction_id) {
      try {
        const audioUrl = await checkPrediction(gen.prediction_id);
        if (audioUrl) {
          const resp = await fetch(audioUrl);
          if (resp.ok) {
            const buffer = await resp.arrayBuffer();
            const fileName = `${user.id}/${gen.id}.mp3`;
            const { error: uploadErr } = await supabaseAdmin.storage
              .from('songs')
              .upload(fileName, buffer, { contentType: 'audio/mpeg', upsert: true });
            if (!uploadErr) {
              const { data: publicData } = supabaseAdmin.storage.from('songs').getPublicUrl(fileName);
              await supabase.from('generations').update({ status: 'completed', audio_url: publicData.publicUrl }).eq('id', gen.id);
              gen.status = 'completed';
              gen.audio_url = publicData.publicUrl;
            } else {
              await supabase.from('generations').update({ status: 'failed' }).eq('id', gen.id);
              gen.status = 'failed';
            }
          } else {
            // Si le téléchargement de l’audio échoue, on met en échec
            await supabase.from('generations').update({ status: 'failed' }).eq('id', gen.id);
            gen.status = 'failed';
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }
  }

  return NextResponse.json(gen);
}
