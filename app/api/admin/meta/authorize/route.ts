import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAdmin } from '@/lib/admin';
import { isMetaConfigured } from '@/lib/meta';

export const dynamic = 'force-dynamic';

// pages_show_list/pages_read_engagement/pages_manage_posts : gérer les Pages
// Facebook. instagram_basic/instagram_content_publish : publier sur le
// compte Instagram professionnel lié à une Page (Meta ne permet pas de
// connecter Instagram indépendamment d'une Page Facebook).
const SCOPES = 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management';

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  if (!isMetaConfigured()) {
    return NextResponse.json({ error: 'META_APP_ID/META_APP_SECRET manquants' }, { status: 500 });
  }
  const redirectUri = process.env.META_REDIRECT_URI;
  if (!redirectUri) {
    return NextResponse.json({ error: 'META_REDIRECT_URI manquant' }, { status: 500 });
  }

  const state = crypto.randomBytes(32).toString('base64url');

  const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  authUrl.searchParams.set('client_id', process.env.META_APP_ID!);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('response_type', 'code');

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set('meta_oauth_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/' });
  return res;
}
