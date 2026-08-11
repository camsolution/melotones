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
  let lastError: Error | null = null;
  for (const provider of providers) {
    try {
      const predictionId = await createPrediction(provider, prompt, userId, gender);
      return { predictionId, provider };
    } catch (err: any) {
      console.warn(`⚠️ ${provider} a échoué :`, err.message);
      lastError = err;
    }
  }
  throw lastError || new Error('Aucun fournisseur vocal configuré. Veuillez définir MUSICGPT_API_KEY.');
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
