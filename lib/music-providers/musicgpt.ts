import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

const MUSICGPT_API_BASE = 'https://api.musicgpt.com/api/public/v1';

type GenderOption = 'male' | 'female' | 'duet';

export async function createMusicGPTPrediction(
  prompt: string,
  userId: string,
  gender?: GenderOption
): Promise<string> {
  const apiKey = process.env.MUSICGPT_API_KEY;
  if (!apiKey) throw new Error('MusicGPT non configuré (MUSICGPT_API_KEY manquant)');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const webhookSecret = process.env.MUSICGPT_WEBHOOK_SECRET;
  const webhookUrl = webhookSecret
    ? `${siteUrl}/api/webhooks/musicgpt?token=${webhookSecret}`
    : `${siteUrl}/api/webhooks/musicgpt`;

  const body: Record<string, any> = {
    music_style: prompt,
    webhook_url: webhookUrl,
  };
  // MusicGPT ne supporte pas nativement "duet" en tant que valeur gender —
  // dans ce cas on laisse le modèle libre (souvent il alterne naturellement).
  if (gender === 'male' || gender === 'female') {
    body.gender = gender;
  }

  const res = await fetchWithTimeout(`${MUSICGPT_API_BASE}/MusicAI`, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }, 15_000);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`MusicGPT error: ${err.message || res.statusText}`);
  }

  const data = await res.json();
  const taskId = data.task_id;
  if (!taskId) throw new Error('Pas de task_id retourné par MusicGPT');
  return `musicgpt_${taskId}`;
}

export type PredictionCheckResult =
  | { status: 'completed'; url: string }
  | { status: 'failed'; reason: string }
  | { status: 'processing' };

const FAILURE_STATUSES = ['FAILED', 'ERROR', 'CANCELLED', 'CANCELED'];

export async function checkMusicGPTPrediction(predictionId: string): Promise<PredictionCheckResult> {
  const taskId = predictionId.replace('musicgpt_', '');
  const apiKey = process.env.MUSICGPT_API_KEY!;

  const url = new URL(`${MUSICGPT_API_BASE}/byId`);
  url.searchParams.set('conversionType', 'MUSIC_AI');
  url.searchParams.set('task_id', taskId);

  // Une erreur réseau/HTTP ponctuelle côté API de statut (y compris un
  // timeout si MusicGPT traîne à répondre) n'est pas un échec avéré de la
  // génération elle-même — on la traite comme "toujours en cours" pour ne
  // pas déclencher un remboursement sur un simple hoquet réseau, et surtout
  // pour ne jamais laisser ce polling, appelé en boucle par chaque client en
  // attente, bloquer une fonction serverless indéfiniment.
  let res: Response;
  try {
    res = await fetchWithTimeout(url.toString(), { headers: { 'Authorization': apiKey } }, 8_000);
  } catch (err) {
    return { status: 'processing' };
  }
  if (!res.ok) return { status: 'processing' };

  const data = await res.json();
  const conversion = data.conversion;
  if (!conversion) return { status: 'processing' };

  const status = (conversion.status || '').toUpperCase();
  if (status === 'COMPLETED') {
    const audioUrl = conversion.conversion_path_1 || conversion.conversion_path_2 || null;
    if (audioUrl) return { status: 'completed', url: audioUrl };
    return { status: 'failed', reason: 'MusicGPT a marqué la génération terminée mais sans fichier audio' };
  }
  if (FAILURE_STATUSES.includes(status)) {
    return { status: 'failed', reason: `MusicGPT a signalé l'échec de la génération (statut : ${conversion.status})` };
  }
  return { status: 'processing' };
}
