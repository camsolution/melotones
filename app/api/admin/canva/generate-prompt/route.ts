import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { generateCanvaDesignPrompt } from '@/lib/canvaPromptGenerator';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { angle, occasion, style } = await request.json();
  const trimmedAngle = typeof angle === 'string' ? angle.trim().slice(0, 200) : '';
  if (!trimmedAngle) return NextResponse.json({ error: "Angle requis (ex: 'anniversaire', 'diaspora')." }, { status: 400 });

  const result = await generateCanvaDesignPrompt({
    angle: trimmedAngle,
    occasion: typeof occasion === 'string' ? occasion.trim().slice(0, 100) || null : null,
    style: typeof style === 'string' ? style.trim().slice(0, 100) || null : null,
  });
  if (!result) return NextResponse.json({ error: 'Génération indisponible pour le moment' }, { status: 503 });

  return NextResponse.json(result);
}
