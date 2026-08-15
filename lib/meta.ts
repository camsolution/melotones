import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { supabaseAdmin } from '@/lib/admin';

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';
const PROVIDER = 'meta';

// Facebook + Instagram passent par la même app Meta / même flux OAuth — un
// compte Instagram professionnel est géré via la Page Facebook à laquelle il
// est lié (API Graph), pas via une authentification Instagram séparée.
type MetaTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type OAuthConnectionRow = {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  scopes: string | null;
  connected_at: string | null;
  last_refreshed_at: string | null;
  last_error: string | null;
};

export function isMetaConfigured(): boolean {
  return !!process.env.META_APP_ID && !!process.env.META_APP_SECRET;
}

async function getConnectionRow(): Promise<OAuthConnectionRow | null> {
  const { data } = await supabaseAdmin
    .from('oauth_connections')
    .select('access_token, refresh_token, expires_at, scopes, connected_at, last_refreshed_at, last_error')
    .eq('provider', PROVIDER)
    .maybeSingle();
  return data ?? null;
}

async function persistError(message: string) {
  await supabaseAdmin.from('oauth_connections').update({
    last_error: message,
    updated_at: new Date().toISOString(),
  }).eq('provider', PROVIDER);
}

// Meta n'a pas de refresh_token classique : on ré-échange le token longue
// durée (60 jours) contre un nouveau juste avant expiration (fb_exchange_token).
async function exchangeForLongLivedToken(shortLivedToken: string): Promise<MetaTokenResponse | null> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortLivedToken,
  });
  const res = await fetchWithTimeout(`${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`, {}, 10_000);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    await persistError(`exchange HTTP ${res.status}: ${data?.error?.message || 'réponse invalide'}`);
    return null;
  }
  return data;
}

export async function storeInitialMetaConnection(shortLivedToken: string, connectedBy: string, scopes: string): Promise<boolean> {
  const longLived = await exchangeForLongLivedToken(shortLivedToken);
  if (!longLived) return false;
  await supabaseAdmin.from('oauth_connections').upsert({
    provider: PROVIDER,
    access_token: longLived.access_token,
    refresh_token: longLived.access_token, // Meta : pas de refresh_token distinct, on réutilise le même mécanisme de ré-échange
    expires_at: new Date(Date.now() + (longLived.expires_in ?? 5_184_000) * 1000 - 3_600_000).toISOString(),
    scopes,
    connected_at: new Date().toISOString(),
    connected_by: connectedBy,
    last_refreshed_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'provider' });
  return true;
}

export async function getMetaAccessToken(): Promise<string | null> {
  if (!isMetaConfigured()) return null;
  const row = await getConnectionRow();
  if (!row?.access_token) return null;

  if (row.expires_at && new Date(row.expires_at).getTime() > Date.now()) {
    return row.access_token;
  }

  // Tentative de ré-échange même après expiration présumée — Meta tolère un
  // court délai de grâce dans certains cas ; si ça échoue, reconnexion requise.
  const refreshed = await exchangeForLongLivedToken(row.access_token);
  if (!refreshed) return null;
  await supabaseAdmin.from('oauth_connections').update({
    access_token: refreshed.access_token,
    refresh_token: refreshed.access_token,
    expires_at: new Date(Date.now() + (refreshed.expires_in ?? 5_184_000) * 1000 - 3_600_000).toISOString(),
    last_refreshed_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
  }).eq('provider', PROVIDER);
  return refreshed.access_token;
}

export async function getMetaConnectionStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  expiresAt: string | null;
  lastRefreshedAt: string | null;
  connectedAt: string | null;
  scopes: string | null;
  lastError: string | null;
}> {
  const configured = isMetaConfigured();
  const row = configured ? await getConnectionRow() : null;
  return {
    configured,
    connected: !!row?.access_token && !row.last_error,
    expiresAt: row?.expires_at ?? null,
    lastRefreshedAt: row?.last_refreshed_at ?? null,
    connectedAt: row?.connected_at ?? null,
    scopes: row?.scopes ?? null,
    lastError: row?.last_error ?? null,
  };
}

export async function metaApi(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getMetaAccessToken();
  if (!token) throw new Error('Meta non connecté ou token indisponible');
  const separator = path.includes('?') ? '&' : '?';
  return fetchWithTimeout(`${GRAPH_API_BASE}${path}${separator}access_token=${token}`, options, 15_000);
}

// Sert à vérifier concrètement qu'un token fonctionne (même logique que pour
// Canva/TikTok) et à lister les Pages gérées, prérequis pour toute
// publication Facebook/Instagram (l'Instagram Business doit être lié à une Page).
export async function getMetaPages(): Promise<any | null> {
  const res = await metaApi('/me/accounts');
  if (!res.ok) return null;
  return res.json();
}
