export async function createUdioPrediction(prompt: string, userId: string) {
  const apiKey = process.env.UDIO_API_KEY;
  if (!apiKey) throw new Error('Udio non configuré (clé manquante)');
  const res = await fetch('https://api.udio.com/v1/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, length: 20 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Udio error: ${err.message || res.statusText}`);
  }
  const data = await res.json();
  return `udio_${data.id || data.generation_id}`;
}

export async function checkUdioPrediction(predictionId: string): Promise<string | null> {
  const id = predictionId.replace('udio_', '');
  const apiKey = process.env.UDIO_API_KEY!;
  const res = await fetch(`https://api.udio.com/v1/predictions/${id}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status === 'done' || data.status === 'completed') {
    return data.file_url || data.audio_url || data.result?.file_url;
  }
  return null;
}
