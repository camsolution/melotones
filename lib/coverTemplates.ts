export type CoverTemplate = {
  id: string;
  name: { fr: string; en: string };
  occasions: string[];
  bg: [string, string]; // gradient stops
  angleDeg: number;
  photoShape: 'circle' | 'fullBleed' | 'diagonal';
  overlay: 'none' | 'bottomFade' | 'ring';
  textColor: string;
  accentColor: string;
};

export const coverTemplates: CoverTemplate[] = [
  {
    id: 'eclat',
    name: { fr: 'Éclat', en: 'Radiant' },
    occasions: ['birthday', 'fun', 'encouragement'],
    bg: ['#F23D82', '#FFB23E'],
    angleDeg: 135,
    photoShape: 'circle',
    overlay: 'ring',
    textColor: '#FFFFFF',
    accentColor: '#FFE7B3',
  },
  {
    id: 'elegance',
    name: { fr: 'Élégance', en: 'Elegance' },
    occasions: ['wedding', 'proposal', 'tribute'],
    bg: ['#150E29', '#3A1F57'],
    angleDeg: 160,
    photoShape: 'fullBleed',
    overlay: 'bottomFade',
    textColor: '#FFFFFF',
    accentColor: '#FFC96B',
  },
  {
    id: 'douceur',
    name: { fr: 'Douceur', en: 'Softness' },
    occasions: ['baptism', 'apology', 'dowry'],
    bg: ['#FFE3EC', '#FFEAC2'],
    angleDeg: 120,
    photoShape: 'circle',
    overlay: 'none',
    textColor: '#5B3A46',
    accentColor: '#C97A93',
  },
  {
    id: 'energie',
    name: { fr: 'Énergie', en: 'Energy' },
    occasions: ['graduation'],
    bg: ['#6C3CE0', '#F23D82'],
    angleDeg: 45,
    photoShape: 'diagonal',
    overlay: 'none',
    textColor: '#FFFFFF',
    accentColor: '#FFFFFF',
  },
  {
    id: 'minimal',
    name: { fr: 'Minimal', en: 'Minimal' },
    occasions: [],
    bg: ['#FAF6FF', '#F3ECFC'],
    angleDeg: 180,
    photoShape: 'circle',
    overlay: 'none',
    textColor: '#1B1330',
    accentColor: '#6C3CE0',
  },
];

export function suggestedTemplate(occasion: string): CoverTemplate {
  return (
    coverTemplates.find((t) => t.occasions.includes(occasion)) ??
    coverTemplates.find((t) => t.id === 'minimal')!
  );
}
