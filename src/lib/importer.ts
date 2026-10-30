import type ExcelJSNs from 'exceljs';
import type { DayData } from '../types';
import { pad } from './dates';
import { rid } from './ids';
import type { Period } from './sheet';

type ExcelJS = typeof ExcelJSNs;

export interface ImportResult {
  /** First to last date found in the file (for labels; only the dates in `days` are replaced). */
  period: Period;
  /** The month with the most dates, to show after importing. */
  ym: string;
  /** Every date listed in the file, including empty rows and holiday notes. */
  days: Record<string, DayData>;
  staff: string | null;
  customers: string[];
  categories: string[];
  count: number;
}

function cellText(v: ExcelJSNs.CellValue): string | Date {
  if (v == null) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return cellText(v.result as ExcelJSNs.CellValue);
    if ('text' in v) return cellText((v as { text: ExcelJSNs.CellValue }).text);
    return '';
  }
  return String(v);
}
const textOf = (v: ExcelJSNs.CellValue): string => {
  const t = cellText(v);
  return t instanceof Date ? '' : t.trim();
};

function toDateKey(v: ExcelJSNs.CellValue): string | null {
  if (v instanceof Date) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'number' && v > 20000 && v < 80000) return toDateKey(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000));
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v ?? '').trim());
  return m ? `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}` : null;
}

interface Acc {
  days: Record<string, DayData>;
  staff: string | null;
  customers: string[];
  categories: string[];
}

/** Reads one Job-D worksheet (header row containing "Job Description", data until TOTAL/SUMMARY). Returns false if it isn't one. */
function readSheet(ws: ExcelJSNs.Worksheet, known: { customers: string[]; categories: string[] }, acc: Acc): boolean {
  const col = { date: 2, desc: 3, ref: 4, cat: 5, cust: 6, days: 7 };
  let hdr = 0;
  for (let r = 1; r <= Math.min(20, ws.rowCount) && !hdr; r++) {
    ws.getRow(r).eachCell((c) => {
      const t = textOf(c.value);
      if (/^staff name:/i.test(t) && !acc.staff) acc.staff = t.replace(/^staff name:\s*/i, '').trim() || null;
      if (t.toLowerCase().replace(/\s+/g, ' ') === 'job description') hdr = r;
    });
  }
  if (!hdr) return false;
  ws.getRow(hdr).eachCell((c, ci) => {
    const lo = textOf(c.value).toLowerCase().replace(/\s+/g, ' ');
    if (lo === 'date') col.date = ci;
    else if (lo === 'job description') col.desc = ci;
    else if (lo.startsWith('ir/cr')) col.ref = ci;
    else if (lo === 'category') col.cat = ci;
    else if (lo === 'customer') col.cust = ci;
    else if (/days/.test(lo)) col.days = ci;
  });

  // A date already read from an earlier worksheet is skipped, so overlapping sheets don't double entries.
  const earlier = new Set(Object.keys(acc.days));
  let cur: string | null = null;
  for (let r = hdr + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    let stop = false;
    row.eachCell((c) => {
      const t = textOf(c.value).toUpperCase();
      if (t === 'TOTAL' || t === 'SUMMARY') stop = true;
    });
    if (stop) break;
    const dk = toDateKey(row.getCell(col.date).value);
    if (dk) cur = dk;
    if (!cur || earlier.has(cur)) continue;
    const g = (k: keyof typeof col) => textOf(row.getCell(col[k]).value);
    const desc = g('desc'), ref = g('ref'), cat = g('cat'), cust = g('cust');
    const rawDays = cellText(row.getCell(col.days).value);
    const n = rawDays === '' || rawDays instanceof Date ? NaN : Number(rawDays);
    const daysVal: number | '' = Number.isNaN(n) ? '' : n;
    const day = (acc.days[cur] ??= { holiday: '', records: [] });
    if (!desc && !ref && !cat && !cust && daysVal === '') continue;
    if (desc && !ref && !cat && !cust && daysVal === '') {
      day.holiday = desc;
      continue;
    }
    day.records.push({ id: rid(), desc, ref, cat, cust, days: daysVal });
    if (cust && !known.customers.includes(cust) && !acc.customers.includes(cust)) acc.customers.push(cust);
    if (cat && !known.categories.includes(cat) && !acc.categories.includes(cat)) acc.categories.push(cat);
  }
  return true;
}

/** Reads every Job-D worksheet in the file, across as many months as it covers. */
export async function importTimesheet(Excel: ExcelJS, buf: ArrayBuffer, known: { customers: string[]; categories: string[] }): Promise<ImportResult> {
  const wb = new Excel.Workbook();
  await wb.xlsx.load(buf);
  if (!wb.worksheets.length) throw new Error('The file has no worksheets.');

  const acc: Acc = { days: {}, staff: null, customers: [], categories: [] };
  let found = 0;
  for (const ws of wb.worksheets) if (ws.state !== 'hidden' && ws.state !== 'veryHidden' && readSheet(ws, known, acc)) found++;
  if (!found) throw new Error('Couldn’t find the “Job Description” header row.');

  const keys = Object.keys(acc.days).sort();
  if (!keys.length) throw new Error('No dates found in the Date column.');
  const count = Object.values(acc.days).reduce((a, d) => a + d.records.length, 0);
  const perMonth: Record<string, number> = {};
  for (const k of keys) perMonth[k.slice(0, 7)] = (perMonth[k.slice(0, 7)] ?? 0) + 1;
  const ym = Object.keys(perMonth).sort((a, b) => perMonth[b] - perMonth[a])[0];
  return { period: { start: keys[0], end: keys[keys.length - 1] }, ym, days: acc.days, staff: acc.staff, customers: acc.customers, categories: acc.categories, count };
}
