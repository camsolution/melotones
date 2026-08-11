import { createServerClientWithCookies } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';
import { finalizeIfReady } from '@/lib/song-processing';
import { localizeProviderError } from '@/lib/providerErrors';

// Ne jamais renvoyer failure_reason (texte technique brut du fournisseur) tel
// quel au client — seule la version traduite/simplifiée est exposée.
async function withLocalizedError(gen: any, userId: string) {
  const { failure_reason, ...safe } = gen ?? {};
  if (gen?.status !== 'failed' || !failure_reason) return safe;
  const { data: creditRow } = await supabaseAdmin.from('user_credits').select('language').eq('user_id', userId).single();
  return { ...safe, localized_error: localizeProviderError(failure_reason, creditRow?.language || 'fr') };
}

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
    return NextResponse.json(await withLocalizedError(refreshed || gen, user.id));
  }

  return NextResponse.json(await withLocalizedError(gen, user.id));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { is_public } = await req.json();
  if (typeof is_public !== 'boolean') {
    return NextResponse.json({ error: 'is_public must be a boolean' }, { status: 400 });
  }

  // Vérifie l'ownership via le client authentifié, puis écrit via le
  // service role — generations n'accorde plus d'écriture directe au client.
  const { data: owned } = await supabase.from('generations').select('id').eq('id', params.id).eq('user_id', user.id).single();
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('generations')
    .update({ is_public })
    .eq('id', params.id)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  return NextResponse.json(data);
}
