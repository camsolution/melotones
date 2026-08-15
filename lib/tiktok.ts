import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { supabaseAdmin } from '@/lib/admin';

const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';
const PROVIDER = 'tiktok';

// Endpoints/paramètres conformes à la doc TikTok for Developers (Login Kit
// OAuth v2 + Content Posting API) au moment de l'écriture — à reconfirmer
// empiriquement au premier essai réel, comme fait pour Canva (voir
// lib/canva.ts : un paramètre mal aligné avec la doc a bloqué la connexion
// une première fois malgré un code a priori correct).
type TiktokTokenResponse = {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_expires_in: number;
  refresh_token: string;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
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

export function isTiktokConfigured(): boolean {
  return !!process.env.TIKTOK_CLIENT_KEY && !!process.env.TIKTOK_CLIENT_SECRET;
}

async function getConnectionRow(): Promise<OAuthConnectionRow | null> {
  const { data } = await supabaseAdmin
    .from('oauth_connections')
    .select('access_token, refresh_token, expires_at, scopes, connected_at, last_refreshed_at, last_error')
    .eq('provider', PROVIDER)
    .maybeSingle();
  return data ?? null;
}

async function persistTokens(data: TiktokTokenResponse, extra: Partial<OAuthConnectionRow & { connected_by: string }> = {}) {
  await supabaseAdmin.from('oauth_connections').upsert({
    provider: PROVIDER,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000 - 60_000).toISOString(),
    scopes: data.scope ?? null,
    last_refreshed_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
    ...extra,
  }, { onConflict: 'provider' });
}

async function persistError(message: string) {
  await supabaseAdmin.from('oauth_connections').update({
    last_error: message,
    updated_at: new Date().toISOString(),
  }).eq('provider', PROVIDER);
}

async function refreshWithToken(refreshToken: string): Promise<TiktokTokenResponse | null> {
  const res = await fetchWithTimeout(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  }, 10_000);

  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) {
    await persistError(`refresh HTTP ${res.status}: ${data?.error_description || data?.error || 'réponse invalide'}`);
    return null;
  }
  return data;
}

export async function getTiktokAccessToken(): Promise<string | null> {
  if (!isTiktokConfigured()) return null;

  const row = await getConnectionRow();
  if (!row?.refresh_token) return null;

  if (row.access_token && row.expires_at && new Date(row.expires_at).getTime() > Date.now()) {
    return row.access_token;
  }

  const data = await refreshWithToken(row.refresh_token);
  if (!data) return null;
  await persistTokens(data);
  return data.access_token;
}

export async function getTiktokConnectionStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  expiresAt: string | null;
  lastRefreshedAt: string | null;
  connectedAt: string | null;
  scopes: string | null;
  lastError: string | null;
}> {
  const configured = isTiktokConfigured();
  const row = configured ? await getConnectionRow() : null;
  return {
    configured,
    connected: !!row?.refresh_token && !row.last_error,
    expiresAt: row?.expires_at ?? null,
    lastRefreshedAt: row?.last_refreshed_at ?? null,
    connectedAt: row?.connected_at ?? null,
    scopes: row?.scopes ?? null,
    lastError: row?.last_error ?? null,
  };
}

export async function storeInitialTiktokConnection(data: TiktokTokenResponse, connectedBy: string) {
  await persistTokens(data, { connected_at: new Date().toISOString(), connected_by: connectedBy });
}

export async function tiktokApi(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getTiktokAccessToken();
  if (!token) throw new Error('TikTok non connecté ou token indisponible');
  return fetchWithTimeout(`${TIKTOK_API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  }, 15_000);
}

// Profil de base — sert surtout à vérifier concrètement qu'un token fonctionne
// (même logique que le GET /v1/users/me utilisé pour valider Canva).
export async function getTiktokUserInfo(): Promise<any | null> {
  const res = await tiktokApi('/user/info/?fields=open_id,display_name,avatar_url');
  if (!res.ok) return null;
  return res.json();
}

// Dépôt en brouillon (inbox TikTok) — vérifié en direct le 2026-08-14 :
// init (source FILE_UPLOAD) → PUT des octets avec Content-Range → statut final
// "SEND_TO_USER_INBOX". Nécessite le scope video.upload (pas video.publish :
// aucune publication directe/automatique n'est effectuée, un humain doit
// ouvrir l'app TikTok pour finaliser et publier — conforme à l'exigence
// d'approbation humaine avant toute publication réelle).
export async function uploadVideoDraftToTiktok(videoBuffer: Buffer): Promise<{ publishId: string; status: string } | { error: string }> {
  const token = await getTiktokAccessToken();
  if (!token) return { error: 'TikTok non connecté' };

  const initRes = await fetchWithTimeout('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      source_info: { source: 'FILE_UPLOAD', video_size: videoBuffer.length, chunk_size: videoBuffer.length, total_chunk_count: 1 },
    }),
  }, 15_000);
  const initBody = await initRes.json().catch(() => null);
  if (!initRes.ok || !initBody?.data?.upload_url) {
    return { error: `Échec init TikTok: ${initBody?.error?.message || initRes.status}` };
  }

  const uploadRes = await fetchWithTimeout(initBody.data.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Range': `bytes 0-${videoBuffer.length - 1}/${videoBuffer.length}` },
    body: new Uint8Array(videoBuffer),
  }, 30_000);
  if (!uploadRes.ok) {
    return { error: `Échec upload TikTok: HTTP ${uploadRes.status}` };
  }

  // Le traitement TikTok n'est pas instantané — quelques secondes suffisent
  // généralement pour une courte vidéo marketing (constaté en test réel).
  await new Promise((r) => setTimeout(r, 3_000));
  const statusRes = await fetchWithTimeout('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ publish_id: initBody.data.publish_id }),
  }, 15_000);
  const statusBody = await statusRes.json().catch(() => null);

  return { publishId: initBody.data.publish_id, status: statusBody?.data?.status || 'UNKNOWN' };
}
