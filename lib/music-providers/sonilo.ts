const SONILO_API_BASE = 'https://api.sonilo.com/v1';

export async function createSoniloPrediction(prompt: string, userId: string): Promise<string> {
  const apiKey = process.env.SONILO_API_KEY;
  if (!apiKey) throw new Error('Sonilo non configuré (SONILO_API_KEY manquant)');

  const res = await fetch(`${SONILO_API_BASE}/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      duration: 30, // secondes
      make_instrumental: false, // avec voix
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Sonilo error: ${err.message || res.statusText}`);
  }
  const data = await res.json();
  const taskId = data.task_id || data.id;
  if (!taskId) throw new Error('Pas de task ID retourné par Sonilo');
  return `sonilo_${taskId}`;
}

export async function checkSoniloPrediction(predictionId: string): Promise<string | null> {
  const taskId = predictionId.replace('sonilo_', '');
  const apiKey = process.env.SONILO_API_KEY!;

  const res = await fetch(`${SONILO_API_BASE}/generate/${taskId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status === 'completed' || data.status === 'succeeded') {
    return data.audio_url || data.output?.audio_url || data.result?.audio_url;
  }
  return null;
}
