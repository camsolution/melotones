const MUSICGPT_API_BASE = 'https://api.musicgpt.com/api/public/v1';

export async function createMusicGPTPrediction(prompt: string, userId: string): Promise<string> {
  const apiKey = process.env.MUSICGPT_API_KEY;
  if (!apiKey) throw new Error('MusicGPT non configuré (MUSICGPT_API_KEY manquant)');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const res = await fetch(`${MUSICGPT_API_BASE}/MusicAI`, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      music_style: prompt,
      webhook_url: `${siteUrl}/api/webhooks/musicgpt`,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`MusicGPT error: ${err.message || res.statusText}`);
  }

  const data = await res.json();
  const taskId = data.task_id;
  if (!taskId) throw new Error('Pas de task_id retourné par MusicGPT');
  return `musicgpt_${taskId}`;
}

export async function checkMusicGPTPrediction(predictionId: string): Promise<string | null> {
  const taskId = predictionId.replace('musicgpt_', '');
  const apiKey = process.env.MUSICGPT_API_KEY!;

  const url = new URL(`${MUSICGPT_API_BASE}/byId`);
  url.searchParams.set('conversionType', 'MUSIC_AI');
  url.searchParams.set('task_id', taskId);

  const res = await fetch(url.toString(), {
    headers: { 'Authorization': apiKey },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const conversion = data.conversion;
  if (!conversion) return null;

  const status = (conversion.status || '').toUpperCase();
  if (status === 'COMPLETED') {
    return conversion.conversion_path_1 || conversion.conversion_path_2 || null;
  }
  return null;
}
