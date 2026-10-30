import type ExcelJSNs from 'exceljs';
import type { MonthData, Settings } from '../types';
import { MONTHS_SHORT, round3 } from './dates';
import { sheetRows } from './sheet';

type ExcelJS = typeof ExcelJSNs;
type Border = Partial<ExcelJSNs.Borders>;

const FONT = 'Book Antiqua';
const BLUE = 'FF0000CC';
const SILVER = 'FFC0C0C0';
const YELLOW = 'FFFFFF00';
const GREY = 'FFD9D9D9';
const FIRST_ROW = 7;

/**
 * Builds the Job-D sheet with live Excel formulas:
 * utilization = G/total, TOTAL = SUM, customer rows = SUMIF minus leave SUMIFS, leave rows = SUMIF on category.
 * The category list (dropdown source) is written below the summary and hidden.
 */
export function buildWorkbook(Excel: ExcelJS, settings: Settings, ym: string, month: MonthData, only?: string[] | null) {
  const thin = { style: 'thin' as const };
  const med = { style: 'medium' as const };
  const box: Border = { top: thin, left: thin, bottom: thin, right: thin };
  const [y, mo] = ym.split('-').map(Number);
  const sheetName = `JobD-${MONTHS_SHORT[mo - 1]}-${y}`;

  const wb = new Excel.Workbook();
  wb.creator = 'Job-D Timesheet Builder';
  const ws = wb.addWorksheet(sheetName, {
    pageSetup: {
      paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });
  [5, 15.375, 72.375, 17.5, 14.875, 15.625, 10, 11.25].forEach((w, i) => (ws.getColumn(i + 1).width = w));

  const f = (size: number, bold = false, color?: string): Partial<ExcelJSNs.Font> =>
    ({ name: FONT, size, bold, ...(color ? { color: { argb: color } } : {}) });
  const fill = (c: string): ExcelJSNs.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });
  const esc = (s: string) => s.replace(/"/g, '""');

  // Title
  ws.mergeCells('A1:H1');
  const t1 = ws.getCell('A1');
  t1.value = {
    richText: [
      { text: settings.titleLeft || 'SILVERLAKE', font: { name: 'Cooper Black', size: 24, bold: true, color: { argb: 'FF808080' } } },
      { text: `                   ${settings.titleRight || 'TIME SHEET'}`, font: { name: 'Cooper Black', size: 24, bold: true } },
    ],
  };
  t1.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.getRow(1).height = 30.6;

  // Staff name / signature
  const b3 = ws.getCell('B3');
  b3.value = `Staff Name: ${settings.staffName || ''}`;
  b3.font = f(18, true);
  b3.border = { left: med, top: med, bottom: med };
  ws.getCell('C3').border = { top: med, bottom: med };
  ws.getCell('D3').border = { top: med, bottom: med, right: med };
  const e3 = ws.getCell('E3');
  e3.value = 'Sign & Date';
  e3.font = f(18);
  e3.alignment = { horizontal: 'right' };
  ['F3', 'G3', 'H3'].forEach((a) => (ws.getCell(a).border = { bottom: thin }));
  ws.getRow(3).height = 24;

  // Header rows 5–6
  const heads: [string, string, number][] = [
    ['B', 'Date', 14], ['C', 'Job Description', 16], ['D', 'IR/CR \nRef#', 14], ['E', 'Category', 14],
    ['F', 'Customer', 14], ['G', '#\n DAYS', 12], ['H', '% of \nUtilization', 14],
  ];
  heads.forEach(([col, text, size]) => {
    ws.mergeCells(`${col}5:${col}6`);
    const c = ws.getCell(`${col}5`);
    c.value = text; c.font = f(size, true); c.fill = fill(SILVER); c.border = box;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  ws.getRow(5).height = 24;
  ws.getRow(6).height = 24;

  // Layout
  const rows = sheetRows(settings, ym, month, only);
  const spare = Math.max(0, Math.floor(settings.spareRows) || 0);
  for (let s = 0; s < spare; s++) rows.push({ date: null });
  if (!rows.length) rows.push({ date: null });

  const last = FIRST_ROW + rows.length - 1;
  const tRow = last + 1;
  const sRow = tRow + 1;
  const { customers: custs, leaves, categories: cats } = settings;
  const custStart = sRow + 1;
  const custEnd = custStart + custs.length - 1;
  const leaveStart = custEnd + 1;
  const leaveEnd = leaveStart + leaves.length - 1;
  const catLabel = leaveEnd + 2;
  const catStart = catLabel + 1;
  const catEnd = catStart + cats.length - 1;

  const total = round3(rows.reduce((a, r) => a + (r.rec ? Number(r.rec.days) || 0 : 0), 0));
  const G = `$G$${FIRST_ROW}:$G$${last}`;
  const F = `$F$${FIRST_ROW}:$F$${last}`;
  const E = `$E$${FIRST_ROW}:$E$${last}`;

  rows.forEach((r, i) => {
    const n = FIRST_ROW + i;
    const row = ws.getRow(n);
    const rec = r.rec;
    const [cB, cC, cD, cE, cF, cG, cH] = [2, 3, 4, 5, 6, 7, 8].map((c) => row.getCell(c));

    if (r.date) {
      const [yy, mm, dd] = r.date.split('-').map(Number);
      cB.value = new Date(Date.UTC(yy, mm - 1, dd));
    }
    cB.numFmt = 'dd/mm/yyyy'; cB.font = f(12); cB.alignment = { horizontal: 'center', vertical: 'top', wrapText: true };

    const desc = rec ? rec.desc : r.holiday ?? '';
    const tag = /^(\[[^\]]+\])([\s\S]*)$/.exec(desc);
    if (tag) cC.value = { richText: [{ text: tag[1], font: f(14, true, BLUE) }, { text: tag[2], font: f(14) }] };
    else if (desc) cC.value = desc;
    cC.font = f(14); cC.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };

    if (rec?.ref) cD.value = rec.ref;
    cD.font = f(12); cD.alignment = { horizontal: 'center', vertical: 'top', wrapText: true };
    if (rec?.cat) cE.value = rec.cat;
    cE.font = f(12); cE.alignment = { horizontal: 'center', vertical: 'top', wrapText: true };
    if (rec?.cust) cF.value = rec.cust;
    cF.font = f(12, true, BLUE); cF.alignment = { horizontal: 'center', vertical: 'top', wrapText: true };

    const dv = rec && rec.days !== '' ? Number(rec.days) : null;
    if (dv !== null && !Number.isNaN(dv)) cG.value = dv;
    cG.numFmt = '0.0#'; cG.font = f(14); cG.alignment = { horizontal: 'center', vertical: 'top' };
    cH.value = { formula: `IF((G${n})>0,(G${n})/($G$${tRow}),"")`, result: dv && dv > 0 && total > 0 ? dv / total : '' } as ExcelJSNs.CellFormulaValue;
    cH.numFmt = '0.0%'; cH.font = f(14); cH.alignment = { horizontal: 'center', vertical: 'top' };

    [cB, cC, cD, cE, cF, cG, cH].forEach((c) => {
      c.border = box;
      if (!rec && r.holiday) c.fill = fill(GREY);
    });
    if (cats.length) cE.dataValidation = { type: 'list', allowBlank: true, formulae: [`$C$${catStart}:$C$${catEnd}`], showErrorMessage: true, errorTitle: 'Category', error: 'Pick a category from the list.' };
    if (custs.length) cF.dataValidation = { type: 'list', allowBlank: true, formulae: [`$C$${custStart}:$C$${custEnd}`], showErrorMessage: true, errorTitle: 'Customer', error: 'Pick a customer from the list.' };

    const lines = Math.max(1, Math.ceil(desc.length / 52), Math.ceil((rec?.ref ?? '').length / 15));
    row.height = lines > 1 ? lines * 18 : 18.75;
  });

  // TOTAL row
  const ft = ws.getCell(`F${tRow}`);
  ft.value = 'TOTAL'; ft.font = f(14, true); ft.fill = fill(SILVER); ft.alignment = { horizontal: 'center', vertical: 'middle' }; ft.border = box;
  const gt = ws.getCell(`G${tRow}`);
  gt.value = { formula: `SUM(G${FIRST_ROW}:G${last})`, result: total } as ExcelJSNs.CellFormulaValue;
  gt.numFmt = '0.0#'; gt.font = f(14); gt.alignment = { horizontal: 'center', vertical: 'middle' }; gt.border = box;
  const ht = ws.getCell(`H${tRow}`);
  ht.value = { formula: `IF((G${tRow})>0,(G${tRow})/($G$${tRow}),"")`, result: total > 0 ? 1 : '' } as ExcelJSNs.CellFormulaValue;
  ht.numFmt = '0%'; ht.font = f(14); ht.alignment = { horizontal: 'center', vertical: 'middle' }; ht.border = box;
  ws.getRow(tRow).height = 25.5;

  // SUMMARY band
  for (let col = 2; col <= 8; col++) ws.getRow(sRow).getCell(col).fill = fill(YELLOW);
  const label = (addr: string, text: string, align: 'left' | 'center' | 'right') => {
    const c = ws.getCell(addr);
    c.value = text; c.font = f(14, true); c.alignment = { horizontal: align };
  };
  label(`B${sRow}`, 'SUMMARY', 'center');
  label(`D${sRow}`, '#Days', 'right');
  label(`F${sRow}`, '%', 'center');

  const catRef = (cat: string) => {
    const i = cats.indexOf(cat);
    return i >= 0 ? `$C$${catStart + i}` : `"${esc(cat)}"`;
  };
  const sumBy = (pred: (r: NonNullable<(typeof rows)[number]['rec']>) => boolean) =>
    round3(rows.reduce((a, r) => a + (r.rec && pred(r.rec) ? Number(r.rec.days) || 0 : 0), 0));
  const leaveCats = leaves.map((l) => l.category).filter(Boolean);
  const pctCell = (n: number, val: number) => {
    const pc = ws.getCell(`F${n}`);
    pc.value = { formula: `IF($G$${tRow}>0,D${n}/$G$${tRow},0)`, result: total > 0 ? val / total : 0 } as ExcelJSNs.CellFormulaValue;
    pc.numFmt = '0.0%'; pc.font = f(14); pc.alignment = { horizontal: 'center' };
    ws.getRow(n).height = 27.6;
  };

  custs.forEach((name, i) => {
    const n = custStart + i;
    const c = ws.getCell(`C${n}`);
    c.value = name; c.font = f(14);
    let formula = `SUMIF(${F},$C$${n},${G})`;
    leaveCats.forEach((lc) => (formula += `-SUMIFS(${G},${F},$C$${n},${E},${catRef(lc)})`));
    const val = sumBy((r) => r.cust === name && !leaveCats.includes(r.cat));
    const d = ws.getCell(`D${n}`);
    d.value = { formula, result: val } as ExcelJSNs.CellFormulaValue; d.numFmt = '0.0#'; d.font = f(14);
    pctCell(n, val);
  });
  leaves.forEach((l, i) => {
    const n = leaveStart + i;
    const c = ws.getCell(`C${n}`);
    c.value = l.label || l.category; c.font = f(14);
    const val = sumBy((r) => r.cat === l.category);
    const d = ws.getCell(`D${n}`);
    d.value = { formula: `SUMIF(${E},${catRef(l.category)},${G})`, result: val } as ExcelJSNs.CellFormulaValue; d.numFmt = '0.0#'; d.font = f(14);
    pctCell(n, val);
  });

  // Category list feeding the Category dropdown — hidden, outside the print area.
  const cl = ws.getCell(`C${catLabel}`);
  cl.value = 'Category list (used by the Category dropdown)';
  cl.font = { name: FONT, size: 11, italic: true, color: { argb: 'FF808080' } };
  cats.forEach((c, i) => {
    const cc = ws.getCell(`C${catStart + i}`);
    cc.value = c; cc.font = f(14);
  });
  for (let r = leaveEnd + 1; r <= Math.max(catEnd, catLabel); r++) ws.getRow(r).hidden = true;

  ws.pageSetup.printArea = `B1:H${Math.max(leaveEnd, custEnd, sRow)}`;
  return { workbook: wb, sheetName, total, rows: rows.length };
}
