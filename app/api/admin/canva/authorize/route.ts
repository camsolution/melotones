import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdmin } from '@/lib/admin';
import { isCanvaConfigured } from '@/lib/canva';

export const dynamic = 'force-dynamic';

const SCOPES = [
  'design:meta:write', 'app:read', 'folder:permission:read', 'design:meta:read',
  'brandtemplate:meta:read', 'design:content:read', 'brandtemplate:content:read',
  'folder:read', 'design:content:write', 'comment:read', 'profile:read',
  'asset:write', 'design:permission:read', 'asset:read', 'folder:write',
].join(' ');

// Démarre le flux OAuth Canva (PKCE) — jamais déclenché automatiquement,
// uniquement par un clic explicite d'un admin authentifié depuis le dashboard
// (section 4 de la mission : connexion d'un compte externe = confirmation
// humaine obligatoire).
export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  if (!isCanvaConfigured()) {
    return NextResponse.json({ error: 'CANVA_CLIENT_ID/CANVA_CLIENT_SECRET manquants' }, { status: 500 });
  }
  const redirectUri = process.env.CANVA_REDIRECT_URI;
  if (!redirectUri) {
    return NextResponse.json({ error: 'CANVA_REDIRECT_URI manquant' }, { status: 500 });
  }

  const codeVerifier = crypto.randomBytes(96).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const state = crypto.randomBytes(32).toString('base64url');

  const authUrl = new URL('https://www.canva.com/api/oauth/authorize');
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 's256');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', process.env.CANVA_CLIENT_ID!);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('redirect_uri', redirectUri);

  const res = NextResponse.redirect(authUrl.toString());
  // httpOnly + court délai : ne survit que le temps du consentement Canva.
  res.cookies.set('canva_oauth_verifier', codeVerifier, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  res.cookies.set('canva_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  return res;
}
