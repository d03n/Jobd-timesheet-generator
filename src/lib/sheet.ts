import type { EntryRecord, MonthData, Months, Settings, SheetData, SheetRow } from '../types';
import { daysIn, isWeekend, monthKeys, monthLabel, MONTHS_SHORT, pad, parseKey, round3 } from './dates';
import { holidayName } from './holidays';

/** An inclusive date range, e.g. a cut-off period 2026-10-21 … 2026-11-20. */
export interface Period {
  start: string;
  end: string;
}

/** What a sheet covers: a calendar month ("2026-10") or a date range. */
export type Scope = string | Period;

export type ExportLayout = 'combined' | 'per-month';

const isoUTC = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const utc = (k: string) => {
  const p = parseKey(k);
  return new Date(Date.UTC(p.y, p.m - 1, p.d));
};

export const monthPeriod = (ym: string): Period => ({ start: `${ym}-01`, end: `${ym}-${pad(daysIn(ym))}` });

/** Every date in the period, in order. */
export function periodKeys(p: Period): string[] {
  const out: string[] = [];
  for (let d = utc(p.start), end = utc(p.end); d <= end; d.setUTCDate(d.getUTCDate() + 1)) out.push(isoUTC(d));
  return out;
}

export const periodLength = (p: Period): number => Math.round((utc(p.end).getTime() - utc(p.start).getTime()) / 86400000) + 1;

/** Months the period touches, e.g. ["2026-10", "2026-11"]. */
export function periodMonths(p: Period): string[] {
  const out: string[] = [];
  let [y, m] = p.start.split('-').map(Number);
  const last = p.end.slice(0, 7);
  for (let ym = `${y}-${pad(m)}`; ym <= last; ym = `${y}-${pad(m)}`) {
    out.push(ym);
    if (++m > 12) (m = 1), y++;
  }
  return out;
}

/** Cuts a period at month boundaries: 21 Oct – 20 Nov → [21–31 Oct, 1–20 Nov]. */
export const splitByMonth = (p: Period): Period[] =>
  periodMonths(p).map((ym) => {
    const mp = monthPeriod(ym);
    return { start: mp.start > p.start ? mp.start : p.start, end: mp.end < p.end ? mp.end : p.end };
  });

/** The month if the period is exactly one whole calendar month, else null. */
export function wholeMonth(p: Period): string | null {
  const ym = p.start.slice(0, 7);
  const mp = monthPeriod(ym);
  return mp.start === p.start && mp.end === p.end ? ym : null;
}

export const inPeriod = (k: string, p: Period): boolean => k >= p.start && k <= p.end;

/** The stored days that fall inside the period, gathered from every month it touches. */
export function mergeMonths(months: Months, p: Period): MonthData {
  const days: MonthData['days'] = {};
  for (const ym of periodMonths(p)) for (const [k, d] of Object.entries(months[ym]?.days ?? {})) if (inPeriod(k, p)) days[k] = d;
  return { days };
}

const dm = (k: string) => {
  const p = parseKey(k);
  return { d: p.d, mon: MONTHS_SHORT[p.m - 1], y: p.y };
};

/** "October 2026", "1 – 15 Oct 2026", "21 Oct – 20 Nov 2026", "21 Dec 2026 – 20 Jan 2027". */
export function periodLabel(p: Period): string {
  const ym = wholeMonth(p);
  if (ym) return monthLabel(ym);
  const a = dm(p.start);
  const b = dm(p.end);
  if (a.y !== b.y) return `${a.d} ${a.mon} ${a.y} – ${b.d} ${b.mon} ${b.y}`;
  if (a.mon !== b.mon) return `${a.d} ${a.mon} – ${b.d} ${b.mon} ${b.y}`;
  return a.d === b.d ? `${a.d} ${a.mon} ${a.y}` : `${a.d} – ${b.d} ${a.mon} ${a.y}`;
}

/** Worksheet name (≤ 31 chars, no reserved characters): "JobD-Oct-2026", "JobD-21-31Oct-2026", "JobD-21Oct-20Nov-2026". */
export function sheetName(p: Period): string {
  const ym = wholeMonth(p);
  const a = dm(p.start);
  const b = dm(p.end);
  if (ym) return `JobD-${a.mon}-${a.y}`;
  if (a.y !== b.y) return `JobD-${a.d}${a.mon}${a.y}-${b.d}${b.mon}${b.y}`;
  if (a.mon !== b.mon) return `JobD-${a.d}${a.mon}-${b.d}${b.mon}-${b.y}`;
  return a.d === b.d ? `JobD-${a.d}${a.mon}-${a.y}` : `JobD-${a.d}-${b.d}${a.mon}-${a.y}`;
}

