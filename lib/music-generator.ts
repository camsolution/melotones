import { createSunoPrediction, checkSunoPrediction } from './music-providers/suno';
import { createUdioPrediction, checkUdioPrediction } from './music-providers/udio';
import { createMurekaPrediction, checkMurekaPrediction } from './music-providers/mureka';

type Provider = 'suno' | 'udio' | 'mureka';

interface PredictionResult {
  predictionId: string;
  provider: Provider;
}

// Ordre de priorité : Suno > Udio > Mureka
const providers: Provider[] = ['suno', 'udio', 'mureka'];

export async function generateMusic(prompt: string, userId: string): Promise<PredictionResult> {
  for (const provider of providers) {
    try {
      const predictionId = await createPrediction(provider, prompt, userId);
      return { predictionId, provider };
    } catch (err) {
      console.warn(`⚠️ ${provider} indisponible, basculement...`);
      continue;
    }
  }
  throw new Error('Aucun fournisseur vocal n’est configuré. Veuillez définir une clé API (SUNO_API_KEY, UDIO_API_KEY, MUREKA_API_KEY).');
}

async function createPrediction(provider: Provider, prompt: string, userId: string): Promise<string> {
  switch (provider) {
    case 'suno': return createSunoPrediction(prompt, userId);
    case 'udio': return createUdioPrediction(prompt, userId);
    case 'mureka': return createMurekaPrediction(prompt, userId);
    default: throw new Error('Provider inconnu');
  }
}

export async function checkPrediction(predictionId: string): Promise<string | null> {
  if (predictionId.startsWith('suno_')) return checkSunoPrediction(predictionId);
  if (predictionId.startsWith('udio_')) return checkUdioPrediction(predictionId);
  if (predictionId.startsWith('mureka_')) return checkMurekaPrediction(predictionId);
  return null;
}
