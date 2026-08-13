// Sans timeout, un appel externe qui traîne (MusicGPT, PayDunya, Supabase
// PostgREST...) bloque la fonction serverless jusqu'à la limite de durée de
// Vercel, consommant un slot de concurrence pour rien — sous charge, ça peut
// dégrader la disponibilité de toute la plateforme, pas seulement de la
// requête concernée. AbortSignal.timeout() coupe court à un délai raisonnable
// pour que l'appelant puisse échouer vite et proprement au lieu d'attendre.
export function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
  return fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
}
