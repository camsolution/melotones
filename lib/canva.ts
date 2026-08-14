
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

// Fonctions spécifiques à Melotones (à implémenter avec les endpoints exacts)
export async function createCanvaStaticCover(payload: any): Promise<{ url: string } | null> {
  if (!isCanvaConfigured() || !isStaticCoverEnabled()) return null;
  // TODO: implémenter l'appel API Canva pour créer une cover statique
  return null;
}

export async function createCanvaAnimatedCover(payload: any): Promise<{ url: string } | null> {
  if (!isCanvaConfigured() || !isAnimatedCoverEnabled()) return null;
  return null;
}

export async function createCanvaVisualizer(payload: any): Promise<{ url: string } | null> {
  if (!isCanvaConfigured() || !isVisualizerEnabled()) return null;
  return null;
}
