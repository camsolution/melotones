const MUSICGPT_API_BASE = process.env.MUSICGPT_API_URL || 'https://api.musicgpt.com/v1';

export async function createMusicGPTPrediction(prompt: string, userId: string): Promise<string> {
  const apiKey = process.env.MUSICGPT_API_KEY;
  if (!apiKey) throw new Error('MusicGPT non configuré (MUSICGPT_API_KEY manquant)');

  const res = await fetch(`${MUSICGPT_API_BASE}/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, include_vocals: true }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`MusicGPT error: ${err.message || res.statusText}`);
  }
  const data = await res.json();
  const jobId = data.id || data.job_id;
  if (!jobId) throw new Error('Pas de job ID retourné par MusicGPT');
  return `musicgpt_${jobId}`;
}

export async function checkMusicGPTPrediction(predictionId: string): Promise<string | null> {
  const jobId = predictionId.replace('musicgpt_', '');
  const apiKey = process.env.MUSICGPT_API_KEY!;

  const res = await fetch(`${MUSICGPT_API_BASE}/status/${jobId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status === 'completed' || data.status === 'succeeded') {
    return data.audio_url || data.output?.audio_url || data.file_url;
  }
  return null;
}
