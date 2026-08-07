import { generateMusicWithReplicate } from './replicate';

// Mock pour test sans API
async function mockGenerateMusic(
  occasion: string,
  style: string,
  message: string
): Promise<{ audioUrl: string; duration: number }> {
  await new Promise((r) => setTimeout(r, 2500));
  return {
    audioUrl: '/audio/sample.mp3',
    duration: 10,
  };
}

// Génération réelle via Replicate
async function realGenerateMusic(
  occasion: string,
  style: string,
  message: string
): Promise<{ audioUrl: string; duration: number }> {
  const prompt = `A ${style} song for ${occasion}, about: ${message}`;
  const audioUrl = await generateMusicWithReplicate(prompt);
  return { audioUrl, duration: 20 };
}

// Sélection automatique
export async function generateMusic(
  occasion: string,
  style: string,
  message: string
): Promise<{ audioUrl: string; duration: number }> {
  if (process.env.REPLICATE_API_TOKEN && process.env.NEXT_PUBLIC_MOCK_AI !== 'true') {
    console.log('🎵 Using Replicate AI');
    return realGenerateMusic(occasion, style, message);
  }
  console.log('⚠️ Using mock AI');
  return mockGenerateMusic(occasion, style, message);
}
