export type Pack = {
  id: string;
  credits: number;
  priceFcfa: number;
  label: string;
};

export const PACKS: Pack[] = [
  { id: 'decouverte', credits: 2, priceFcfa: 2800, label: 'Découverte' },
  { id: 'populaire', credits: 8, priceFcfa: 3800, label: 'Populaire' },
  { id: 'createur', credits: 20, priceFcfa: 9800, label: 'Créateur' },
];
