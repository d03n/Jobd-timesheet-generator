import type { EntryRecord, MonthData, Settings, SheetData, SheetRow } from '../types';
import { isWeekend, MONTHS_SHORT, monthKeys, round3 } from './dates';
import { holidayName } from './holidays';

/** Dates that appear in the sheet. `only` restricts to an explicit list (selected days / days with entries). */
export function listedDates(settings: Settings, ym: string, month: MonthData, only?: string[] | null): string[] {
  if (only) return [...only].sort();
  return monthKeys(ym).filter((key) => {
    const day = month.days[key];
    const hasRecs = !!day && day.records.length > 0;
    return hasRecs || !!day?.holiday || !!holidayName(settings, key) || (settings.includeWeekdays && !isWeekend(key));
  });
}

export function sheetRows(settings: Settings, ym: string, month: MonthData, only?: string[] | null): SheetRow[] {
  const rows: SheetRow[] = [];
  for (const key of listedDates(settings, ym, month, only)) {
    const day = month.days[key];
    const recs = day?.records ?? [];
    if (!recs.length) rows.push({ date: key, holiday: day?.holiday || holidayName(settings, key) });
    else recs.forEach((rec, i) => rows.push({ date: i === 0 ? key : null, rec }));
  }
  return rows;
}

/** Same numbers the exported SUMMARY formulas produce. */
export function computeSheet(settings: Settings, ym: string, month: MonthData, only?: string[] | null): SheetData {
  const rows = sheetRows(settings, ym, month, only);
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

export function suggestedFileName(settings: Settings, ym: string, suffix = '', ext: 'xlsx' | 'pdf' = 'xlsx'): string {
  const [y, m] = ym.split('-');
  const first = (settings.staffName || 'Staff').trim().split(/\s+/)[0].replace(/[^\w\u0E00-\u0E7F-]/g, '') || 'Staff';
  return `${first}_Job-D_${MONTHS_SHORT[Number(m) - 1]}_${y}${suffix}.${ext}`;
}
