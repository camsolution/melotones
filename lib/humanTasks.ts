import { supabaseAdmin } from '@/lib/admin';

// Créée par un agent cron (source: 'agent:<slug>') quand il détecte quelque
// chose qui a besoin d'une décision humaine, plutôt que d'agir seul ou de
// se contenter d'un email ponctuel qu'on peut manquer — la tâche reste
// visible dans le dashboard admin jusqu'à ce qu'elle soit traitée.
// Évite les doublons : ne recrée pas une tâche 'pending' au même titre.
export async function createHumanTask(title: string, description: string, source: string) {
  const { data: existing } = await supabaseAdmin
    .from('human_tasks')
    .select('id')
    .eq('title', title)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing) return;

  await supabaseAdmin.from('human_tasks').insert({ title, description, source, status: 'pending' });
}

export async function getPendingTasks() {
  const { data } = await supabaseAdmin
    .from('human_tasks')
    .select('title, description, source, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  return data || [];
}
