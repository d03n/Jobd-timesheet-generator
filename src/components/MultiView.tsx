import { useState } from 'react';
import type { EntryRecord } from '../types';
import { getDay, useStore } from '../state/store';
import { useActions } from '../state/actions';
import { fmtLong, fmtShort, plural, round3 } from '../lib/dates';
import { rid } from '../lib/ids';
import { AutoTextarea, DaysInput, OptionSelect } from './Fields';
import { DayPill, RecordCard } from './RecordCard';

const BLANK = { desc: '', ref: '', cat: '', cust: '', days: '' as number | '' };

export function MultiView() {
  const s = useStore();
  const { pasteInto, copyEntries, addEntry, clearDays } = useActions();
  const [form, setForm] = useState(BLANK);
  const [note, setNote] = useState('');
  const keys = s.selected;
  const n = keys.length;

  if (!n) {
    return (
      <div className="empty">
        <p>Click days on the calendar to select them. Shift-click selects a range. You can then add the same entry, paste copied entries or set a note on all of them at once.</p>
      </div>
    );
  }

  const addToAll = () => {
    if (!form.desc.trim() && !form.cat && !form.cust) {
      s.showToast('Fill in the entry first.');
      return;
    }
    s.mutateMonth((m) =>
      keys.forEach((k) => {
        const day = getDay(m, k);
        const left = round3(1 - day.records.reduce((a, r) => a + (Number(r.days) || 0), 0));
        const rec: EntryRecord = { id: rid(), ...form, days: form.days === '' ? (left > 0 ? left : '') : form.days };
        day.records.push(rec);
      }),
    );
    s.showToast(`Added the entry to ${plural(n, 'day')}.`);
  };

  return (
    <>
      <div className="bulk">
        <h3>Add the same entry to every selected day</h3>
        <label className="fld">
          <span>Job description</span>
          <AutoTextarea value={form.desc} onValue={(desc) => setForm({ ...form, desc })} placeholder="[Office]Support bank staff about…" />
        </label>
        <div className="rec-grid">
          <label className="fld"><span>IR/CR Ref#</span><input type="text" value={form.ref} placeholder="CR#2476" onChange={(e) => setForm({ ...form, ref: e.target.value })} /></label>
          <label className="fld"><span>Category</span><OptionSelect value={form.cat} options={s.settings.categories} onValue={(cat) => setForm({ ...form, cat })} /></label>
          <label className="fld"><span>Customer</span><OptionSelect value={form.cust} options={s.settings.customers} onValue={(cust) => setForm({ ...form, cust })} /></label>
          <label className="fld"><span>Days (each)</span><DaysInput value={form.days} placeholder="Auto" onValue={(days) => setForm({ ...form, days })} /></label>
        </div>
        <p className="hint">Leave Days empty (Auto) to fill whatever is left of each day, up to 1.0.</p>
        <div className="bulkrow"><button type="button" className="btn primary" onClick={addToAll}>Add to {plural(n, 'day')}</button></div>
        <div className="bulkrow">
          {s.clip.length > 0 && <button type="button" className="btn" onClick={() => pasteInto(keys)}>Paste copied ({s.clip.length}) into all</button>}
          <label className="holidayfld">Note<input type="text" value={note} placeholder="e.g. Public holiday" onChange={(e) => setNote(e.target.value)} /></label>
          <button
            type="button"
            className="btn"
            onClick={() => {
              s.mutateMonth((m) => keys.forEach((k) => (getDay(m, k).holiday = note)));
              s.showToast(note ? `Note set on ${plural(n, 'day')}.` : `Note cleared on ${plural(n, 'day')}.`);
            }}
          >
            Set note
          </button>
          <button type="button" className="btn" onClick={() => s.setChecked(new Set(keys.flatMap((k) => s.month.days[k]?.records.map((r) => r.id) ?? [])))}>Select all entries</button>
          <button type="button" className="btn danger" onClick={() => clearDays(keys)}>Clear entries</button>
        </div>
      </div>

      {keys.map((k) => {
        const day = s.month.days[k] ?? { holiday: '', records: [] };
        return (
          <div className="mday" key={k}>
            <div className="mdayhead">
              <button type="button" className="linkish" title="Open just this day" onClick={() => s.openDay(k)}>{fmtLong(k)}</button>
              <DayPill dayKey={k} />
              <span className="spacer" />
              {day.records.length > 0 && <button type="button" className="btn small" onClick={() => copyEntries(day.records, `entries from ${fmtShort(k)}`)}>Copy day</button>}
              {s.clip.length > 0 && <button type="button" className="btn small" onClick={() => pasteInto([k])}>Paste</button>}
              <button type="button" className="btn small" onClick={() => addEntry(k)}>Add entry</button>
            </div>
            <div className="recs">
              {day.records.map((r, i) => <RecordCard key={r.id} rec={r} index={i} />)}
              {!day.records.length && <p className="none">{day.holiday ? `Note: ${day.holiday}` : 'No entries.'}</p>}
            </div>
          </div>
        );
      })}
    </>
  );
}
