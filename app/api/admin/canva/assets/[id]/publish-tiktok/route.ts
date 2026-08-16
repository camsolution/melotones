import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';
import { exportCanvaDesignAsVideo } from '@/lib/canva';
import { uploadVideoDraftToTiktok } from '@/lib/tiktok';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

export const dynamic = 'force-dynamic';

// Dépose un asset approuvé sur TikTok en BROUILLON (inbox) — jamais de
// publication directe/automatique (scope video.publish non disponible, et de
// toute façon la mission interdit à un agent de publier sans validation
// humaine). Un humain doit ouvrir l'app TikTok pour finaliser et publier.
// Réservé aux assets au statut APPROVED : c'est la validation humaine
// explicite exigée avant toute action de diffusion (section 21/47).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { id } = await params;
  const { data: asset, error: fetchError } = await supabaseAdmin
    .from('content_assets')
    .select('id, canva_design_id, title, status')
    .eq('id', id)
    .single();
  if (fetchError || !asset) return NextResponse.json({ error: 'Asset introuvable' }, { status: 404 });
  // MANUAL_UPLOAD_REQUIRED accepté en plus d'APPROVED : quand un asset part
  // vers TikTok ET YouTube (voir handleApproveAndPublish côté dashboard), le
  // premier appel fait déjà passer le statut par MANUAL_UPLOAD_REQUIRED avant
  // que le second ne se déclenche — sans ça, le second réseau échouait
  // systématiquement avec cette même erreur (constaté en direct le 2026-08-16).
  if (asset.status !== 'APPROVED' && asset.status !== 'MANUAL_UPLOAD_REQUIRED') {
    return NextResponse.json({ error: `L'asset doit être au statut APPROVED (actuellement ${asset.status})` }, { status: 400 });
  }

  await supabaseAdmin.from('content_assets').update({ status: 'EXPORTING' }).eq('id', id);

  try {
    const videoUrl = await exportCanvaDesignAsVideo(asset.canva_design_id);
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

    const result = await uploadVideoDraftToTiktok(videoBuffer);
    if ('error' in result) {
      await supabaseAdmin.from('content_assets').update({ status: 'FAILED', sync_error: result.error }).eq('id', id);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // MANUAL_UPLOAD_REQUIRED reflète la réalité : le brouillon est bien
    // déposé sur TikTok, mais un humain doit encore ouvrir l'app pour publier.
    await supabaseAdmin.from('content_assets').update({
      status: 'MANUAL_UPLOAD_REQUIRED',
      sync_error: null,
    }).eq('id', id);

    // publishId est l'ID du job de dépôt en brouillon, pas forcément l'ID
    // vidéo final tel qu'il existera une fois publié manuellement par
    // l'humain — gardé pour permettre de vérifier le statut plus tard, mais
    // la lecture de stats réelles (vues/likes) nécessite en plus le scope
    // video.list, pas encore accordé (voir human_tasks).
    await supabaseAdmin.from('platform_publications').insert({
      content_asset_id: id,
      platform: 'tiktok',
      external_video_id: result.publishId,
    });

    return NextResponse.json({ ok: true, tiktokStatus: result.status, publishId: result.publishId });
  } catch (err: any) {
    await supabaseAdmin.from('content_assets').update({ status: 'FAILED', sync_error: err.message || 'Erreur inconnue' }).eq('id', id);
    return NextResponse.json({ error: err.message || 'Erreur inconnue' }, { status: 500 });
  }
}
