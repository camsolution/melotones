// Les tarifs sont maintenant gérés en base (table pricing_packs) via /api/pricing.
// Ce type reste utilisé pour le typage côté client et serveur.
export type Pack = {
  id: string;
  credits: number;
  price_fcfa: number;
  label: string;
  active?: boolean;
  sort_order?: number;
};
