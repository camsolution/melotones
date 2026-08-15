import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { storeInitialTiktokConnection } from '@/lib/tiktok';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

export const dynamic = 'force-dynamic';

const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

export async function GET(request: Request) {
  const { error, status, user } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const tiktokError = url.searchParams.get('error');

  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(cookieHeader.split(';').map(c => {
    const i = c.indexOf('=');
    return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
  }));
  const codeVerifier = cookies['tiktok_oauth_verifier'];
  const expectedState = cookies['tiktok_oauth_state'];

  const clear = (res: NextResponse) => {
    res.cookies.set('tiktok_oauth_verifier', '', { maxAge: 0, path: '/' });
    res.cookies.set('tiktok_oauth_state', '', { maxAge: 0, path: '/' });
    return res;
  };

  if (tiktokError || !code || !returnedState || !codeVerifier || !expectedState || returnedState !== expectedState) {
    return clear(NextResponse.redirect(new URL(`/admin?tiktok=error${tiktokError ? `&reason=${encodeURIComponent(tiktokError)}` : ''}`, request.url)));
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;
  if (!clientKey || !clientSecret || !redirectUri) {
    return clear(NextResponse.redirect(new URL('/admin?tiktok=error', request.url)));
  }

  const tokenRes = await fetchWithTimeout(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  }, 10_000);

  const data = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || !data || data.error) {
    return clear(NextResponse.redirect(new URL(`/admin?tiktok=error&reason=${encodeURIComponent(data?.error_description || data?.error || String(tokenRes.status))}`, request.url)));
  }

  await storeInitialTiktokConnection(data, user!.id);

  return clear(NextResponse.redirect(new URL('/admin?tiktok=connected', request.url)));
}
