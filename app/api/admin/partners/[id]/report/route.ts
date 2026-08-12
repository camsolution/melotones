import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { computePartnerReport, PartnerReport } from '@/lib/partnerReport';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// toLocaleString('fr-FR') sépare les milliers par une espace fine insécable
// (U+202F) — absente de la police Ubuntu embarquée, elle s'affiche en tofu.
// Espace normale à la place.
function fmtFcfa(n: number): string {
  return n.toLocaleString('fr-FR').replace(/[  ]/g, ' ');
}

// Les emails viennent de Supabase Auth, pas garantis inoffensifs (une adresse
// techniquement valide peut commencer par =, +, - ou @) — sans ce préfixe,
// Excel/Sheets peut interpréter la cellule comme une formule à l'ouverture
// du CSV (« injection de formule »). Un ' neutralise ça sans changer la valeur affichée.
function csvEscape(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
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

// pdfkit charge par défaut ses polices standard (Helvetica...) depuis des
// fichiers .afm de node_modules, absents du bundle serverless Vercel même
// avec outputFileTracingIncludes (non respecté par Turbopack, constaté en
// prod) — on enregistre nos propres polices TTF (fichiers du projet, donc
// tracées normalement) et on désactive l'init de police par défaut via
// `font: false`, qui saute l'appel this.font('Helvetica') dans pdfkit.
async function buildPdf(report: PartnerReport): Promise<Buffer> {
  const regularPath = path.join(process.cwd(), 'assets/fonts/Ubuntu-Regular.ttf');
  const boldPath = path.join(process.cwd(), 'assets/fonts/Ubuntu-Bold.ttf');
  const regularFont = fs.readFileSync(regularPath);
  const boldFont = fs.readFileSync(boldPath);

  const doc = new PDFDocument({ margin: 40, size: 'A4', font: false as any });
  doc.registerFont('Ubuntu', regularFont);
  doc.registerFont('Ubuntu-Bold', boldFont);
  doc.font('Ubuntu');

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.font('Ubuntu-Bold').fillColor('#7c3aed').fontSize(20).text('Melotones', { continued: false });
  doc.font('Ubuntu-Bold').fillColor('#150E29').fontSize(14).text(`Rapport partenaire — ${report.partnerName}`, { paragraphGap: 4 });
  doc.font('Ubuntu').fillColor('#666666').fontSize(9).text(`Généré le ${new Date().toLocaleString('fr-FR')}`);
  doc.moveDown(1);

  doc.fillColor('#150E29').fontSize(10);
  const col = { email: 40, coupon: 190, pack: 260, credits: 320, price: 370, commission: 440 };
  const widths = { email: 145, coupon: 65, pack: 55, credits: 45, price: 65, commission: 65 };
  const rowY = () => doc.y;

  const drawHeaderRow = () => {
    doc.font('Ubuntu-Bold').fontSize(9);
    doc.text('Email', col.email, rowY(), { width: widths.email });
    doc.text('Coupon', col.coupon, rowY(), { width: widths.coupon });
    doc.text('Pack', col.pack, rowY(), { width: widths.pack });
    doc.text('Chansons', col.credits, rowY(), { width: widths.credits });
    doc.text('Prix FCFA', col.price, rowY(), { width: widths.price });
    doc.text('Comm. FCFA', col.commission, rowY(), { width: widths.commission });
    doc.moveDown(0.6);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e4def2').stroke();
    doc.moveDown(0.3);
    doc.font('Ubuntu').fontSize(8.5);
  };

  drawHeaderRow();

  // Hauteur de ligne calculée sur le texte réellement le plus haut (l'email
  // peut passer sur plusieurs lignes) — une hauteur fixe faisait chevaucher
  // les lignes suivantes quand un email était long, constaté à l'aperçu.
  for (const r of report.rows) {
    const emailHeight = doc.heightOfString(r.email, { width: widths.email });
    const rowHeight = Math.max(emailHeight, doc.currentLineHeight()) + 6;

    if (doc.y + rowHeight > 780) {
      doc.addPage();
      drawHeaderRow();
    }
    const y = rowY();
    doc.text(r.email, col.email, y, { width: widths.email });
    doc.text(r.couponCode, col.coupon, y, { width: widths.coupon });
    doc.text(r.packId, col.pack, y, { width: widths.pack });
    doc.text(String(r.credits), col.credits, y, { width: widths.credits });
    doc.text(fmtFcfa(r.priceFcfa), col.price, y, { width: widths.price });
    doc.text(fmtFcfa(r.commissionFcfa), col.commission, y, { width: widths.commission });
    doc.y = y + rowHeight;
  }

  doc.moveDown(1);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#150E29').stroke();
  doc.moveDown(0.5);
  doc.font('Ubuntu-Bold').fontSize(11);
  doc.text(`Ventes : ${report.totalSales}`);
  doc.text(`Chiffre d'affaires total : ${fmtFcfa(report.totalRevenueFcfa)} FCFA`);
  doc.fillColor('#7c3aed').text(`Commission due (${report.commissionPercent}%) : ${fmtFcfa(report.totalCommissionFcfa)} FCFA`);

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
