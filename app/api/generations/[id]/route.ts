import { createServerClientWithCookies } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { finalizeIfReady } from '@/lib/song-processing';

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

  if (gen.status === 'processing' || gen.status === 'queued') {
    try {
      await finalizeIfReady(gen.id);
    } catch (err) {
      console.error('Polling error:', err);
    }
    const { data: refreshed } = await supabase
      .from('generations')
      .select('*')
      .eq('id', params.id)
      .single();
    return NextResponse.json(refreshed || gen);
  }

  return NextResponse.json(gen);
}
