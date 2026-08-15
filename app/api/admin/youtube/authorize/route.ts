import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdmin } from '@/lib/admin';
import { isYoutubeConfigured } from '@/lib/youtube';

export const dynamic = 'force-dynamic';

// youtube.upload : déposer des vidéos (en privé/non répertorié par défaut,
// c'est nous qui choisissons la visibilité à l'appel — jamais publiée en
// public sans action explicite). youtube.readonly : lire les infos de chaîne.
const SCOPES = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  if (!isYoutubeConfigured()) {
    return NextResponse.json({ error: 'YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET manquants' }, { status: 500 });
  }
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;
  if (!redirectUri) {
    return NextResponse.json({ error: 'YOUTUBE_REDIRECT_URI manquant' }, { status: 500 });
  }

  const state = crypto.randomBytes(32).toString('base64url');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', process.env.YOUTUBE_CLIENT_ID!);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('access_type', 'offline'); // requis pour obtenir un refresh_token
  authUrl.searchParams.set('prompt', 'consent'); // force le renvoi d'un refresh_token à chaque connexion
  authUrl.searchParams.set('state', state);

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set('youtube_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  return res;
}
