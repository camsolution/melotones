import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { storeInitialMetaConnection } from '@/lib/meta';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

export const dynamic = 'force-dynamic';

const GRAPH_TOKEN_URL = 'https://graph.facebook.com/v21.0/oauth/access_token';
const SCOPES = 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_business_basic,instagram_business_content_publish,business_management';

export async function GET(request: Request) {
  const { error, status, user } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const metaError = url.searchParams.get('error');

  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(cookieHeader.split(';').map(c => {
    const i = c.indexOf('=');
    return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
  }));
  const expectedState = cookies['meta_oauth_state'];

  const clear = (res: NextResponse) => {
    res.cookies.set('meta_oauth_state', '', { maxAge: 0, path: '/' });
    return res;
  };

  if (metaError || !code || !returnedState || !expectedState || returnedState !== expectedState) {
    return clear(NextResponse.redirect(new URL(`/admin?meta=error${metaError ? `&reason=${encodeURIComponent(metaError)}` : ''}`, request.url)));
  }

  const clientId = process.env.META_APP_ID;
  const clientSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return clear(NextResponse.redirect(new URL('/admin?meta=error', request.url)));
  }

  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, client_secret: clientSecret, code });
  const tokenRes = await fetchWithTimeout(`${GRAPH_TOKEN_URL}?${params.toString()}`, {}, 10_000);
  const data = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || !data?.access_token) {
    return clear(NextResponse.redirect(new URL(`/admin?meta=error&reason=${encodeURIComponent(data?.error?.message || String(tokenRes.status))}`, request.url)));
  }

  const stored = await storeInitialMetaConnection(data.access_token, user!.id, SCOPES);
  return clear(NextResponse.redirect(new URL(`/admin?meta=${stored ? 'connected' : 'error'}`, request.url)));
}
