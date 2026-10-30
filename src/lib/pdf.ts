import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { MonthData, Settings } from '../types';
import { fmtDays, fmtDMY, fmtPct } from './dates';
import { computeSheet } from './sheet';

/** PDF version of the Job-D sheet: same layout and numbers as the Excel export. */
export function buildPdf(settings: Settings, ym: string, month: MonthData, only?: string[] | null): jsPDF {
  const data = computeSheet(settings, ym, month, only);
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 32;

  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(128, 128, 128);
  doc.text(settings.titleLeft || 'SILVERLAKE', M, 44);
  doc.setTextColor(0, 0, 0);
  doc.text(settings.titleRight || 'TIME SHEET', W / 2 - 20, 44);
  doc.setFontSize(12);
  doc.setLineWidth(1.2);
  doc.rect(M, 58, 300, 22);
  doc.text(`Staff Name: ${settings.staffName || ''}`, M + 6, 73);
  doc.setFont('times', 'normal');
  doc.text('Sign & Date', 360, 73);
  doc.setLineWidth(0.5);
  doc.line(428, 76, W - M, 76);

  const holidayRows = new Set<number>();
  const body: string[][] = data.rows.map((r, i) => {
    const rec = r.rec;
    const d = rec ? Number(rec.days) || 0 : 0;
    if (!rec && r.holiday) holidayRows.add(i);
    return [
      r.date ? fmtDMY(r.date) : '',
      rec ? rec.desc : r.holiday ?? '',
      rec?.ref ?? '',
      rec?.cat ?? '',
      rec?.cust ?? '',
      rec && rec.days !== '' ? fmtDays(rec.days) : '',
      d > 0 && data.total > 0 ? fmtPct(d, data.total) : '',
    ];
  });
  body.push(['', '', '', '', 'TOTAL', fmtDays(data.total), data.total > 0 ? '100%' : '']);
  const lastIdx = body.length - 1;

  autoTable(doc, {
    startY: 92,
    margin: { left: M, right: M },
    head: [['Date', 'Job Description', 'IR/CR Ref#', 'Category', 'Customer', '# Days', '% of Utilization']],
    body,
    theme: 'grid',
    styles: { font: 'times', fontSize: 8.5, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.4, textColor: [0, 0, 0], valign: 'top', overflow: 'linebreak' },
    headStyles: { fillColor: [192, 192, 192], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 54, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 66, halign: 'center' },
      3: { cellWidth: 52, halign: 'center' },
      4: { cellWidth: 56, halign: 'center', fontStyle: 'bold', textColor: [0, 0, 204] },
      5: { cellWidth: 36, halign: 'center' },
      6: { cellWidth: 52, halign: 'center' },
    },
    didParseCell: (h) => {
      if (h.section !== 'body') return;
      if (holidayRows.has(h.row.index)) h.cell.styles.fillColor = [217, 217, 217];
      if (h.row.index === lastIdx) {
        if (h.column.index < 4) { h.cell.styles.lineWidth = 0; h.cell.text = ['']; }
        if (h.column.index === 4) { h.cell.styles.fillColor = [192, 192, 192]; h.cell.styles.textColor = [0, 0, 0]; }
        h.cell.styles.fontStyle = 'bold';
      }
    },
  });

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  if (y + 22 + data.summary.length * 16 > H - 30) {
    doc.addPage();
    y = 40;
  }
  doc.setFillColor(255, 255, 0);
  doc.rect(M, y, W - 2 * M, 18, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text('SUMMARY', M + 8, y + 13);
  doc.text('#Days', 330, y + 13, { align: 'right' });
  doc.text('%', 420, y + 13, { align: 'right' });
  doc.setFont('times', 'normal');
  y += 34;
  data.summary.forEach((s) => {
    doc.text(s.name, 110, y);
    doc.text(fmtDays(s.days), 330, y, { align: 'right' });
    doc.text(fmtPct(s.days, data.total), 420, y, { align: 'right' });
    y += 16;
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 16, { align: 'right' });
  }
  return doc;
}
