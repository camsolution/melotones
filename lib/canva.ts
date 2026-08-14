
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

const CANVA_API_BASE = 'https://api.canva.com/rest/v1';

type CanvaTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

let canvaAccessToken: string | null = null;
let canvaTokenExpiry = 0;

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

async function refreshAccessToken(): Promise<string | null> {
  if (!isCanvaConfigured()) return null;
  const clientId = process.env.CANVA_CLIENT_ID!;
  const clientSecret = process.env.CANVA_CLIENT_SECRET!;
  const refreshToken = process.env.CANVA_REFRESH_TOKEN;
  if (!refreshToken) return null;

  const res = await fetchWithTimeout(`${CANVA_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  }, 10_000);

  if (!res.ok) return null;
  const data: CanvaTokenResponse = await res.json();
  canvaAccessToken = data.access_token;
  canvaTokenExpiry = Date.now() + data.expires_in * 1000 - 60_000;
  return data.access_token;
}

export async function getCanvaAccessToken(): Promise<string | null> {
  if (canvaAccessToken && Date.now() < canvaTokenExpiry) return canvaAccessToken;
  return refreshAccessToken();
}

export async function canvaApi(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getCanvaAccessToken();
  if (!token) throw new Error('Canva non configuré ou token indisponible');
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
