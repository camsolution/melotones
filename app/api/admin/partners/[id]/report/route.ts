import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { computePartnerReport, PartnerReport } from '@/lib/partnerReport';
import PDFDocument from 'pdfkit';

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function buildCsv(report: PartnerReport): string {
  const header = ['Email', 'Coupon', 'Pack', 'Chansons', 'Prix payé (FCFA)', 'Commission (FCFA)', 'Date'];
  const lines = [header.join(',')];
  for (const r of report.rows) {
    lines.push([
      csvEscape(r.email),
      csvEscape(r.couponCode),
      csvEscape(r.packId),
      String(r.credits),
      String(r.priceFcfa),
      String(r.commissionFcfa),
      new Date(r.createdAt).toLocaleString('fr-FR'),
    ].join(','));
  }
  lines.push('');
  lines.push(`Total,,,,${report.totalRevenueFcfa},${report.totalCommissionFcfa},`);
  lines.push(`Ventes: ${report.totalSales},,,,,,`);
  lines.push(`Taux de commission: ${report.commissionPercent}%,,,,,,`);
  return lines.join('\n');
}

async function buildPdf(report: PartnerReport): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.fillColor('#7c3aed').fontSize(20).text('Melotones', { continued: false });
  doc.fillColor('#150E29').fontSize(14).text(`Rapport partenaire — ${report.partnerName}`, { paragraphGap: 4 });
  doc.fillColor('#666666').fontSize(9).text(`Généré le ${new Date().toLocaleString('fr-FR')}`);
  doc.moveDown(1);

  doc.fillColor('#150E29').fontSize(10);
  const col = { email: 40, coupon: 190, pack: 260, credits: 320, price: 370, commission: 440, date: 500 };
  const rowY = () => doc.y;

  const drawHeaderRow = () => {
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Email', col.email, rowY(), { width: 145 });
    doc.text('Coupon', col.coupon, rowY(), { width: 65 });
    doc.text('Pack', col.pack, rowY(), { width: 55 });
    doc.text('Chansons', col.credits, rowY(), { width: 45 });
    doc.text('Prix FCFA', col.price, rowY(), { width: 65 });
    doc.text('Comm. FCFA', col.commission, rowY(), { width: 65 });
    doc.moveDown(0.6);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e4def2').stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(8.5);
  };

  drawHeaderRow();

  for (const r of report.rows) {
    if (doc.y > 760) {
      doc.addPage();
      drawHeaderRow();
    }
    const y = rowY();
    doc.text(r.email, col.email, y, { width: 145 });
    doc.text(r.couponCode, col.coupon, y, { width: 65 });
    doc.text(r.packId, col.pack, y, { width: 55 });
    doc.text(String(r.credits), col.credits, y, { width: 45 });
    doc.text(r.priceFcfa.toLocaleString('fr-FR'), col.price, y, { width: 65 });
    doc.text(r.commissionFcfa.toLocaleString('fr-FR'), col.commission, y, { width: 65 });
    doc.moveDown(0.7);
  }

  doc.moveDown(1);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#150E29').stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(11);
  doc.text(`Ventes : ${report.totalSales}`);
  doc.text(`Chiffre d'affaires total : ${report.totalRevenueFcfa.toLocaleString('fr-FR')} FCFA`);
  doc.fillColor('#7c3aed').text(`Commission due (${report.commissionPercent}%) : ${report.totalCommissionFcfa.toLocaleString('fr-FR')} FCFA`);

  doc.end();
  return done;
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { error, status } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const report = await computePartnerReport(params.id);
  if (!report) return NextResponse.json({ error: 'Partenaire introuvable' }, { status: 404 });

  const url = new URL(request.url);
  const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'csv';
  const baseName = report.partnerName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

  if (format === 'pdf') {
    const pdfBuffer = await buildPdf(report);
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rapport-${baseName}.pdf"`,
      },
    });
  }

  const csv = buildCsv(report);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rapport-${baseName}.csv"`,
    },
  });
}
