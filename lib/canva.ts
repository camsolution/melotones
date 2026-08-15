import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { supabaseAdmin } from '@/lib/admin';

const CANVA_API_BASE = 'https://api.canva.com/rest/v1';
const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';
const PROVIDER = 'canva';

type CanvaTokenResponse = {
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

export function isCanvaConfigured(): boolean {
  return !!process.env.CANVA_CLIENT_ID && !!process.env.CANVA_CLIENT_SECRET;
}

export function isCanvaAIAvailable(): boolean {
  return isCanvaConfigured() && process.env.MELOTONES_CANVA_AI === 'true';
}

export function isStaticCoverEnabled(): boolean {
  return process.env.MELOTONES_CANVA_STATIC_COVER === 'true';
}

export function isAnimatedCoverEnabled(): boolean {
  return process.env.MELOTONES_CANVA_ANIMATED_COVER === 'true';
}

export function isVisualizerEnabled(): boolean {
  return process.env.MELOTONES_CANVA_VISUALIZER === 'true';
}

async function getConnectionRow(): Promise<OAuthConnectionRow | null> {
  const { data } = await supabaseAdmin
    .from('oauth_connections')
    .select('access_token, refresh_token, expires_at, scopes, connected_at, last_refreshed_at, last_error')
    .eq('provider', PROVIDER)
    .maybeSingle();
  return data ?? null;
}

// Canva fait tourner (rotate) son refresh_token à chaque utilisation — l'ancien
// devient immédiatement invalide. On persiste donc systématiquement le nouveau
// refresh_token reçu, jamais seulement l'access_token, sinon le prochain appel
// échoue avec "Refresh token used twice" (constaté en production le 2026-08-14).
async function persistTokens(data: CanvaTokenResponse, extra: Partial<OAuthConnectionRow & { connected_by: string }> = {}) {
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

async function refreshWithToken(refreshToken: string): Promise<CanvaTokenResponse | null> {
  const clientId = process.env.CANVA_CLIENT_ID!;
  const clientSecret = process.env.CANVA_CLIENT_SECRET!;
  const res = await fetchWithTimeout(CANVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  }, 10_000);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    await persistError(`refresh HTTP ${res.status}: ${body.slice(0, 300)}`);
    return null;
  }
  return res.json();
}

export async function getCanvaAccessToken(): Promise<string | null> {
  if (!isCanvaConfigured()) return null;

  const row = await getConnectionRow();
  if (!row?.refresh_token) return null; // jamais autorisé, ou déconnecté — voir /api/admin/canva/authorize

  if (row.access_token && row.expires_at && new Date(row.expires_at).getTime() > Date.now()) {
    return row.access_token;
  }

  const data = await refreshWithToken(row.refresh_token);
  if (!data) return null;
  await persistTokens(data);
  return data.access_token;
}

