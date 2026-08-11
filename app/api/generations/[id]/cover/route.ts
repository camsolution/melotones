import { createServerClientWithCookies } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/admin';
import { NextResponse } from 'next/server';

const MAX_SIZE = 8 * 1024 * 1024;

function hasValidImageSignature(bytes: Uint8Array, mimeType: string): boolean {
  const startsWith = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  switch (mimeType) {
    case 'image/png': return startsWith([0x89, 0x50, 0x4e, 0x47]);
    case 'image/jpeg': return startsWith([0xff, 0xd8, 0xff]);
    case 'image/gif': return startsWith([0x47, 0x49, 0x46, 0x38]);
    case 'image/webp': return startsWith([0x52, 0x49, 0x46, 0x46]) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    default: return false;
  }
}

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
  const EXT_BY_TYPE: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();

  // Le type MIME déclaré par le navigateur (file.type) est arbitraire côté
  // client — on vérifie la signature binaire réelle du fichier pour éviter
  // qu'un contenu quelconque soit déguisé en image via une extension usurpée.
  if (!hasValidImageSignature(new Uint8Array(buffer), file.type)) {
    return NextResponse.json({ error: 'Le contenu du fichier ne correspond pas à une image valide' }, { status: 400 });
  }

  const fileName = `${user.id}/${params.id}.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('covers')
    .upload(fileName, buffer, { contentType: file.type, upsert: true });
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
