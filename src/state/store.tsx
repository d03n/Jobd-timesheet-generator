import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DayData, EntryRecord, MonthData, Months, Settings, View } from '../types';
import { daysIn, isWeekend, monthKeys, pad, round3, todayKey } from '../lib/dates';
import { holidayName } from '../lib/holidays';
import { clone } from '../lib/ids';
import { loadState, saveState } from '../lib/storage';

export type ClipEntry = Omit<EntryRecord, 'id'>;

export interface ToastState {
  id: number;
  msg: string;
  action?: { label: string; fn: () => void };
}

export interface ConfirmState {
  title: string;
  msg: string;
  yesLabel?: string;
  onYes: () => void;
}

interface Modifiers {
  shift?: boolean;
  toggle?: boolean;
}

export interface Store {
  settings: Settings;
  updateSettings: (fn: (s: Settings) => void) => void;
  replaceSettings: (s: Settings) => void;
  months: Months;
  curYM: string;
  month: MonthData;
  goMonth: (ym: string) => void;
  mutateMonth: (fn: (m: MonthData) => void, ym?: string) => void;
  replaceMonth: (ym: string, m: MonthData) => void;
  /** A stored day in any month. */
  dayOf: (key: string) => DayData | undefined;
  /** The stored days for these dates (any months), as one MonthData. */
  daysOf: (keys: string[]) => MonthData;
  /** Edits days in any months; `dayAt` returns a mutable day, creating it if needed. */
  mutateDays: (fn: (dayAt: (key: string) => DayData) => void) => void;
  /** Overwrites exactly these dates (any month); other days are left alone. */
  replaceDays: (days: Record<string, DayData>) => void;
  renameEverywhere: (field: 'cust' | 'cat', from: string, to: string) => void;

  selDate: string;
  selected: string[];
  multiMode: boolean;
  isMulti: boolean;
  view: View;
  setView: (v: View) => void;
  dayClick: (key: string, mods?: Modifiers) => void;
  openDay: (key: string) => void;
  setMultiMode: (on: boolean) => void;
  setSelected: (keys: string[]) => void;
  workingDays: (onlyEmpty?: boolean) => string[];

  checked: Set<string>;
  setChecked: (ids: Set<string>) => void;
  clip: ClipEntry[];
  setClip: (c: ClipEntry[]) => void;

  /** Days that make up 100%: selection, or the open day in Day view, else null (= whole month). */
  viewScope: string[] | null;
  /** Explicit selection only (used for export). */
  scopeKeys: string[] | null;
  dayTotal: (key: string) => number;
  scopeTotal: number;

  saveStatus: string;
  toast: ToastState | null;
  showToast: (msg: string, action?: ToastState['action']) => void;
  dismissToast: () => void;
  confirm: ConfirmState | null;
  ask: (c: ConfirmState) => void;
  closeConfirm: () => void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside <StoreProvider>');
  return s;
}

