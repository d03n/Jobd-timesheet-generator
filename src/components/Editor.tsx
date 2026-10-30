import { useStore } from '../state/store';
import { fmtLong, monthLabel, plural } from '../lib/dates';
import { listedDates } from '../lib/sheet';
import { CheckBar, ClipBar } from './Bars';
import { DayView } from './DayView';
import { MultiView } from './MultiView';
import { TableView } from './TableView';

export function Editor() {
  const s = useStore();
  const { view, isMulti, selected } = s;

  const title =
    view === 'month'
      ? s.scopeKeys
        ? `List · ${plural(selected.length, 'selected day')}`
        : `All entries, ${monthLabel(s.curYM)}`
      : isMulti
        ? selected.length ? `${plural(selected.length, 'day')} selected` : 'Select days on the calendar'
        : fmtLong(s.selDate);

  const visibleKeys = view === 'month' ? listedDates(s.settings, s.curYM, s.month, s.scopeKeys) : isMulti ? selected : [s.selDate];
  const visibleIds = visibleKeys.flatMap((k) => s.dayOf(k)?.records.map((r) => r.id) ?? []);

  return (
    <section className="panel" id="editor" tabIndex={-1} aria-label="Entries">
      <div className="edhead">
        <h2>{title}</h2>
        <div className="tabs" role="tablist" aria-label="View">
          <button type="button" role="tab" aria-selected={view === 'day'} onClick={() => s.setView('day')}>Cards</button>
          <button type="button" role="tab" aria-selected={view === 'month'} onClick={() => s.setView('month')}>Table</button>
        </div>
      </div>
      <ClipBar />
      <CheckBar visibleIds={visibleIds} />
      {view === 'month' ? <TableView /> : isMulti ? <MultiView /> : <DayView />}
    </section>
  );
}
