import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';
import { generateCaptionSuggestion } from '@/lib/captionGenerator';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  const { data: asset, error: fetchError } = await supabaseAdmin
    .from('content_assets')
    .select('id, title, platform, canva_folder_name')
    .eq('id', id)
    .single();
  if (fetchError || !asset) return NextResponse.json({ error: 'Asset introuvable' }, { status: 404 });

  const suggestion = await generateCaptionSuggestion({
    title: asset.title,
    platform: asset.platform,
    folderName: asset.canva_folder_name,
  });
  if (!suggestion) return NextResponse.json({ error: 'Génération indisponible pour le moment' }, { status: 503 });

  await supabaseAdmin.from('content_assets').update({
    suggested_caption_fr: suggestion.captionFr,
    suggested_caption_en: suggestion.captionEn,
    suggested_hashtags: suggestion.hashtags,
    caption_generated_at: new Date().toISOString(),
  }).eq('id', id);

  return NextResponse.json(suggestion);
}
