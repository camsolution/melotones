import { NextResponse } from 'next/server';
import { requireAdmin, supabaseAdmin } from '@/lib/admin';
import { answerMission } from '@/lib/missionAgent';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_MISSION_LENGTH = 1000;

// Contrairement à POST /api/admin/human-tasks (dépôt silencieux), une mission
// déclenche une vraie réponse de l'agent : contexte réel du produit (voir
// lib/missionAgent.ts) envoyé à Gemini, réponse ajoutée à la description de
// la tâche et retournée immédiatement — l'admin pose une question, l'agent
// répond, sans exécuter d'action réelle lui-même.
export async function POST(request: Request) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { mission } = await request.json();
  const trimmedMission = typeof mission === 'string' ? mission.trim().slice(0, MAX_MISSION_LENGTH) : '';
  if (!trimmedMission) return NextResponse.json({ error: 'Mission requise.' }, { status: 400 });

  const title = trimmedMission.length > 120 ? `${trimmedMission.slice(0, 117)}...` : trimmedMission;

  const { data: task, error: insertError } = await supabaseAdmin
    .from('human_tasks')
    .insert({ title, description: trimmedMission, source: 'mission', status: 'pending' })
    .select()
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const response = await answerMission(trimmedMission);
  if (!response) {
    return NextResponse.json({ task, agentResponse: null, warning: "L'agent n'a pas pu répondre pour le moment — la mission reste déposée." });
  }

  const updatedDescription = `${trimmedMission}\n\n— Réponse de l'agent —\n${response}`;
  const { data: updatedTask } = await supabaseAdmin
    .from('human_tasks')
    .update({ description: updatedDescription })
    .eq('id', task.id)
    .select()
    .single();

  return NextResponse.json({ task: updatedTask ?? task, agentResponse: response });
}
