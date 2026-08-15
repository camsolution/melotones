import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';
import { exportCanvaDesignAsVideo } from '@/lib/canva';
import { uploadVideoToYoutube } from '@/lib/youtube';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

export const dynamic = 'force-dynamic';

// Dépose un asset approuvé sur YouTube en visibilité PRIVÉE — jamais publié
// automatiquement (même principe que le brouillon TikTok). Un humain doit
// ouvrir YouTube Studio pour changer la visibilité et publier réellement.
// Réservé aux assets APPROVED : validation humaine explicite déjà faite.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  const { data: asset, error: fetchError } = await supabaseAdmin
    .from('content_assets')
    .select('id, canva_design_id, title, status, suggested_caption_fr, suggested_hashtags')
    .eq('id', id)
    .single();
  if (fetchError || !asset) return NextResponse.json({ error: 'Asset introuvable' }, { status: 404 });
  if (asset.status !== 'APPROVED') {
    return NextResponse.json({ error: `L'asset doit être au statut APPROVED (actuellement ${asset.status})` }, { status: 400 });
  }

  await supabaseAdmin.from('content_assets').update({ status: 'EXPORTING' }).eq('id', id);

  try {
    // Horizontal pour YouTube classique (contrairement au vertical TikTok).
    const videoUrl = await exportCanvaDesignAsVideo(asset.canva_design_id, 'horizontal_1080p');
    if (!videoUrl) {
      await supabaseAdmin.from('content_assets').update({ status: 'FAILED', sync_error: 'Export Canva échoué' }).eq('id', id);
      return NextResponse.json({ error: 'Export Canva échoué' }, { status: 500 });
    }

    const videoRes = await fetchWithTimeout(videoUrl, {}, 30_000);
    if (!videoRes.ok) {
      await supabaseAdmin.from('content_assets').update({ status: 'FAILED', sync_error: 'Téléchargement vidéo échoué' }).eq('id', id);
      return NextResponse.json({ error: 'Téléchargement vidéo échoué' }, { status: 500 });
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    await supabaseAdmin.from('content_assets').update({ status: 'EXPORTED' }).eq('id', id);

    const description = [asset.suggested_caption_fr, asset.suggested_hashtags].filter(Boolean).join('\n\n') || 'Melotones — chansons personnalisées composées par IA. melotones.co';

    const result = await uploadVideoToYoutube(videoBuffer, { title: asset.title, description });
    if ('error' in result) {
      await supabaseAdmin.from('content_assets').update({ status: 'FAILED', sync_error: result.error }).eq('id', id);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    await supabaseAdmin.from('content_assets').update({ status: 'MANUAL_UPLOAD_REQUIRED', sync_error: null }).eq('id', id);

    return NextResponse.json({ ok: true, videoId: result.videoId, privacyStatus: result.privacyStatus });
  } catch (err: any) {
    await supabaseAdmin.from('content_assets').update({ status: 'FAILED', sync_error: err.message || 'Erreur inconnue' }).eq('id', id);
    return NextResponse.json({ error: err.message || 'Erreur inconnue' }, { status: 500 });
  }
}
