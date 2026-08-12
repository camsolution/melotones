import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const MAX_LEN = 200;

// Suivi de première partie, anonyme (aucun cookie tiers, aucune donnée
// partagée hors de notre propre base) — sert uniquement à mesurer le tunnel
// visite → inscription → activation → achat, déjà calculable côté serveur
// pour les étapes après inscription (voir /api/admin/analytics). Ce endpoint
// ne comble que la partie manquante : le nombre de visiteurs anonymes.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.session_id !== 'string' || typeof body.path !== 'string') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const sessionId = body.session_id.slice(0, 64);
  const path = body.path.slice(0, MAX_LEN);
  if (!sessionId) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  await supabaseAdmin.from('page_views').insert({ session_id: sessionId, path });

  return NextResponse.json({ ok: true });
}
