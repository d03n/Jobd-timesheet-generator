import type ExcelJSNs from 'exceljs';
import type { DayData } from '../types';
import { pad } from './dates';
import { rid } from './ids';

type ExcelJS = typeof ExcelJSNs;

export interface ImportResult {
  ym: string;
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

/** Reads an existing Job-D sheet (header row containing "Job Description", data until TOTAL/SUMMARY). */
export async function importTimesheet(Excel: ExcelJS, buf: ArrayBuffer, known: { customers: string[]; categories: string[] }): Promise<ImportResult> {
  const wb = new Excel.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('The file has no worksheets.');

  const col = { date: 2, desc: 3, ref: 4, cat: 5, cust: 6, days: 7 };
  let hdr = 0;
  let staff: string | null = null;
  for (let r = 1; r <= Math.min(20, ws.rowCount) && !hdr; r++) {
    ws.getRow(r).eachCell((c) => {
      const t = textOf(c.value);
      if (/^staff name:/i.test(t)) staff = t.replace(/^staff name:\s*/i, '').trim();
      if (t.toLowerCase().replace(/\s+/g, ' ') === 'job description') hdr = r;
    });
  }
  if (!hdr) throw new Error('Couldn’t find the “Job Description” header row.');
  ws.getRow(hdr).eachCell((c, ci) => {
    const lo = textOf(c.value).toLowerCase().replace(/\s+/g, ' ');
    if (lo === 'date') col.date = ci;
    else if (lo === 'job description') col.desc = ci;
    else if (lo.startsWith('ir/cr')) col.ref = ci;
    else if (lo === 'category') col.cat = ci;
    else if (lo === 'customer') col.cust = ci;
    else if (/days/.test(lo)) col.days = ci;
  });

  const days: Record<string, DayData> = {};
  const counts: Record<string, number> = {};
  const customers: string[] = [];
  const categories: string[] = [];
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
    if (dk) {
      cur = dk;
      counts[dk.slice(0, 7)] = (counts[dk.slice(0, 7)] ?? 0) + 1;
    }
    if (!cur) continue;
    const g = (k: keyof typeof col) => textOf(row.getCell(col[k]).value);
    const desc = g('desc'), ref = g('ref'), cat = g('cat'), cust = g('cust');
    const rawDays = cellText(row.getCell(col.days).value);
    const n = rawDays === '' || rawDays instanceof Date ? NaN : Number(rawDays);
    const daysVal: number | '' = Number.isNaN(n) ? '' : n;
    const day = (days[cur] ??= { holiday: '', records: [] });
    if (!desc && !ref && !cat && !cust && daysVal === '') continue;
    if (desc && !ref && !cat && !cust && daysVal === '') {
      day.holiday = desc;
      continue;
    }
    day.records.push({ id: rid(), desc, ref, cat, cust, days: daysVal });
    if (cust && !known.customers.includes(cust) && !customers.includes(cust)) customers.push(cust);
    if (cat && !known.categories.includes(cat) && !categories.includes(cat)) categories.push(cat);
  }

  const ym = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  if (!ym) throw new Error('No dates found in the Date column.');
  const monthDays: Record<string, DayData> = {};
  let count = 0;
  for (const [k, v] of Object.entries(days)) {
    if (k.startsWith(ym)) {
      monthDays[k] = v;
      count += v.records.length;
    }
  }
  return { ym, days: monthDays, staff, customers, categories, count };
}
