export async function createGoogleLyriaPrediction(prompt: string, userId: string): Promise<string> {
  const apiKey = process.env.GOOGLE_LYRIA_API_KEY;
  if (!apiKey) throw new Error('Google Lyria 3 Pro non configuré (GOOGLE_LYRIA_API_KEY manquant)');
  // TODO: Intégrer l'API Lyria réelle ici
  throw new Error('Google Lyria 3 Pro API pas encore intégrée – en attente de documentation');
}

export async function checkGoogleLyriaPrediction(predictionId: string): Promise<string | null> {
  // TODO: Implémenter la vérification du statut
  return null;
}
