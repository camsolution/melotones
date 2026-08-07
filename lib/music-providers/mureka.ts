export async function createMurekaPrediction(prompt: string, userId: string) {
  const apiKey = process.env.MUREKA_API_KEY;
  if (!apiKey) throw new Error('Mureka non configuré (clé manquante)');
  const res = await fetch('https://api.mureka.ai/v1/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: prompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Mureka error: ${err.message || res.statusText}`);
  }
  const data = await res.json();
  return `mureka_${data.job_id || data.id}`;
}

export async function checkMurekaPrediction(predictionId: string): Promise<string | null> {
  const id = predictionId.replace('mureka_', '');
  const apiKey = process.env.MUREKA_API_KEY!;
  const res = await fetch(`https://api.mureka.ai/v1/jobs/${id}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status === 'SUCCESS' || data.status === 'completed') {
    return data.result?.audio_url || data.audio_url;
  }
  return null;
}
