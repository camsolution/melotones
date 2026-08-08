import { checkSoniloPrediction } from './music-providers/sonilo';
import { createMusicGPTPrediction, checkMusicGPTPrediction } from './music-providers/musicgpt';

type Provider = 'musicgpt';

interface PredictionResult {
  predictionId: string;
  provider: Provider;
}

// Sonilo retiré : c'est une API vidéo-vers-musique (bandes-son synchronisées),
// pas adaptée à la génération de chansons vocales personnalisées.
// Conservé uniquement en lecture (checkPrediction) pour compatibilité
// avec d'anciennes générations déjà en base.
const providers: Provider[] = ['musicgpt'];

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
    'Aucun fournisseur vocal configuré. Veuillez définir MUSICGPT_API_KEY.'
  );
}

async function createPrediction(provider: Provider, prompt: string, userId: string): Promise<string> {
  switch (provider) {
    case 'musicgpt': return createMusicGPTPrediction(prompt, userId);
    default: throw new Error('Provider inconnu');
  }
}

export async function checkPrediction(predictionId: string): Promise<string | null> {
  if (predictionId.startsWith('sonilo_')) return checkSoniloPrediction(predictionId);
  if (predictionId.startsWith('musicgpt_')) return checkMusicGPTPrediction(predictionId);
  return null;
}
