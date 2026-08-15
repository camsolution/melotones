import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { storeInitialYoutubeConnection } from '@/lib/youtube';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

export const dynamic = 'force-dynamic';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function GET(request: Request) {
  const { error, status, user } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const googleError = url.searchParams.get('error');

  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(cookieHeader.split(';').map(c => {
    const i = c.indexOf('=');
    return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
  }));
  const expectedState = cookies['youtube_oauth_state'];

  const clear = (res: NextResponse) => {
    res.cookies.set('youtube_oauth_state', '', { maxAge: 0, path: '/' });
    return res;
  };

  if (googleError || !code || !returnedState || !expectedState || returnedState !== expectedState) {
    return clear(NextResponse.redirect(new URL(`/admin?youtube=error${googleError ? `&reason=${encodeURIComponent(googleError)}` : ''}`, request.url)));
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return clear(NextResponse.redirect(new URL('/admin?youtube=error', request.url)));
  }

  const tokenRes = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  }, 10_000);
  const data = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || !data?.access_token) {
    return clear(NextResponse.redirect(new URL(`/admin?youtube=error&reason=${encodeURIComponent(data?.error_description || data?.error || String(tokenRes.status))}`, request.url)));
  }

  await storeInitialYoutubeConnection(data, user!.id);
  return clear(NextResponse.redirect(new URL('/admin?youtube=connected', request.url)));
}
