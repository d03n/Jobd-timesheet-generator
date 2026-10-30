import type { KeyboardEvent, MouseEvent } from 'react';
import { useStore } from '../state/store';
import { BOT_HOLIDAYS, holidayName } from '../lib/holidays';
import { dowOf, fmtDays, MONTHS_LONG, monthKeys, monthLabel, todayKey, ymShift } from '../lib/dates';
import { Icon } from './Icon';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Calendar() {
  const s = useStore();
  const { curYM, settings, month, isMulti, selected, selDate } = s;
  const keys = monthKeys(curYM);
  const offset = (dowOf(keys[0]) + 6) % 7;
  const today = todayKey();
  const focusKey = isMulti && selected.length ? selected[0] : selDate;

  const onClick = (e: MouseEvent, key: string) => {
    s.dayClick(key, { shift: e.shiftKey, toggle: e.ctrlKey || e.metaKey });
    if (!isMulti && !e.shiftKey && !e.ctrlKey && !e.metaKey && window.matchMedia('(max-width: 720px)').matches) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => document.getElementById('editor')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
    }
  };

  // Roving focus: arrows move by day/week, Home/End jump to month ends.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = (e.target as HTMLElement).closest<HTMLButtonElement>('.day');
    if (!cur) return;
    const days = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.day'));
    const idx = days.indexOf(cur);
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[e.key];
    let next: HTMLButtonElement | undefined;
    if (step) next = days[Math.max(0, Math.min(days.length - 1, idx + step))];
    else if (e.key === 'Home') next = days[0];
    else if (e.key === 'End') next = days[days.length - 1];
    if (!next) return;
    e.preventDefault();
    days.forEach((d) => (d.tabIndex = -1));
    next.tabIndex = 0;
    next.focus();
  };

  const year = curYM.slice(0, 4);
  const botCount = keys.filter((k) => BOT_HOLIDAYS.days[k] && holidayName(settings, k)).length;
  const holNote = !settings.useBotHolidays
    ? 'Bank of Thailand holidays are off (Settings).'
    : BOT_HOLIDAYS.sources[year]
      ? `Bank of Thailand holidays ${year}: ${botCount} this month (${BOT_HOLIDAYS.sources[year]}).`
      : `No Bank of Thailand list for ${year} built in (available: ${Object.keys(BOT_HOLIDAYS.sources).join(', ')}). Add holidays in Settings.`;

  return (
    <section className="panel calpanel" aria-label="Calendar">
      <div className="monthnav">
        <button className="iconbtn" id="prevM" type="button" aria-label="Previous month" onClick={() => s.goMonth(ymShift(curYM, -1))}><Icon name="chevronLeft" /></button>
        <h2 id="monthTitle">{monthLabel(curYM)}</h2>
        <input className="monthpick" type="month" id="monthPick" aria-label="Choose month" value={curYM} onChange={(e) => s.goMonth(e.target.value)} />
        <button className="iconbtn" id="nextM" type="button" aria-label="Next month" onClick={() => s.goMonth(ymShift(curYM, 1))}><Icon name="chevronRight" /></button>
      </div>

      <div className="calbar" id="calbar">
        <button type="button" className={`btn small${isMulti ? ' on' : ''}`} aria-pressed={isMulti} onClick={() => s.setMultiMode(!isMulti)}>
          {isMulti ? 'Done selecting' : 'Select multiple days'}
        </button>
        {isMulti ? (
          <>
            <button type="button" className="btn small" title="Weekdays that aren’t holidays" onClick={() => s.setSelected(s.workingDays())}>Working days</button>
            <button type="button" className="btn small" onClick={() => s.setSelected(s.workingDays(true))}>Empty working days</button>
            {selected.length > 0 && <button type="button" className="btn small quiet" onClick={() => s.setSelected([])}>Clear</button>}
          </>
        ) : (
          <span className="calhint">Tip: Ctrl/⌘-click days to pick several, Shift-click for a weekday range.</span>
        )}
      </div>

      <div className="cal" id="cal" onKeyDown={onKeyDown}>
        {WEEKDAYS.map((w) => <div key={w} className="wd">{w}</div>)}
        {Array.from({ length: offset }, (_, i) => <div key={`b${i}`} />)}
        {keys.map((key) => {
          const d = Number(key.slice(8));
          const wd = dowOf(key);
          const tot = s.dayTotal(key);
          const day = month.days[key];
          const hname = holidayName(settings, key);
          const hasRecs = !!day?.records.length;
          const isSel = isMulti ? selected.includes(key) : key === selDate;
          const cls = ['day',
            wd === 0 || wd === 6 ? 'weekend' : '',
            (hname || day?.holiday) && !hasRecs ? 'holiday' : '',
            hname ? 'pubhol' : '',
            tot > 1.0001 ? 'over' : tot >= 0.9999 ? 'full' : tot > 0 ? 'partial' : '',
            isSel ? 'sel' : '',
            key === today ? 'today' : '',
          ].filter(Boolean).join(' ');
          const status = tot ? `${tot} days logged` : day?.holiday || 'nothing logged';
          return (
            <button
              key={key}
              type="button"
              className={cls}
              data-key={key}
              tabIndex={key === focusKey ? 0 : -1}
              aria-pressed={isSel}
              aria-label={`${d} ${MONTHS_LONG[Number(curYM.slice(5)) - 1]}, ${hname ? `${hname}, ` : ''}${status}`}
              title={hname || day?.holiday || ''}
              style={{ ['--f' as string]: Math.min(tot, 1) }}
              onClick={(e) => onClick(e, key)}
            >
              <span className="n">{d}</span>
              <span className="amt">{tot ? `${fmtDays(tot)}${tot > 1.0001 ? '!' : ''}` : hname ? 'Hol' : ''}</span>
              <span className="fillbar" />
            </button>
          );
        })}
      </div>

      <div className="legend">
        <span><i style={{ background: 'var(--ok)' }} />1 day logged</span>
        <span><i style={{ background: 'var(--warn)' }} />Partly logged</span>
        <span><i style={{ background: 'var(--bad)' }} />Over 1 day</span>
        <span><i className="holkey" />Holiday</span>
      </div>
      <div className="holnote" id="holNote">{holNote}</div>
    </section>
  );
}
