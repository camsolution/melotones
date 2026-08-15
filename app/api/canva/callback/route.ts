import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { storeInitialCanvaConnection } from '@/lib/canva';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

export const dynamic = 'force-dynamic';

const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';

// Callback public côté route Next.js (Canva y redirige le navigateur), mais
// requireAdmin() vérifie que la session encore active dans ce navigateur est
// bien celle d'un admin — défense en profondeur en plus du state PKCE.
export async function GET(request: Request) {
  const { error, status, user } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');

  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(cookieHeader.split(';').map(c => {
    const i = c.indexOf('=');
    return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
  }));
  const codeVerifier = cookies['canva_oauth_verifier'];
  const expectedState = cookies['canva_oauth_state'];

  const clear = (res: NextResponse) => {
    res.cookies.set('canva_oauth_verifier', '', { maxAge: 0, path: '/' });
    res.cookies.set('canva_oauth_state', '', { maxAge: 0, path: '/' });
    return res;
  };

  if (!code || !returnedState || !codeVerifier || !expectedState || returnedState !== expectedState) {
    return clear(NextResponse.redirect(new URL('/admin?canva=error', request.url)));
  }

  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;
  const redirectUri = process.env.CANVA_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return clear(NextResponse.redirect(new URL('/admin?canva=error', request.url)));
  }

  const tokenRes = await fetchWithTimeout(CANVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
      code_verifier: codeVerifier,
    }),
  }, 10_000);

  if (!tokenRes.ok) {
    return clear(NextResponse.redirect(new URL('/admin?canva=error', request.url)));
  }

  const data = await tokenRes.json();
  await storeInitialCanvaConnection(data, user!.id);

  return clear(NextResponse.redirect(new URL('/admin?canva=connected', request.url)));
}
