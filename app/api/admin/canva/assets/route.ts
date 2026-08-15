import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  const platformFilter = searchParams.get('platform');
  const search = searchParams.get('q');

  let query = supabaseAdmin
    .from('content_assets')
    .select('id, canva_design_id, canva_folder_name, canva_edit_url, thumbnail_url, exported_storage_path, title, platform, status, canva_updated_at, last_sync_at, suggested_caption_fr, suggested_caption_en, suggested_hashtags')
    .order('canva_updated_at', { ascending: false })
    .limit(200);

  if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);
  if (platformFilter && platformFilter !== 'all') query = query.eq('platform', platformFilter);
  if (search) query = query.ilike('title', `%${search}%`);

  const { data, error: queryError } = await query;
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });

  // Les vignettes Canva (thumbnail_url) sont des liens signés qui expirent en
  // ~24h (constaté en direct le 2026-08-15 : vignettes synchronisées la veille
  // déjà mortes) — pour tout asset déjà exporté vers notre Storage, on sert
  // plutôt une URL signée depuis marketing-content (durée bien plus longue),
  // stable indépendamment de Canva.
  const withStableThumbnails = await Promise.all(
    (data || []).map(async (row) => {
      const { exported_storage_path, ...rest } = row;
      if (!exported_storage_path) return rest;
      const { data: signed } = await supabaseAdmin.storage
        .from('marketing-content')
        .createSignedUrl(exported_storage_path, 7 * 24 * 60 * 60);
      return signed?.signedUrl ? { ...rest, thumbnail_url: signed.signedUrl } : rest;
    })
  );

  return NextResponse.json(withStableThumbnails);
}
