import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdmin } from '@/lib/admin';
import { isTiktokConfigured } from '@/lib/tiktok';

export const dynamic = 'force-dynamic';

// Doit correspondre exactement aux scopes réellement ajoutés dans la config
// de l'app TikTok (Add scopes) — une demande d'un scope non configuré fait
// échouer TOUT le flux OAuth avec une erreur "scope" (constaté le 2026-08-14).
// video.publish (publication directe) n'est pas encore configuré/audité —
// ajouter "video.publish" ici seulement une fois ajouté côté TikTok.
const SCOPES = 'user.info.basic,video.upload';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  if (!isTiktokConfigured()) {
    return NextResponse.json({ error: 'TIKTOK_CLIENT_KEY/TIKTOK_CLIENT_SECRET manquants' }, { status: 500 });
  }
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  if (!redirectUri) {
    return NextResponse.json({ error: 'TIKTOK_REDIRECT_URI manquant' }, { status: 500 });
  }

  const codeVerifier = crypto.randomBytes(64).toString('hex'); // TikTok exige un verifier alphanumérique 43-128 caractères
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('hex'); // TikTok attend un hex, pas base64url (contrairement à Canva)
  const state = crypto.randomBytes(32).toString('base64url');

  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
  authUrl.searchParams.set('client_key', process.env.TIKTOK_CLIENT_KEY!);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set('tiktok_oauth_verifier', codeVerifier, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  res.cookies.set('tiktok_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  return res;
}
