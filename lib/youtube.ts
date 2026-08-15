import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { supabaseAdmin } from '@/lib/admin';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const PROVIDER = 'youtube';

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
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

export function isYoutubeConfigured(): boolean {
  return !!process.env.YOUTUBE_CLIENT_ID && !!process.env.YOUTUBE_CLIENT_SECRET;
}

async function getConnectionRow(): Promise<OAuthConnectionRow | null> {
  const { data } = await supabaseAdmin
    .from('oauth_connections')
    .select('access_token, refresh_token, expires_at, scopes, connected_at, last_refreshed_at, last_error')
    .eq('provider', PROVIDER)
    .maybeSingle();
  return data ?? null;
}

async function persistTokens(data: GoogleTokenResponse, extra: Partial<OAuthConnectionRow & { connected_by: string }> = {}) {
  const update: Record<string, any> = {
    provider: PROVIDER,
    access_token: data.access_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000 - 60_000).toISOString(),
    scopes: data.scope ?? null,
    last_refreshed_at: new Date().toISOString(),
    last_error: null,
    updated_at: new Date().toISOString(),
    ...extra,
  };
  // Google ne renvoie un refresh_token qu'au tout premier consentement
  // (access_type=offline + prompt=consent) — ne jamais écraser l'existant
  // avec undefined lors d'un simple rafraîchissement d'access_token.
  if (data.refresh_token) update.refresh_token = data.refresh_token;
  await supabaseAdmin.from('oauth_connections').upsert(update, { onConflict: 'provider' });
}

async function persistError(message: string) {
  await supabaseAdmin.from('oauth_connections').update({
    last_error: message,
    updated_at: new Date().toISOString(),
  }).eq('provider', PROVIDER);
}

async function refreshWithToken(refreshToken: string): Promise<GoogleTokenResponse | null> {
  const res = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  }, 10_000);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    await persistError(`refresh HTTP ${res.status}: ${data?.error_description || data?.error || 'réponse invalide'}`);
    return null;
  }
  return data;
}

export async function getYoutubeAccessToken(): Promise<string | null> {
  if (!isYoutubeConfigured()) return null;
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

export async function getYoutubeConnectionStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  expiresAt: string | null;
  lastRefreshedAt: string | null;
  connectedAt: string | null;
  scopes: string | null;
  lastError: string | null;
}> {
  const configured = isYoutubeConfigured();
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

export async function storeInitialYoutubeConnection(data: GoogleTokenResponse, connectedBy: string) {
  await persistTokens(data, { connected_at: new Date().toISOString(), connected_by: connectedBy });
}

export async function youtubeApi(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getYoutubeAccessToken();
  if (!token) throw new Error('YouTube non connecté ou token indisponible');
  return fetchWithTimeout(`${YOUTUBE_API_BASE}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
  }, 15_000);
}

// Vérifie concrètement qu'un token fonctionne (même logique que Canva/TikTok/Meta).
export async function getYoutubeChannelInfo(): Promise<any | null> {
  const res = await youtubeApi('/channels?part=snippet&mine=true');
  if (!res.ok) return null;
  return res.json();
}

const YOUTUBE_UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status';

// Protocole resumable upload de l'API YouTube : 1) POST d'initialisation avec
// les métadonnées, réponse contient un header Location (session d'upload) ;
// 2) PUT des octets de la vidéo sur cette URL de session.
// privacyStatus toujours "private" — jamais publiée automatiquement, un
// humain doit explicitement changer la visibilité depuis YouTube Studio
// (même principe que le dépôt en brouillon TikTok).
export async function uploadVideoToYoutube(
  videoBuffer: Buffer,
  metadata: { title: string; description: string }
): Promise<{ videoId: string; privacyStatus: string } | { error: string }> {
  const token = await getYoutubeAccessToken();
  if (!token) return { error: 'YouTube non connecté' };

  const initRes = await fetchWithTimeout(YOUTUBE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(videoBuffer.length),
      'X-Upload-Content-Type': 'video/mp4',
    },
    body: JSON.stringify({
      snippet: { title: metadata.title.slice(0, 100), description: metadata.description.slice(0, 5000) },
      status: { privacyStatus: 'private', selfDeclaredMadeForKids: false },
    }),
  }, 15_000);

  if (!initRes.ok) {
    const body = await initRes.text().catch(() => '');
    return { error: `Échec init YouTube: HTTP ${initRes.status} ${body.slice(0, 300)}` };
  }
  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) return { error: 'Pas de session d\'upload retournée par YouTube' };

  const uploadRes = await fetchWithTimeout(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(videoBuffer.length) },
    body: new Uint8Array(videoBuffer),
  }, 60_000);
  const uploadBody = await uploadRes.json().catch(() => null);
  if (!uploadRes.ok || !uploadBody?.id) {
    return { error: `Échec upload YouTube: HTTP ${uploadRes.status} ${JSON.stringify(uploadBody)?.slice(0, 300)}` };
  }

  return { videoId: uploadBody.id, privacyStatus: uploadBody.status?.privacyStatus || 'private' };
}
