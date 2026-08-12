import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/admin';

// Compteurs publics affichés sur la page d'accueil — agrégats non sensibles
// uniquement (pas d'email, pas de contenu), lus via service role car
// user_credits/generations sont verrouillées par RLS pour le client.
export async function GET() {
  const [{ count: totalUsers }, { count: totalSongs }] = await Promise.all([
    supabaseAdmin.from('user_credits').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('generations').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
  ]);

  return NextResponse.json({ totalUsers: totalUsers ?? 0, totalSongs: totalSongs ?? 0 });
}
