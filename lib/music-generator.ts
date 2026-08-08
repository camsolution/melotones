import { createElevenMusicPrediction, checkElevenMusicPrediction } from './music-providers/eleven-music';
import { createGoogleLyriaPrediction, checkGoogleLyriaPrediction } from './music-providers/google-lyria';

type Provider = 'eleven-music' | 'google-lyria';

interface PredictionResult {
  predictionId: string;
  provider: Provider;
}

const providers: Provider[] = ['eleven-music', 'google-lyria'];

export async function generateMusic(prompt: string, userId: string): Promise<PredictionResult> {
  for (const provider of providers) {
    try {
      const predictionId = await createPrediction(provider, prompt, userId);
      return { predictionId, provider };
    } catch (err: any) {
      console.warn(`⚠️ ${provider} a échoué :`, err.message);
      continue;
    }
  }
  throw new Error(
    'Aucun fournisseur vocal configuré. Veuillez définir ELEVEN_MUSIC_API_KEY ou GOOGLE_LYRIA_API_KEY.'
  );
}

async function createPrediction(provider: Provider, prompt: string, userId: string): Promise<string> {
  switch (provider) {
    case 'eleven-music': return createElevenMusicPrediction(prompt, userId);
    case 'google-lyria': return createGoogleLyriaPrediction(prompt, userId);
    default: throw new Error('Provider inconnu');
  }
}

export async function checkPrediction(predictionId: string): Promise<string | null> {
  if (predictionId.startsWith('eleven_')) return checkElevenMusicPrediction(predictionId);
  if (predictionId.startsWith('lyria_')) return checkGoogleLyriaPrediction(predictionId);
  return null;
}
