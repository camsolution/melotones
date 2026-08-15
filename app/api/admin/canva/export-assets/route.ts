import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';
import { createCanvaExportJob, getCanvaExportJob } from '@/lib/canva';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Traite un lot à chaque appel (plutôt que tout d'un coup) pour rester sous
// maxDuration — le dashboard rappelle cette route en boucle jusqu'à
// remaining=0 (voir handleExportCanvaAssets dans AdminDashboard.tsx).
const BATCH_SIZE = 6;

async function exportOneDesign(designId: string): Promise<Buffer | { error: string }> {
  const job = await createCanvaExportJob({ design_id: designId, format: { type: 'png' } });
  if (!job?.job?.id) return { error: 'Échec de création du job export' };

  let finalJob = job.job;
  for (let i = 0; i < 20 && finalJob.status === 'in_progress'; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    finalJob = await getCanvaExportJob(finalJob.id).then((j) => j?.job ?? finalJob);
  }
  if (finalJob.status !== 'success' || !finalJob.urls?.[0]) {
    return { error: `Export échoué (statut ${finalJob.status})` };
  }

  const fileRes = await fetchWithTimeout(finalJob.urls[0], {}, 30_000);
  if (!fileRes.ok) return { error: `Téléchargement échoué (HTTP ${fileRes.status})` };
  return Buffer.from(await fileRes.arrayBuffer());
}

export async function POST() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { data: pending, error: dbError } = await supabaseAdmin
    .from('content_assets')
    .select('id, canva_design_id')
    .is('exported_storage_path', null)
    .not('canva_design_id', 'is', null)
    .limit(BATCH_SIZE);
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  const { count: remainingBefore } = await supabaseAdmin
    .from('content_assets')
    .select('*', { count: 'exact', head: true })
    .is('exported_storage_path', null)
    .not('canva_design_id', 'is', null);

  let exported = 0;
  const errors: string[] = [];

  for (const asset of pending || []) {
    const result = await exportOneDesign(asset.canva_design_id);
    if ('error' in result) {
      errors.push(`${asset.canva_design_id}: ${result.error}`);
      continue;
    }

    const path = `canva-export/${asset.canva_design_id}.png`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('marketing-content')
      .upload(path, result, { contentType: 'image/png', upsert: true });
    if (uploadError) { errors.push(`${asset.canva_design_id}: upload — ${uploadError.message}`); continue; }

    await supabaseAdmin
      .from('content_assets')
      .update({ exported_storage_path: path, exported_at: new Date().toISOString() })
      .eq('id', asset.id);
    exported += 1;
  }

  const remaining = Math.max(0, (remainingBefore ?? 0) - exported);
  return NextResponse.json({ exported, remaining, errors: errors.length > 0 ? errors : undefined });
}