// État de connexion exposé au dashboard admin — ne renvoie jamais les tokens.
export async function getCanvaConnectionStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  expiresAt: string | null;
  lastRefreshedAt: string | null;
  connectedAt: string | null;
  scopes: string | null;
  lastError: string | null;
}> {
  const configured = isCanvaConfigured();
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

// Appelé uniquement par le callback OAuth (app/api/canva/callback/route.ts)
// juste après l'échange initial du code d'autorisation.
export async function storeInitialCanvaConnection(data: CanvaTokenResponse, connectedBy: string) {
  await persistTokens(data, { connected_at: new Date().toISOString(), connected_by: connectedBy });
}

export async function canvaApi(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getCanvaAccessToken();
  if (!token) throw new Error('Canva non connecté ou token indisponible');
  return fetchWithTimeout(`${CANVA_API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  }, 15_000);
}

// ------------------------------------------------------------
// Primitives Canva Connect API (endpoints officiels)
// ------------------------------------------------------------

export async function createCanvaDesign(payload: any): Promise<any | null> {
  const res = await canvaApi('/designs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error('Canva create design failed:', res.status, await res.text());
    return null;
  }
  return res.json();
}

export async function createCanvaExportJob(payload: any): Promise<any | null> {
  const res = await canvaApi('/exports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error('Canva create export failed:', res.status, await res.text());
    return null;
  }
  return res.json();
}

export async function createCanvaAutofillJob(payload: any): Promise<any | null> {
  const res = await canvaApi('/autofills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error('Canva autofill failed:', res.status, await res.text());
    return null;
  }
  return res.json();
}

export async function createCanvaAssetUploadJob(payload: any): Promise<any | null> {
  const res = await canvaApi('/asset-uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error('Canva asset upload failed:', res.status, await res.text());
    return null;
  }
  return res.json();
}

export async function getCanvaAutofillJob(jobId: string): Promise<any | null> {
  const res = await canvaApi(`/autofills/${jobId}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getCanvaExportJob(jobId: string): Promise<any | null> {
  const res = await canvaApi(`/exports/${jobId}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getCanvaAssetUploadJob(jobId: string): Promise<any | null> {
  const res = await canvaApi(`/asset-uploads/${jobId}`);
  if (!res.ok) return null;
  return res.json();
}

export type CanvaDesign = {
  id: string;
  title: string;
  thumbnail?: { url: string; width: number; height: number };
  urls: { edit_url: string; view_url: string };
  created_at: number; // unix seconds
  updated_at: number;
  page_count: number;
};

export type CanvaFolder = { id: string; name: string; created_at: number; updated_at: number };

// Il n'existe pas d'endpoint Canva pour lister toutes les racines — on part
// toujours d'un folder_id connu. Confirmé en direct le 2026-08-14 : les IDs de
// dossiers créés via Canva MCP (studio "MELOTONES — CREATIVE & MARKETING
// STUDIO") sont bien accessibles via la même Connect API REST.
export async function getCanvaFolder(folderId: string): Promise<CanvaFolder | null> {
  const res = await canvaApi(`/folders/${folderId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.folder ?? null;
}

export async function listCanvaFolderItems(
  folderId: string,
  itemTypes: ('folder' | 'design')[] = ['folder', 'design']
): Promise<{ folders: CanvaFolder[]; designs: CanvaDesign[] }> {
  const folders: CanvaFolder[] = [];
  const designs: CanvaDesign[] = [];
  let continuation: string | undefined;
  let pages = 0;

  do {
    const params = new URLSearchParams({ item_types: itemTypes.join(',') });
    if (continuation) params.set('continuation', continuation);
    const res = await canvaApi(`/folders/${folderId}/items?${params.toString()}`);
    if (!res.ok) break;
    const data = await res.json();
    for (const item of data.items || []) {
      if (item.type === 'folder' && item.folder) folders.push(item.folder);
      if (item.type === 'design' && item.design) designs.push(item.design);
    }
    continuation = data.continuation;
    pages += 1;
  } while (continuation && pages < 10); // filet de sécurité anti-boucle infinie

  return { folders, designs };
}

// Format vérifié en direct le 2026-08-14 : format doit être un objet
// { type: 'mp4', quality: ... } — quality est obligatoire (l'API rejette la
// requête sinon), valeurs valides : horizontal|vertical_480p/720p/1080p/4k.
// La réponse finale contient urls (tableau), pas url ni download_url.
export async function exportCanvaDesignAsVideo(designId: string, quality: 'vertical_1080p' | 'horizontal_1080p' = 'vertical_1080p'): Promise<string | null> {
  const job = await createCanvaExportJob({ design_id: designId, format: { type: 'mp4', quality } });
  if (!job?.job?.id) return null;

  let finalJob = job.job;
  for (let i = 0; i < 30 && finalJob.status === 'in_progress'; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    finalJob = await getCanvaExportJob(finalJob.id).then((j) => j?.job ?? finalJob);
  }
  if (finalJob.status !== 'success' || !finalJob.urls?.[0]) return null;
  return finalJob.urls[0];
}

// ------------------------------------------------------------
// Fonctions haut niveau (à ajuster selon les schémas exacts)
// ------------------------------------------------------------

/**
 * Crée une cover statique via Canva.
 * Nécessite un brand template ID et les données de la chanson.
 * Exemple de payload à adapter :
 * { brand_template_id, data: { occasion, style, message } }
 */
export async function createCanvaStaticCover(payload: any): Promise<{ url: string } | null> {
  if (!isCanvaConfigured() || !isStaticCoverEnabled()) return null;
  try {
    // 1. Lancer un autofill job si un template est fourni
    if (payload.brandTemplateId) {
      const job = await createCanvaAutofillJob({
        brand_template_id: payload.brandTemplateId,
        data: payload.data || {},
      });
      if (!job || !job.job_id) return null;

      // 2. Attendre la fin du job (simplifié ici)
      let autofillResult = null;
      for (let i = 0; i < 30; i++) {
        autofillResult = await getCanvaAutofillJob(job.job_id);
        if (autofillResult?.status === 'completed') break;
        if (autofillResult?.status === 'failed') return null;
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!autofillResult?.design_id) return null;

      // 3. Exporter le design en PNG
      const exportJob = await createCanvaExportJob({ design_id: autofillResult.design_id, format: 'png' });
      if (!exportJob?.job_id) return null;
      let exportResult = null;
      for (let i = 0; i < 30; i++) {
        exportResult = await getCanvaExportJob(exportJob.job_id);
        if (exportResult?.status === 'completed') break;
        if (exportResult?.status === 'failed') return null;
        await new Promise((r) => setTimeout(r, 1000));
      }
      const url = exportResult?.url || exportResult?.download_url;
      if (url) return { url };
    }
    return null;
  } catch (err) {
    console.error('Canva static cover error:', err);
    return null;
  }
}

export async function createCanvaAnimatedCover(payload: any): Promise<{ url: string } | null> {
  if (!isCanvaConfigured() || !isAnimatedCoverEnabled()) return null;
  // Similaire à static cover, mais avec format 'mp4' ou 'gif'
  return null;
}

export async function createCanvaVisualizer(payload: any): Promise<{ url: string } | null> {
  if (!isCanvaConfigured() || !isVisualizerEnabled()) return null;
  // Similaire avec un template visualizer et export mp4
  return null;
}
