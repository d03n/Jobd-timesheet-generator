import { useCallback } from 'react';
import type { EntryRecord } from '../types';
import { fmtShort, monthLabel, plural, round3 } from '../lib/dates';
import { clone, rid } from '../lib/ids';
import { getDay, useStore, type ClipEntry } from './store';

/** Id of a newly added entry whose description field should take focus once rendered. */
export const focusRequest = { id: null as string | null };

const bare = (r: EntryRecord): ClipEntry => ({ desc: r.desc, ref: r.ref, cat: r.cat, cust: r.cust, days: r.days });

export function useActions() {
  const s = useStore();
  const { curYM, month, mutateMonth, replaceMonth, showToast, setClip, clip, checked, setChecked, dayTotal, ask } = s;

  const restore = useCallback(
    (ym: string, snapshot: typeof month) => {
      replaceMonth(ym, snapshot);
      showToast('Restored.');
    },
    [replaceMonth, showToast],
  );

  const withUndo = useCallback(
    (msg: string, change: () => void) => {
      const ym = curYM;
      const snapshot = clone(month);
      change();
      setChecked(new Set());
      showToast(msg, { label: 'Undo', fn: () => restore(ym, snapshot) });
    },
    [curYM, month, restore, setChecked, showToast],
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
      mutateMonth((m) => keys.forEach((k) => getDay(m, k).records.push(...clip.map((c) => ({ ...c, id: rid() })))));
      showToast(`Pasted ${plural(clip.length, 'entry', 'entries')}${keys.length > 1 ? ` into ${keys.length} days` : ''}.`);
    },
    [clip, mutateMonth, showToast],
  );

  const lastCustomer = useCallback(
    (key: string) => {
      const keys = Object.keys(month.days).filter((k) => k <= key).sort().reverse();
      for (const k of keys) {
        const rs = month.days[k].records;
        for (let j = rs.length - 1; j >= 0; j--) if (rs[j].cust) return rs[j].cust;
      }
      return '';
    },
    [month],
  );

  const addEntry = useCallback(
    (key: string) => {
      const left = round3(1 - dayTotal(key));
      const rec: EntryRecord = { id: rid(), desc: '', ref: '', cat: '', cust: lastCustomer(key), days: left > 0 ? left : '' };
      focusRequest.id = rec.id;
      mutateMonth((m) => getDay(m, key).records.push(rec));
    },
    [dayTotal, lastCustomer, mutateMonth],
  );

  const updateRecord = useCallback(
    (id: string, patch: Partial<EntryRecord>) =>
      mutateMonth((m) => {
        for (const d of Object.values(m.days)) {
          const r = d.records.find((x) => x.id === id);
          if (r) Object.assign(r, patch);
        }
      }),
    [mutateMonth],
  );

  const removeRecord = useCallback(
    (id: string) => mutateMonth((m) => Object.values(m.days).forEach((d) => (d.records = d.records.filter((r) => r.id !== id)))),
    [mutateMonth],
  );

  const copyPrev = useCallback(
    (key: string) => {
      const keys = Object.keys(month.days).filter((k) => k < key && month.days[k].records.length).sort();
      const src = keys.length ? month.days[keys[keys.length - 1]].records : null;
      if (!src) {
        showToast('No earlier day with entries in this month.');
        return;
      }
      mutateMonth((m) => getDay(m, key).records.push(...src.map((r) => ({ ...bare(r), id: rid() }))));
      showToast(`Copied ${plural(src.length, 'entry', 'entries')} from ${fmtShort(keys[keys.length - 1])}.`);
    },
    [month, mutateMonth, showToast],
  );

  const deleteChecked = useCallback(() => {
    const n = Object.values(month.days).reduce((a, d) => a + d.records.filter((r) => checked.has(r.id)).length, 0);
    if (!n) return;
    withUndo(`Deleted ${plural(n, 'entry', 'entries')}.`, () =>
      mutateMonth((m) => Object.values(m.days).forEach((d) => (d.records = d.records.filter((r) => !checked.has(r.id))))),
    );
  }, [checked, month, mutateMonth, withUndo]);

  const clearDays = useCallback(
    (keys: string[]) => {
      const n = keys.reduce((a, k) => a + (month.days[k]?.records.length ?? 0), 0);
      if (!n) {
        showToast('No entries on the selected days.');
        return;
      }
      ask({
        title: `Clear entries on ${plural(keys.length, 'day')}?`,
        msg: `${plural(n, 'entry', 'entries')} on the selected days will be removed. You can undo right after.`,
        yesLabel: 'Clear entries',
        onYes: () => withUndo(`Cleared ${plural(n, 'entry', 'entries')}.`, () => mutateMonth((m) => keys.forEach((k) => (getDay(m, k).records = [])))),
      });
    },
    [ask, month, mutateMonth, showToast, withUndo],
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
      onYes: () => withUndo(`Cleared ${label}.`, () => replaceMonth(curYM, { days: {} })),
    });
  }, [ask, curYM, month, replaceMonth, showToast, withUndo]);

  return { copyEntries, pasteInto, addEntry, updateRecord, removeRecord, copyPrev, deleteChecked, clearDays, clearMonth };
}
