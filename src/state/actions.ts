import { useCallback } from 'react';
import type { EntryRecord, MonthData } from '../types';
import { fmtShort, monthLabel, plural, round3 } from '../lib/dates';
import { clone, rid } from '../lib/ids';
import { findRecord, getDay, useStore, type ClipEntry } from './store';

/** Id of a newly added entry whose description field should take focus once rendered. */
export const focusRequest = { id: null as string | null };

const bare = (r: EntryRecord): ClipEntry => ({ desc: r.desc, ref: r.ref, cat: r.cat, cust: r.cust, days: r.days });

export function useActions() {
  const s = useStore();
  const { curYM, month, months, mutateMonth, mutateDays, dayOf, replaceMonth, showToast, setClip, clip, checked, setChecked, dayTotal, ask } = s;

  /** The month an entry is stored in (selections and lists can span months). */
  const ymOfRecord = useCallback((id: string) => Object.keys(months).find((ym) => findRecord(months[ym], id)), [months]);

  /** Runs `change`, offering Undo that restores every month in `yms` as it was. */
  const withUndo = useCallback(
    (msg: string, yms: string[], change: () => void) => {
      const snapshot: [string, MonthData][] = [...new Set(yms)].map((ym) => [ym, clone(months[ym] ?? { days: {} })]);
      change();
      setChecked(new Set());
      showToast(msg, {
        label: 'Undo',
        fn: () => {
          snapshot.forEach(([ym, m]) => replaceMonth(ym, m));
          showToast('Restored.');
        },
      });
    },
    [months, replaceMonth, setChecked, showToast],
  );

  const copyEntries = useCallback(
    (recs: EntryRecord[], label: string) => {
      const next = recs.map(bare);
      setClip(next);
      const text = next.map((r) => r.desc).filter(Boolean).join('\n');
      if (text) navigator.clipboard?.writeText(text).catch(() => undefined);
      showToast(`Copied ${label}. Use “Paste” on any day — the job description is also on your clipboard.`);
    },
    [setClip, showToast],
  );

  const pasteInto = useCallback(
    (keys: string[]) => {
      if (!clip.length) return;
      mutateDays((dayAt) => keys.forEach((k) => dayAt(k).records.push(...clip.map((c) => ({ ...c, id: rid() })))));
      showToast(`Pasted ${plural(clip.length, 'entry', 'entries')}${keys.length > 1 ? ` into ${keys.length} days` : ''}.`);
    },
    [clip, mutateDays, showToast],
  );

  const lastCustomer = useCallback(
    (key: string) => {
      const m = months[key.slice(0, 7)] ?? { days: {} };
      const keys = Object.keys(m.days).filter((k) => k <= key).sort().reverse();
      for (const k of keys) {
        const rs = m.days[k].records;
        for (let j = rs.length - 1; j >= 0; j--) if (rs[j].cust) return rs[j].cust;
      }
      return '';
    },
    [months],
  );

  const addEntry = useCallback(
    (key: string) => {
      const left = round3(1 - dayTotal(key));
      const rec: EntryRecord = { id: rid(), desc: '', ref: '', cat: '', cust: lastCustomer(key), days: left > 0 ? left : '' };
      focusRequest.id = rec.id;
      mutateMonth((m) => getDay(m, key).records.push(rec), key.slice(0, 7));
    },
    [dayTotal, lastCustomer, mutateMonth],
  );

  const updateRecord = useCallback(
    (id: string, patch: Partial<EntryRecord>) => {
      const ym = ymOfRecord(id);
      if (!ym) return;
      mutateMonth((m) => {
        const r = findRecord(m, id);
        if (r) Object.assign(r, patch);
      }, ym);
    },
    [mutateMonth, ymOfRecord],
  );

  const removeRecord = useCallback(
    (id: string) => {
      const ym = ymOfRecord(id);
      if (ym) mutateMonth((m) => Object.values(m.days).forEach((d) => (d.records = d.records.filter((r) => r.id !== id))), ym);
    },
    [mutateMonth, ymOfRecord],
  );

  const copyPrev = useCallback(
    (key: string) => {
      const ym = key.slice(0, 7);
      const m = months[ym] ?? { days: {} };
      const keys = Object.keys(m.days).filter((k) => k < key && m.days[k].records.length).sort();
      const src = keys.length ? m.days[keys[keys.length - 1]].records : null;
      if (!src) {
        showToast('No earlier day with entries in this month.');
        return;
      }
      mutateMonth((mm) => getDay(mm, key).records.push(...src.map((r) => ({ ...bare(r), id: rid() }))), ym);
      showToast(`Copied ${plural(src.length, 'entry', 'entries')} from ${fmtShort(keys[keys.length - 1])}.`);
    },
    [months, mutateMonth, showToast],
  );

  const deleteChecked = useCallback(() => {
    const count = (ym: string) => Object.values(months[ym].days).reduce((a, d) => a + d.records.filter((r) => checked.has(r.id)).length, 0);
    const yms = Object.keys(months).filter((ym) => count(ym) > 0);
    const n = yms.reduce((a, ym) => a + count(ym), 0);
    if (!n) return;
    withUndo(`Deleted ${plural(n, 'entry', 'entries')}.`, yms, () =>
      yms.forEach((ym) => mutateMonth((m) => Object.values(m.days).forEach((d) => (d.records = d.records.filter((r) => !checked.has(r.id)))), ym)),
    );
  }, [checked, months, mutateMonth, withUndo]);

  const clearDays = useCallback(
    (keys: string[]) => {
      const n = keys.reduce((a, k) => a + (dayOf(k)?.records.length ?? 0), 0);
      if (!n) {
        showToast('No entries on the selected days.');
        return;
      }
      ask({
        title: `Clear entries on ${plural(keys.length, 'day')}?`,
        msg: `${plural(n, 'entry', 'entries')} on the selected days will be removed. You can undo right after.`,
        yesLabel: 'Clear entries',
        onYes: () =>
          withUndo(`Cleared ${plural(n, 'entry', 'entries')}.`, keys.map((k) => k.slice(0, 7)), () => mutateDays((dayAt) => keys.forEach((k) => (dayAt(k).records = [])))),
      });
    },
    [ask, dayOf, mutateDays, showToast, withUndo],
  );

  const clearMonth = useCallback(() => {
    const days = Object.values(month.days);
    const n = days.reduce((a, d) => a + d.records.length, 0);
    const notes = days.filter((d) => d.holiday).length;
    const label = monthLabel(curYM);
    if (!n && !notes) {
      showToast(`Nothing to clear in ${label}.`);
      return;
    }
    ask({
      title: `Clear all of ${label}?`,
      msg: `This removes all ${plural(n, 'entry', 'entries')}${notes ? ` and ${plural(notes, 'note')}` : ''} in ${label}. Settings and other months aren’t affected. You can undo right after.`,
      yesLabel: 'Clear month',
      onYes: () => withUndo(`Cleared ${label}.`, [curYM], () => replaceMonth(curYM, { days: {} })),
    });
  }, [ask, curYM, month, replaceMonth, showToast, withUndo]);

  return { copyEntries, pasteInto, addEntry, updateRecord, removeRecord, copyPrev, deleteChecked, clearDays, clearMonth };
}
