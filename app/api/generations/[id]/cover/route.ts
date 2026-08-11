import { createServerClientWithCookies } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';

const MAX_SIZE = 8 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClientWithCookies();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ownership vérifié via le client authentifié (RLS: lecture limitée à ses propres lignes).
  const { data: owned } = await supabase.from('generations').select('id').eq('id', params.id).eq('user_id', user.id).single();
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const form = await request.formData();
  const file = form.get('cover');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing cover file' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large' }, { status: 400 });
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const fileName = `${user.id}/${params.id}.png`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('covers')
    .upload(fileName, buffer, { contentType: 'image/png', upsert: true });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicData } = supabaseAdmin.storage.from('covers').getPublicUrl(fileName);
  const coverUrl = `${publicData.publicUrl}?v=${Date.now()}`;

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('generations')
    .update({ cover_url: coverUrl })
    .eq('id', params.id)
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message || 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ cover_url: updated.cover_url });
}
