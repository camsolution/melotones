import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { syncCanvaContentAssets } from '@/lib/canvaSync';

export const dynamic = 'force-dynamic';

// DRY_RUN par défaut (section 11 de la mission) : une synchronisation réelle
// n'a lieu que si dryRun:false est explicitement passé par un clic admin
// distinct après avoir vu l'aperçu.
export async function POST(request: Request) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json().catch(() => ({}));
  const dryRun = body?.dryRun !== false;

  const report = await syncCanvaContentAssets({ dryRun });
  return NextResponse.json(report);
}