const keysOf = (scope: Scope) => (typeof scope === 'string' ? monthKeys(scope) : periodKeys(scope));

/** Dates that appear in the sheet. `only` restricts to an explicit list (selected days / days with entries). */
export function listedDates(settings: Settings, scope: Scope, month: MonthData, only?: string[] | null): string[] {
  if (only) return [...only].sort();
  return keysOf(scope).filter((key) => {
    const day = month.days[key];
    const hasRecs = !!day && day.records.length > 0;
    return hasRecs || !!day?.holiday || !!holidayName(settings, key) || (settings.includeWeekdays && !isWeekend(key));
  });
}

export function sheetRows(settings: Settings, scope: Scope, month: MonthData, only?: string[] | null): SheetRow[] {
  const rows: SheetRow[] = [];
  for (const key of listedDates(settings, scope, month, only)) {
    const day = month.days[key];
    const recs = day?.records ?? [];
    if (!recs.length) rows.push({ date: key, holiday: day?.holiday || holidayName(settings, key) });
    else recs.forEach((rec, i) => rows.push({ date: i === 0 ? key : null, rec }));
  }
  return rows;
}

/** Same numbers the exported SUMMARY formulas produce. */
export function computeSheet(settings: Settings, scope: Scope, month: MonthData, only?: string[] | null): SheetData {
  const rows = sheetRows(settings, scope, month, only);
  const recs = rows.flatMap((r) => (r.rec ? [r.rec] : []));
  const sum = (pred: (r: EntryRecord) => boolean) => round3(recs.filter(pred).reduce((a, r) => a + (Number(r.days) || 0), 0));
  const total = sum(() => true);
  const leaveCats = settings.leaves.map((l) => l.category).filter(Boolean);
  const summary = [
    ...settings.customers.map((c) => ({ name: c, days: sum((r) => r.cust === c && !leaveCats.includes(r.cat)), leave: false })),
    ...settings.leaves.map((l) => ({ name: l.label || l.category, days: sum((r) => r.cat === l.category), leave: true })),
  ];
  return { rows, total, summary };
}

/** One worksheet (Excel) or one section (PDF) of an export. */
export interface SheetPart {
  name: string;
  period: Period;
  month: MonthData;
  only: string[] | null;
}

/**
 * Splits an export into sheets: one for the whole period, or one per calendar month it touches.
 * With an explicit day list, months that end up with no days are left out (but there's always one sheet).
 */
export function exportParts(months: Months, period: Period, only: string[] | null, layout: ExportLayout): SheetPart[] {
  const periods = layout === 'per-month' ? splitByMonth(period) : [period];
  const parts = periods.map((p) => ({ name: sheetName(p), period: p, month: mergeMonths(months, p), only: only ? only.filter((k) => inPeriod(k, p)) : null }));
  const kept = parts.filter((x) => !x.only || x.only.length);
  return kept.length ? kept : parts.slice(0, 1);
}

const firstName = (settings: Settings) => (settings.staffName || 'Staff').trim().split(/\s+/)[0].replace(/[^\w\u0E00-\u0E7F-]/g, '') || 'Staff';

export function suggestedFileName(settings: Settings, ym: string, suffix = '', ext: 'xlsx' | 'pdf' = 'xlsx'): string {
  const [y, m] = ym.split('-');
  return `${firstName(settings)}_Job-D_${MONTHS_SHORT[Number(m) - 1]}_${y}${suffix}.${ext}`;
}

/** Whole months keep the usual name; other ranges become e.g. "Test_Job-D_21Oct2026-20Nov2026.xlsx". */
export function periodFileName(settings: Settings, p: Period, suffix = '', ext: 'xlsx' | 'pdf' = 'xlsx'): string {
  const ym = wholeMonth(p);
  if (ym) return suggestedFileName(settings, ym, suffix, ext);
  const f = (k: string) => {
    const x = dm(k);
    return `${x.d}${x.mon}${x.y}`;
  };
  return `${firstName(settings)}_Job-D_${f(p.start)}-${f(p.end)}${suffix}.${ext}`;
}