const EMPTY_MONTH: MonthData = { days: {} };

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(loadState, []);
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [months, setMonths] = useState<Months>(initial.months);
  const [curYM, setCurYM] = useState(() => todayKey().slice(0, 7));
  const [selDate, setSelDate] = useState(todayKey);
  const [selected, setSelectedRaw] = useState<string[]>([]);
  const [multiMode, setMultiModeRaw] = useState(false);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [view, setView] = useState<View>('day');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [clip, setClip] = useState<ClipEntry[]>([]);
  const [saveStatus, setSaveStatus] = useState('Saved in this browser');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const toastId = useRef(0);

  // Persist (debounced) whenever data changes.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaveStatus('Saving…');
    const t = setTimeout(() => setSaveStatus(saveState(settings, months) ? 'Saved in this browser' : 'Couldn’t save — browser storage is full or blocked'), 500);
    return () => clearTimeout(t);
  }, [settings, months]);

  const month = months[curYM] ?? EMPTY_MONTH;
  const isMulti = multiMode || selected.length > 0;

  const updateSettings = useCallback((fn: (s: Settings) => void) => {
    setSettings((prev) => {
      const next = clone(prev);
      fn(next);
      return next;
    });
  }, []);

  const mutateMonth = useCallback(
    (fn: (m: MonthData) => void, ym?: string) => {
      const key = ym ?? curYM;
      setMonths((prev) => {
        const m = clone(prev[key] ?? EMPTY_MONTH);
        fn(m);
        return { ...prev, [key]: m };
      });
    },
    [curYM],
  );

  const replaceMonth = useCallback((ym: string, m: MonthData) => setMonths((prev) => ({ ...prev, [ym]: m })), []);

  const dayOf = useCallback((key: string) => months[key.slice(0, 7)]?.days[key], [months]);
  const daysOf = useCallback(
    (keys: string[]): MonthData => {
      const days: MonthData['days'] = {};
      for (const k of keys) {
        const d = months[k.slice(0, 7)]?.days[k];
        if (d) days[k] = d;
      }
      return { days };
    },
    [months],
  );

  const mutateDays = useCallback((fn: (dayAt: (key: string) => DayData) => void) => {
    setMonths((prev) => {
      const next = { ...prev };
      const touched = new Set<string>();
      fn((k) => {
        const ym = k.slice(0, 7);
        if (!touched.has(ym)) {
          next[ym] = clone(prev[ym] ?? EMPTY_MONTH);
          touched.add(ym);
        }
        return getDay(next[ym], k);
      });
      return next;
    });
  }, []);

  const replaceDays = useCallback((days: Record<string, DayData>) => {
    setMonths((prev) => {
      const next = { ...prev };
      for (const [k, d] of Object.entries(days)) {
        const ym = k.slice(0, 7);
        if (next[ym] === prev[ym]) next[ym] = clone(prev[ym] ?? EMPTY_MONTH);
        next[ym].days[k] = d;
      }
      return next;
    });
  }, []);

  const renameEverywhere = useCallback((field: 'cust' | 'cat', from: string, to: string) => {
    setMonths((prev) => {
      const next = clone(prev);
      for (const m of Object.values(next)) for (const d of Object.values(m.days)) for (const r of d.records) if (r[field] === from) r[field] = to;
      return next;
    });
  }, []);

  const goMonth = useCallback((ym: string) => {
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    setCurYM(ym);
    setAnchor(null);
    setChecked(new Set());
    const tk = todayKey();
    setSelDate(tk.startsWith(ym) ? tk : `${ym}-01`);
  }, []);

  const isWorking = useCallback((k: string) => !isWeekend(k) && !holidayName(settings, k), [settings]);

  const dayClick = useCallback(
    (key: string, mods: Modifiers = {}) => {
      setView('day');
      if (mods.shift && anchor && anchor.slice(0, 7) === key.slice(0, 7)) {
        const [a, b] = anchor < key ? [anchor, key] : [key, anchor];
        const range: string[] = [];
        for (let d = Number(a.slice(8)); d <= Number(b.slice(8)); d++) {
          const k = `${curYM}-${pad(d)}`;
          if (isWorking(k) || k === key) range.push(k);
        }
        setSelectedRaw((prev) => [...new Set([...(prev.length || multiMode ? prev : [selDate]), ...range])].sort());
        setMultiModeRaw(true);
      } else if (multiMode || mods.toggle) {
        setSelectedRaw((prev) => {
          const base = prev.length || multiMode ? prev : [selDate];
          return (base.includes(key) ? base.filter((k) => k !== key) : [...base, key]).sort();
        });
        setMultiModeRaw(true);
        setAnchor(key);
      } else {
        setSelectedRaw([]);
        setSelDate(key);
        setAnchor(key);
      }
    },
    [anchor, curYM, isWorking, multiMode, selDate],
  );

  const openDay = useCallback((key: string) => {
    setCurYM(key.slice(0, 7));
    setSelectedRaw([]);
    setMultiModeRaw(false);
    setSelDate(key);
    setView('day');
  }, []);

  const setMultiMode = useCallback(
    (on: boolean) => {
      if (on) {
        setMultiModeRaw(true);
        setSelectedRaw([selDate]);
      } else {
        setMultiModeRaw(false);
        const here = selected.find((k) => k.startsWith(curYM));
        if (here) setSelDate(here);
        setSelectedRaw([]);
      }
      setView('day');
    },
    [curYM, selDate, selected],
  );

  const workingDays = useCallback(
    (onlyEmpty = false) =>
      monthKeys(curYM).filter((k) => {
        if (!isWorking(k)) return false;
        if (!onlyEmpty) return true;
        const d = month.days[k];
        return !(d && (d.records.length || d.holiday));
      }),
    [curYM, isWorking, month],
  );

  const dayTotal = useCallback(
    (key: string) => {
      const d = (months[key.slice(0, 7)] ?? EMPTY_MONTH).days[key];
      return d ? round3(d.records.reduce((a, r) => a + (Number(r.days) || 0), 0)) : 0;
    },
    [months],
  );

  const scopeKeys = isMulti && selected.length ? [...selected].sort() : null;
  const viewScope = isMulti ? scopeKeys : view === 'month' ? null : [selDate];
  const scopeTotal = useMemo(() => {
    const keys = viewScope ?? Array.from({ length: daysIn(curYM) }, (_, i) => `${curYM}-${pad(i + 1)}`);
    return round3(keys.reduce((a, k) => a + dayTotal(k), 0));
  }, [viewScope, curYM, dayTotal]);

  const showToast = useCallback((msg: string, action?: ToastState['action']) => {
    toastId.current += 1;
    setToast({ id: toastId.current, msg, action });
  }, []);

  const value: Store = {
    settings,
    updateSettings,
    replaceSettings: setSettings,
    months,
    curYM,
    month,
    goMonth,
    mutateMonth,
    replaceMonth,
    dayOf,
    daysOf,
    mutateDays,
    replaceDays,
    renameEverywhere,
    selDate,
    selected,
    multiMode,
    isMulti,
    view,
    setView,
    dayClick,
    openDay,
    setMultiMode,
    setSelected: (keys) => setSelectedRaw([...keys].sort()),
    workingDays,
    checked,
    setChecked,
    clip,
    setClip,
    viewScope,
    scopeKeys,
    dayTotal,
    scopeTotal,
    saveStatus,
    toast,
    showToast,
    dismissToast: () => setToast(null),
    confirm,
    ask: setConfirm,
    closeConfirm: () => setConfirm(null),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Helpers that operate on a cloned month inside mutateMonth. */
export function getDay(m: MonthData, key: string) {
  return (m.days[key] ??= { holiday: '', records: [] });
}

export function findRecord(m: MonthData, id: string): EntryRecord | undefined {
  for (const d of Object.values(m.days)) {
    const r = d.records.find((x) => x.id === id);
    if (r) return r;
  }
  return undefined;
}
