import { checkSoniloPrediction } from './music-providers/sonilo';
import { createMusicGPTPrediction, checkMusicGPTPrediction } from './music-providers/musicgpt';

type Provider = 'musicgpt';
type GenderOption = 'male' | 'female' | 'duet';

interface GenerateParams {
  musicStyle: string;
  promptText: string;
  gender?: GenderOption;
}

interface PredictionResult {
  predictionId: string;
  provider: Provider;
}

const providers: Provider[] = ['musicgpt'];

export async function generateMusic(params: GenerateParams): Promise<PredictionResult> {
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const predictionId = await createPrediction(provider, params);
      return { predictionId, provider };
    } catch (err: any) {
      console.warn(`⚠️ ${provider} a échoué :`, err.message);
      errors.push(`${provider}: ${err.message}`);
      continue;
    }
  }
  throw new Error(errors.length > 0 ? errors.join(' | ') : 'Aucun fournisseur vocal configuré.');
}

async function createPrediction(provider: Provider, params: GenerateParams): Promise<string> {
  switch (provider) {
    case 'musicgpt':
      return createMusicGPTPrediction({
        musicStyle: params.musicStyle,
        promptText: params.promptText,
        gender: params.gender,
      });
    default:
      throw new Error('Provider inconnu');
  }
}

export async function checkPrediction(predictionId: string): Promise<string | null> {
  if (predictionId.startsWith('sonilo_')) return checkSoniloPrediction(predictionId);
  if (predictionId.startsWith('musicgpt_')) return checkMusicGPTPrediction(predictionId);
  return null;
}
