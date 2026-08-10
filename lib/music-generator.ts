import { checkSoniloPrediction } from './music-providers/sonilo';
import { createMusicGPTPrediction, checkMusicGPTPrediction } from './music-providers/musicgpt';

type Provider = 'musicgpt';
type GenderOption = 'male' | 'female' | 'duet';

interface PredictionResult {
  predictionId: string;
  provider: Provider;
}

const providers: Provider[] = ['musicgpt'];

export async function generateMusic(prompt: string, userId: string, gender?: GenderOption): Promise<PredictionResult> {
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const predictionId = await createPrediction(provider, prompt, userId, gender);
      return { predictionId, provider };
    } catch (err: any) {
      console.warn(`⚠️ ${provider} a échoué :`, err.message);
      errors.push(`${provider}: ${err.message}`);
      continue;
    }
  }
  // On remonte la VRAIE raison de l'échec au lieu d'un message générique trompeur
  throw new Error(errors.length > 0 ? errors.join(' | ') : 'Aucun fournisseur vocal configuré.');
}

async function createPrediction(provider: Provider, prompt: string, userId: string, gender?: GenderOption): Promise<string> {
  switch (provider) {
    case 'musicgpt': return createMusicGPTPrediction(prompt, userId, gender);
    default: throw new Error('Provider inconnu');
  }
}

export async function checkPrediction(predictionId: string): Promise<string | null> {
  if (predictionId.startsWith('sonilo_')) return checkSoniloPrediction(predictionId);
  if (predictionId.startsWith('musicgpt_')) return checkMusicGPTPrediction(predictionId);
  return null;
}
