const SUNO_API_BASE = 'https://studio-api.suno.ai/api'; // endpoint réel utilisé par l'app web

export async function createSunoPrediction(prompt: string, userId: string) {
  const sessionToken = process.env.SUNO_SESSION_TOKEN;
  if (!sessionToken) throw new Error('SUNO_SESSION_TOKEN manquant');

  // 1. Générer un identifiant unique
  const generateId = () => Math.random().toString(36).substring(2, 15);

  // 2. Lancer la génération (endpoint /generate)
  const res = await fetch(`${SUNO_API_BASE}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `__session=${sessionToken}`,
      'User-Agent': 'Mozilla/5.0',
    },
    body: JSON.stringify({
      prompt,
      make_instrumental: false,
      wait_audio: false, // on ne bloque pas, on va poller
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Suno error: ${err.detail || res.statusText}`);
  }
  const data = await res.json();
  // L'API renvoie un job_id ou id
  const jobId = data.id || data.job_id;
  if (!jobId) throw new Error('Pas de job ID retourné par Suno');
  return `suno_${jobId}`;
}

export async function checkSunoPrediction(predictionId: string): Promise<string | null> {
  const jobId = predictionId.replace('suno_', '');
  const sessionToken = process.env.SUNO_SESSION_TOKEN!;
  
  // Vérifier le statut de la tâche
  const res = await fetch(`${SUNO_API_BASE}/generate/status/${jobId}`, {
    headers: {
      'Cookie': `__session=${sessionToken}`,
      'User-Agent': 'Mozilla/5.0',
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  
  if (data.status === 'complete' || data.status === 'succeeded') {
    // L'URL audio peut être dans data.audio_url, data.output.audio_url, etc.
    return data.audio_url || data.output?.audio_url || data.clip?.audio_url;
  }
  return null;
}
