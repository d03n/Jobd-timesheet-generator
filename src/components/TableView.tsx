import type { EntryRecord } from '../types';
import { getDay, useStore } from '../state/store';
import { focusRequest, useActions } from '../state/actions';
import { fmtDays, fmtDMY, monthLabel, WD_LONG, dowOf } from '../lib/dates';
import { holidayName } from '../lib/holidays';
import { listedDates } from '../lib/sheet';
import { AutoTextarea, DaysInput, OptionSelect } from './Fields';
import { Icon, IconButton } from './Icon';
import { RecordCheckbox, useUtil } from './RecordCard';

const COLS = ['84px', undefined, '100px', '92px', '108px', '62px', '56px', '38px'];
const HEADS = ['Date', 'Job description', 'IR/CR Ref#', 'Category', 'Customer', 'Days', 'Util.'];

export function TableView() {
  const s = useStore();
  const { addEntry, updateRecord, removeRecord, copyEntries, pasteInto, clearMonth } = useActions();
  const util = useUtil();
  const only = s.scopeKeys;
  const dates = listedDates(s.settings, s.curYM, s.month, only);
  const leaveCats = s.settings.leaves.map((l) => l.category);
  const allIds = dates.flatMap((k) => s.month.days[k]?.records.map((r) => r.id) ?? []);
  const allChecked = allIds.length > 0 && allIds.every((id) => s.checked.has(id));

  const dateCell = (k: string, rowSpan: number) => (
    <td className="datecell" rowSpan={rowSpan}>
      <button type="button" className="linkish small" title="Open this day as cards" onClick={() => s.openDay(k)}>{fmtDMY(k)}</button>
      <span className="wdname">{WD_LONG[dowOf(k)].slice(0, 3)}</span>
      <button type="button" className="btn small addrowbtn" aria-label={`Add entry on ${fmtDMY(k)}`} onClick={() => addEntry(k)}>Add entry</button>
    </td>
  );

  const row = (k: string, r: EntryRecord, i: number, count: number) => {
    const set = (patch: Partial<EntryRecord>) => updateRecord(r.id, patch);
    const focusNow = focusRequest.id === r.id;
    if (focusNow) queueMicrotask(() => (focusRequest.id = null));
    return (
      <tr key={r.id} className={`${i === 0 ? 'daystart' : ''}${s.checked.has(r.id) ? ' checked' : ''}`}>
        {i === 0 && dateCell(k, count)}
        <td className="desccell" data-label="Job description">
          <AutoTextarea value={r.desc} onValue={(desc) => set({ desc })} minHeight={38} aria-label="Job description" placeholder="Job description" focusNow={focusNow} />
        </td>
        <td className="refcell" data-label="IR/CR Ref#"><input type="text" value={r.ref} aria-label="IR/CR Ref#" onChange={(e) => set({ ref: e.target.value })} /></td>
        <td data-label="Category"><OptionSelect aria-label="Category" className={!r.cat ? 'missing' : ''} blank="–" value={r.cat} options={s.settings.categories} onValue={(cat) => set({ cat })} /></td>
        <td data-label="Customer"><OptionSelect aria-label="Customer" className={`custsel${!r.cust && !leaveCats.includes(r.cat) ? ' missing' : ''}`} blank="–" value={r.cust} options={s.settings.customers} onValue={(cust) => set({ cust })} /></td>
        <td className="dayscell" data-label="Days"><DaysInput aria-label="Days" value={r.days} onValue={(days) => set({ days })} /></td>
        <td className="num" data-label="Utilization"><output>{util(r)}</output></td>
        <td className="acts">
          <div className="actsin">
            <RecordCheckbox rec={r} label="Select entry" />
            <IconButton icon="copy" label="Copy entry" onClick={() => copyEntries([r], 'entry')} />
            {s.clip.length > 0 && <IconButton icon="paste" label="Paste copied entries into this day" onClick={() => pasteInto([k])} />}
            <IconButton icon="trash" label="Remove entry" danger onClick={() => removeRecord(r.id)} />
          </div>
        </td>
      </tr>
    );
  };

  return (
    <>
      <div className="tablewrap">
        <table className="month edit">
          <colgroup>{COLS.map((w, i) => <col key={i} style={w ? { width: w } : undefined} />)}</colgroup>
          <thead>
            <tr>
              {HEADS.map((t, i) => <th key={t} className={i >= 5 ? 'num' : ''}>{t}</th>)}
              <th className="acts">
                <input
                  type="checkbox"
                  aria-label="Select all entries shown"
                  title="Select all"
                  checked={allChecked}
                  onChange={(e) => s.setChecked(e.target.checked ? new Set([...s.checked, ...allIds]) : new Set([...s.checked].filter((id) => !allIds.includes(id))))}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {dates.map((k) => {
              const day = s.month.days[k];
              if (!day?.records.length) {
                const hname = holidayName(s.settings, k);
                return (
                  <tr key={k} className={`daystart${day?.holiday || hname ? ' hol' : ''}`}>
                    {dateCell(k, 1)}
                    <td colSpan={7}>
                      <input
                        type="text"
                        aria-label={`Note for ${fmtDMY(k)}`}
                        value={day?.holiday ?? ''}
                        placeholder={hname || 'No entries — note, e.g. Public holiday'}
                        onChange={(e) => s.mutateMonth((m) => (getDay(m, k).holiday = e.target.value))}
                      />
                    </td>
                  </tr>
                );
              }
              return day.records.map((r, i) => row(k, r, i, day.records.length));
            })}
            {!dates.length && <tr><td colSpan={8} className="none">No days to show.</td></tr>}
            <tr className="tot">
              <td /><td /><td /><td />
              <td>TOTAL</td>
              <td className="num">{fmtDays(s.scopeTotal)}</td>
              <td className="num">{s.scopeTotal > 0 ? '100%' : ''}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      {!only && (
        <div className="edfoot danger-zone">
          <button type="button" className="btn small danger" onClick={clearMonth}>
            <Icon name="trash" />
            Clear all of {monthLabel(s.curYM)}…
          </button>
        </div>
      )}
    </>
  );
}
