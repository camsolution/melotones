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
  if (asset.status !== 'APPROVED') {
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

    return NextResponse.json({ ok: true, tiktokStatus: result.status, publishId: result.publishId });
  } catch (err: any) {
    await supabaseAdmin.from('content_assets').update({ status: 'FAILED', sync_error: err.message || 'Erreur inconnue' }).eq('id', id);
    return NextResponse.json({ error: err.message || 'Erreur inconnue' }, { status: 500 });
  }
}
