import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN!,
});

export async function generateMusicWithReplicate(
  prompt: string
): Promise<string> {
  // Utilise le modèle sans spécifier de version → prend la plus récente
  const output = await replicate.run("riffusion/riffusion", {
    input: {
      prompt_a: prompt,
      denoising: 0.75,
      seed_image_id: "vibes",
      num_inference_steps: 50,
    },
  });

  const audioUrl = (output as any).audio;
  if (!audioUrl) throw new Error("No audio in Riffusion output");
  return audioUrl;
}
