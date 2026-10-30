export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const pad = (n: number): string => String(n).padStart(2, '0');

export function parseKey(k: string): { y: number; m: number; d: number } {
  const [y, m, d] = k.split('-').map(Number);
  return { y, m, d };
}

/** 0 = Sunday … 6 = Saturday */
export function dowOf(k: string): number {
  const p = parseKey(k);
  return new Date(p.y, p.m - 1, p.d).getDay();
}

export const isWeekend = (k: string): boolean => {
  const w = dowOf(k);
  return w === 0 || w === 6;
};

export function todayKey(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

export function ymShift(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysIn(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthKeys(ym: string): string[] {
  return Array.from({ length: daysIn(ym) }, (_, i) => `${ym}-${pad(i + 1)}`);
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function fmtLong(k: string): string {
  const p = parseKey(k);
  return `${WD_LONG[dowOf(k)]} ${p.d} ${MONTHS_LONG[p.m - 1]} ${p.y}`;
}

export function fmtShort(k: string): string {
  const p = parseKey(k);
  return `${WD_LONG[dowOf(k)].slice(0, 3)} ${p.d} ${MONTHS_LONG[p.m - 1].slice(0, 3)}`;
}

export function fmtDMY(k: string): string {
  const p = k.split('-');
  return `${p[2]}/${p[1]}/${p[0]}`;
}

export const round3 = (n: number): number => Math.round(n * 1000) / 1000;

export function fmtDays(n: number | ''): string {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  return v % 1 === 0 ? v.toFixed(1) : String(v);
}

export function fmtPct(n: number, d: number): string {
  return `${(d > 0 ? (n / d) * 100 : 0).toFixed(1)}%`;
}

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
