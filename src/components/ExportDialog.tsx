import { useEffect, useState } from 'react';
import type { ExportFormat } from '../types';
import { useStore } from '../state/store';
import { plural } from '../lib/dates';
import type { ExportRequest } from '../lib/exporter';
import { mergeMonths, monthPeriod, periodLabel, periodLength, periodMonths, splitByMonth, type ExportLayout, type Period } from '../lib/sheet';
import { Modal } from './Modal';
import { Icon } from './Icon';

type Mode = 'all' | 'entries' | 'selected';
type PeriodMode = 'month' | 'range';

/** Longest range one export may cover. */
const MAX_DAYS = 366;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (req: ExportRequest) => void;
  onPreview: (req: ExportRequest) => void;
}

function rangeError(start: string, end: string): string {
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) return 'Enter both a start and an end date.';
  if (start > end) return 'The end date is before the start date. Swap them, or pick a later end date.';
  if (periodLength({ start, end }) > MAX_DAYS) return `The range is longer than ${MAX_DAYS} days. Pick a shorter range, or export it in parts.`;
  return '';
}

export function ExportDialog({ open, onClose, onExport, onPreview }: ExportDialogProps) {
  const s = useStore();
  const [fmt, setFmt] = useState<ExportFormat>('xlsx');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [layout, setLayout] = useState<ExportLayout>('per-month');
  const [lastMode, setLastMode] = useState<Mode>('all');
  const [mode, setMode] = useState<Mode>('all');

  const isRange = periodMode === 'range';
  const err = isRange ? rangeError(start, end) : '';
  const period: Period = isRange && !err ? { start, end } : monthPeriod(s.curYM);
  // With an invalid range, don't describe the month on screen as if it were what gets exported.
  const label = isRange && err ? 'the chosen range' : periodLabel(period);

  const inScope = isRange && err ? {} : mergeMonths(s.months, period).days;
  const filled = Object.keys(inScope).filter((k) => inScope[k].records.length > 0).sort();
  const sel = isRange ? null : s.scopeKeys;
  const span = isRange ? 'period' : 'month';

  const opts: { id: Mode; title: string; desc: string; keys: string[] | null; suffix: string; disabled?: boolean }[] = [
    { id: 'all', title: `Whole ${span}`, desc: `Every weekday of ${label}, plus holidays and days with entries.`, keys: null, suffix: '' },
    {
      id: 'entries',
      title: 'Only days with entries',
      desc: filled.length ? `${plural(filled.length, 'day')} you’ve added work to. Empty days and holiday rows are left out.` : `No days with entries in ${label} yet.`,
      keys: filled,
      suffix: '_entries',
      disabled: !filled.length,
    },
  ];
  if (sel) opts.push({ id: 'selected', title: 'Selected days only', desc: `${plural(sel.length, 'day')} selected on the calendar. 100% = these days.`, keys: sel, suffix: '_selected' });
  const chosen = opts.find((o) => o.id === mode && !o.disabled) ?? opts[0];

  // Selected days can span months: then export from the first selected month to the last.
  const outPeriod: Period =
    chosen.id === 'selected' && sel ? { start: monthPeriod(sel[0].slice(0, 7)).start, end: monthPeriod(sel[sel.length - 1].slice(0, 7)).end } : period;
  const multiMonth = !err && periodMonths(outPeriod).length > 1;
  const pieces = multiMonth ? splitByMonth(outPeriod) : [];

  useEffect(() => {
    if (!open) return;
    // Keep the last range only while it still touches the month on screen; otherwise start from that month.
    const stale = !DATE_RE.test(start) || !DATE_RE.test(end) || start > end || !periodMonths({ start, end }).includes(s.curYM);
    if (stale) {
      const mp = monthPeriod(s.curYM);
      setStart(mp.start);
      setEnd(mp.end);
      setPeriodMode('month');
    }
    if (s.scopeKeys) setPeriodMode('month');
    setMode(s.scopeKeys ? 'selected' : lastMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const request = (): ExportRequest | null => {
    if (err) return null;
    if (chosen.id !== 'selected') setLastMode(chosen.id);
    onClose();
    return { fmt, period: outPeriod, only: chosen.keys, layout: multiMonth ? layout : 'combined', suffix: chosen.suffix };
  };
  const go = () => {
    const r = request();
    if (r) onExport(r);
  };
  const preview = () => {
    const r = request();
    if (r) onPreview(r);
  };

  const sheetWord = fmt === 'pdf' ? 'section' : 'sheet';

  return (
    <Modal open={open} onClose={onClose} labelledBy="exTitle" narrow>
      <header><h2 id="exTitle">{isRange && err ? 'Download a date range' : `Download ${periodLabel(outPeriod)}`}</h2></header>
      <div className="body">
        <fieldset className="seg" id="exFmt">
          <legend className="exlegend">Format</legend>
          <label><input type="radio" name="exfmt" value="xlsx" checked={fmt === 'xlsx'} onChange={() => setFmt('xlsx')} /><span>Excel (.xlsx)</span></label>
          <label><input type="radio" name="exfmt" value="pdf" checked={fmt === 'pdf'} onChange={() => setFmt('pdf')} /><span>PDF</span></label>
        </fieldset>

        <div className="exgroup">
          <fieldset className="seg" id="exPeriod">
            <legend className="exlegend">Period</legend>
            <label><input type="radio" name="experiod" value="month" checked={!isRange} onChange={() => setPeriodMode('month')} /><span>This month</span></label>
            <label><input type="radio" name="experiod" value="range" checked={isRange} onChange={() => setPeriodMode('range')} /><span>Date range</span></label>
          </fieldset>
          {isRange && (
            <div className="exrange">
              <label className="fld">
                <span>From</span>
                <input type="date" value={start} max={end || undefined} aria-invalid={!!err} aria-describedby="exRangeHelp" onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="fld">
                <span>To</span>
                <input type="date" value={end} min={start || undefined} aria-invalid={!!err} aria-describedby="exRangeHelp" onChange={(e) => setEnd(e.target.value)} />
              </label>
              <p id="exRangeHelp" className={`exhelp${err ? ' bad' : ''}`} role={err ? 'alert' : undefined}>
                {err || `${plural(periodLength(period), 'day')}. For a cut-off period, e.g. 21 Oct to 20 Nov.`}
              </p>
            </div>
          )}
        </div>

        {multiMonth && (
          <fieldset className="exopts" id="exLayout">
            <legend className="exlegend">Layout</legend>
            <label className="exopt">
              <input type="radio" name="exlayout" value="per-month" checked={layout === 'per-month'} onChange={() => setLayout('per-month')} />
              <span>
                <b>One {sheetWord} per month</b>
                <small>{pieces.map(periodLabel).join(', ')} — each with its own TOTAL and SUMMARY{fmt === 'pdf' ? ', starting on a new page' : ''}.</small>
              </span>
            </label>
            <label className="exopt">
              <input type="radio" name="exlayout" value="combined" checked={layout === 'combined'} onChange={() => setLayout('combined')} />
              <span>
                <b>One combined {sheetWord}</b>
                <small>All days in one {sheetWord}. TOTAL and SUMMARY cover the whole period.</small>
              </span>
            </label>
          </fieldset>
        )}

        <fieldset className="exopts" id="exOpts">
          <legend className="exlegend">Days to include</legend>
          {opts.map((o) => (
            <label key={o.id} className={`exopt${o.disabled ? ' disabled' : ''}`}>
              <input type="radio" name="exmode" value={o.id} disabled={o.disabled} checked={chosen.id === o.id} onChange={() => setMode(o.id)} />
              <span><b>{o.title}</b><small>{o.desc}</small></span>
            </label>
          ))}
        </fieldset>
      </div>
      <footer>
        <button className="btn" type="button" id="exNo" onClick={onClose}>Cancel</button>
        {fmt === 'pdf' && (
          <button className="btn" type="button" id="exPreview" onClick={preview} disabled={!!err}>
            <Icon name="eye" />
            Preview
          </button>
        )}
        <button className="btn primary" type="button" id="exGo" onClick={go} disabled={!!err}>Download</button>
      </footer>
    </Modal>
  );
}
