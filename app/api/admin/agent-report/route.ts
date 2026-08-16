import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { computeAgentReport, buildAgentReportPdf } from '@/lib/agentReport';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const data = await computeAgentReport();
  const pdfBuffer = await buildAgentReportPdf(data);
  const dateStr = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="rapport-agents-melotones-${dateStr}.pdf"`,
    },
  });
}
