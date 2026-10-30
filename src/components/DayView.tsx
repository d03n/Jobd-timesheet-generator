import { useStore } from '../state/store';
import { useActions } from '../state/actions';
import { holidayInfo } from '../lib/holidays';
import { DayPill, RecordCard } from './RecordCard';

export function DayView() {
  const s = useStore();
  const { addEntry, pasteInto, copyEntries, copyPrev } = useActions();
  const key = s.selDate;
  const day = s.dayOf(key) ?? { holiday: '', records: [] };
  const info = holidayInfo(s.settings, key);

  return (
    <>
      {info && (
        <div className="holbanner">
          <b>{info.source === 'bot' ? 'Bank holiday' : 'Holiday'}</b> {info.name}
          {info.source === 'bot' ? ' — Bank of Thailand. ' : ' — your custom holiday. '}
          {day.records.length ? 'You logged work on this day, so the entries are used instead of the holiday row.' : 'It’s written as a grey holiday row in the sheet.'}
        </div>
      )}
      <div className="daymeta">
        <DayPill dayKey={key} />
        {!day.records.length && (
          <label className="holidayfld">
            Note for the sheet
            <input
              type="text"
              value={day.holiday}
              placeholder={info?.name ?? 'e.g. Public holiday'}
              onChange={(e) => s.mutateDays((dayAt) => (dayAt(key).holiday = e.target.value))}
            />
          </label>
        )}
      </div>
      <div className="recs">
        {!day.records.length && (
          <div className="empty"><p>No entries for this day. Add what you worked on — each entry becomes one row in the sheet.</p></div>
        )}
        {day.records.map((r, i) => <RecordCard key={r.id} rec={r} index={i} />)}
      </div>
      <div className="edfoot">
        <button type="button" className="btn primary" onClick={() => addEntry(key)}>Add entry</button>
        {s.clip.length > 0 && <button type="button" className="btn" onClick={() => pasteInto([key])}>Paste copied ({s.clip.length})</button>}
        {day.records.length > 0 && <button type="button" className="btn" onClick={() => copyEntries(day.records, `${day.records.length} ${day.records.length === 1 ? 'entry' : 'entries'}`)}>Copy this day</button>}
        <button type="button" className="btn" onClick={() => copyPrev(key)}>Copy previous day</button>
        {day.records.length > 1 && (
          <button type="button" className="btn quiet2" onClick={() => s.setChecked(new Set([...s.checked, ...day.records.map((r) => r.id)]))}>Select all</button>
        )}
      </div>
    </>
  );
}
