export type AnimationKind = 'confetti' | 'sparkle' | 'glow';

const OCCASION_ANIMATION: Record<string, AnimationKind> = {
  birthday: 'confetti',
  fun: 'confetti',
  graduation: 'confetti',
  wedding: 'sparkle',
  proposal: 'sparkle',
  dowry: 'sparkle',
  baptism: 'glow',
  tribute: 'glow',
  encouragement: 'glow',
  apology: 'glow',
};

export function getAnimationKind(occasion: string): AnimationKind {
  return OCCASION_ANIMATION[occasion] ?? 'sparkle';
}

export const GIF_FRAME_COUNT = 18;
export const GIF_FPS = 9;
export const GIF_SIZE = 640;
