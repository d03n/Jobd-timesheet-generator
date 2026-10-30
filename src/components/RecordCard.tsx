import type { EntryRecord } from '../types';
import { useStore } from '../state/store';
import { focusRequest, useActions } from '../state/actions';
import { fmtPct } from '../lib/dates';
import { AutoTextarea, DaysInput, OptionSelect } from './Fields';

export function useUtil() {
  const { scopeTotal } = useStore();
  return (r: EntryRecord) => (Number(r.days) > 0 && scopeTotal > 0 ? fmtPct(Number(r.days), scopeTotal) : '–');
}

export function RecordCheckbox({ rec, label }: { rec: EntryRecord; label: string }) {
  const { checked, setChecked } = useStore();
  return (
    <input
      type="checkbox"
      className="reccheck"
      aria-label={label}
      checked={checked.has(rec.id)}
      onChange={(e) => {
        const next = new Set(checked);
        if (e.target.checked) next.add(rec.id);
        else next.delete(rec.id);
        setChecked(next);
      }}
    />
  );
}

export function RecordCard({ rec, index }: { rec: EntryRecord; index: number }) {
  const { settings, checked } = useStore();
  const { updateRecord, removeRecord, copyEntries } = useActions();
  const util = useUtil();
  const leaveCats = settings.leaves.map((l) => l.category);
  const focusNow = focusRequest.id === rec.id;
  if (focusNow) queueMicrotask(() => (focusRequest.id = null));
  const set = (patch: Partial<EntryRecord>) => updateRecord(rec.id, patch);

  return (
    <div className={`rec${checked.has(rec.id) ? ' checked' : ''}`}>
      <div className="rec-top">
        <label className="rec-n"><RecordCheckbox rec={rec} label={`Select entry ${index + 1}`} /> Entry {index + 1}</label>
        <span className="rec-actions">
          <button type="button" className="btn small" title="Copy this entry (and its job description)" onClick={() => copyEntries([rec], 'entry')}>Copy</button>
          <button type="button" className="btn small quiet" onClick={() => removeRecord(rec.id)}>Remove</button>
        </span>
      </div>
      <label className="fld">
        <span>Job description</span>
        <AutoTextarea value={rec.desc} onValue={(desc) => set({ desc })} placeholder="[Office]Investigate and fix…" focusNow={focusNow} />
      </label>
      <div className="rec-grid">
        <label className="fld"><span>IR/CR Ref#</span><input type="text" value={rec.ref} placeholder="CR#2476" onChange={(e) => set({ ref: e.target.value })} /></label>
        <label className="fld">
          <span>Category</span>
          <OptionSelect className={!rec.cat ? 'missing' : ''} value={rec.cat} options={settings.categories} onValue={(cat) => set({ cat })} />
        </label>
        <label className="fld">
          <span>Customer</span>
          <OptionSelect className={!rec.cust && !leaveCats.includes(rec.cat) ? 'missing' : ''} value={rec.cust} options={settings.customers} onValue={(cust) => set({ cust })} />
        </label>
        <label className="fld"><span>Days</span><DaysInput value={rec.days} onValue={(days) => set({ days })} /></label>
        <div className="fld"><span>Utilization</span><output className="util">{util(rec)}</output></div>
      </div>
    </div>
  );
}

export function DayPill({ dayKey }: { dayKey: string }) {
  const { dayTotal } = useStore();
  const t = dayTotal(dayKey);
  const cls = t > 1.0001 ? ' over' : t >= 0.9999 ? ' ok' : t > 0 ? ' partial' : '';
  return <span className={`pill${cls}`}>{t % 1 === 0 ? t.toFixed(1) : t} {t === 1 ? 'day logged' : 'days logged'}</span>;
}
