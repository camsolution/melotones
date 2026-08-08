export async function createElevenMusicPrediction(prompt: string, userId: string): Promise<string> {
  const apiKey = process.env.ELEVEN_MUSIC_API_KEY;
  if (!apiKey) throw new Error('Eleven Music non configuré (ELEVEN_MUSIC_API_KEY manquant)');
  // TODO: Intégrer l'API Eleven Music réelle ici
  throw new Error('Eleven Music API pas encore intégrée – en attente de documentation');
}

export async function checkElevenMusicPrediction(predictionId: string): Promise<string | null> {
  // TODO: Implémenter la vérification du statut
  return null;
}
