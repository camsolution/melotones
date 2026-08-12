import { supabaseAdmin } from '@/lib/admin';

export type PublicTestimonial = { id: string; rating: number; message: string };

// Uniquement les avis approuvés par un admin ET dont l'auteur a explicitement
// consenti à l'affichage public — jamais de témoignage inventé.
export async function fetchPublicTestimonials(): Promise<PublicTestimonial[]> {
  const { data, error } = await supabaseAdmin
    .from('testimonials')
    .select('id, rating, message')
    .eq('status', 'approved')
    .eq('consent_public', true)
    .order('created_at', { ascending: false })
    .limit(9);

  if (error || !data) return [];
  return data;
}
