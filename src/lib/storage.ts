import type { DayData, MonthData, Months, Settings } from '../types';
import { rid } from './ids';

export const STORAGE_KEY = 'jobd-timesheet:v1';

export const DEFAULT_SETTINGS: Settings = {
  staffName: '',
  titleLeft: 'SILVERLAKE',
  titleRight: 'TIME SHEET',
  customers: ['KK', 'SCIB-ICS', 'SCIB-IB', 'SME', 'LHB', 'GHB', 'TCRB', 'TBANK-SIBS', 'TBANK-ICS', 'KTC', 'SLI', 'CIMB', 'SSS/STL'],
  categories: ['IR', 'CR-QUOTE', 'CR-DEV', 'INTERNAL', 'PROJECT', 'Marketing', 'A/L', 'M/L', 'H/L'],
  leaves: [
    { label: 'Annual Leave', category: 'A/L' },
    { label: 'Medical Leave', category: 'M/L' },
  ],
  spareRows: 5,
  includeWeekdays: true,
  useBotHolidays: true,
  botBangkok: true,
  customHolidays: [],
};

const strList = (a: unknown, def: string[]): string[] =>
  Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [...def];

/** Accepts anything (old saves, imports) and returns valid settings. */
export function normSettings(raw: unknown): Settings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const str = (k: keyof Settings) => (typeof s[k] === 'string' ? (s[k] as string) : (d[k] as string));
  const spare = Number(s.spareRows);
  return {
    staffName: str('staffName'),
    titleLeft: str('titleLeft'),
    titleRight: str('titleRight'),
    customers: strList(s.customers, d.customers),
    categories: strList(s.categories, d.categories),
    leaves: Array.isArray(s.leaves)
      ? (s.leaves as unknown[])
          .filter((l): l is { label?: unknown; category: string } => !!l && typeof (l as { category?: unknown }).category === 'string')
          .map((l) => ({ label: String(l.label ?? ''), category: l.category }))
      : d.leaves.map((l) => ({ ...l })),
    spareRows: Number.isFinite(spare) ? Math.max(0, Math.min(50, Math.floor(spare))) : d.spareRows,
    includeWeekdays: s.includeWeekdays !== false,
    useBotHolidays: s.useBotHolidays !== false,
    botBangkok: s.botBangkok !== false,
    customHolidays: Array.isArray(s.customHolidays)
      ? (s.customHolidays as { date?: unknown; name?: unknown }[])
          .filter((c) => c && typeof c.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.date))
          .map((c) => ({ date: c.date as string, name: String(c.name ?? '') }))
      : [],
  };
}

interface StoredDay { date: string; holiday?: string; records?: unknown[] }

export function monthFromDoc(doc: unknown): MonthData {
  const m: MonthData = { days: {} };
  const days = (doc as { days?: StoredDay[] })?.days;
  if (!Array.isArray(days)) return m;
  for (const d of days) {
    if (!d || typeof d.date !== 'string') continue;
    m.days[d.date] = {
      holiday: String(d.holiday ?? ''),
      records: (Array.isArray(d.records) ? d.records : []).map((x) => {
        const r = x as Record<string, unknown>;
        return {
          id: typeof r.id === 'string' ? r.id : rid(),
          desc: String(r.desc ?? ''),
          ref: String(r.ref ?? ''),
          cat: String(r.cat ?? ''),
          cust: String(r.cust ?? ''),
          days: r.days === '' || r.days == null ? '' : Number(r.days),
        };
      }),
    };
  }
  return m;
}

export function monthToDoc(m: MonthData): { days: (DayData & { date: string })[] } {
  return {
    days: Object.keys(m.days)
      .sort()
      .filter((k) => m.days[k].records.length || m.days[k].holiday)
      .map((k) => ({ date: k, holiday: m.days[k].holiday, records: m.days[k].records })),
  };
}

export function loadState(): { settings: Settings; months: Months } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { settings: normSettings(null), months: {} };
    const o = JSON.parse(raw) as { settings?: unknown; months?: Record<string, unknown> };
    const months: Months = {};
    for (const [ym, doc] of Object.entries(o.months ?? {})) months[ym] = monthFromDoc(doc);
    return { settings: normSettings(o.settings), months };
  } catch {
    return { settings: normSettings(null), months: {} };
  }
}

export function saveState(settings: Settings, months: Months): boolean {
  try {
    const out: Record<string, unknown> = {};
    for (const [ym, m] of Object.entries(months)) out[ym] = monthToDoc(m);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, months: out }));
    return true;
  } catch {
    return false;
  }
}
