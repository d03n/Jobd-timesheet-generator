import { useEffect, useState } from 'react';
import type { ExportFormat } from '../types';
import { useStore } from '../state/store';
import { monthLabel, plural } from '../lib/dates';
import { Modal } from './Modal';

type Mode = 'month' | 'entries' | 'selected';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (fmt: ExportFormat, only: string[] | null, suffix: string) => void;
}

export function ExportDialog({ open, onClose, onExport }: ExportDialogProps) {
  const s = useStore();
  const [fmt, setFmt] = useState<ExportFormat>('xlsx');
  const [lastMode, setLastMode] = useState<Mode>('month');
  const [mode, setMode] = useState<Mode>('month');
  const label = monthLabel(s.curYM);
  const filled = Object.keys(s.month.days).filter((k) => s.month.days[k].records.length > 0).sort();
  const sel = s.scopeKeys;

  const opts: { id: Mode; title: string; desc: string; keys: string[] | null; suffix: string; disabled?: boolean }[] = [
    { id: 'month', title: 'Whole month', desc: `Every weekday of ${label}, plus holidays and days with entries.`, keys: null, suffix: '' },
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

  useEffect(() => {
    if (!open) return;
    const want: Mode = sel ? 'selected' : lastMode;
    setMode(opts.some((o) => o.id === want && !o.disabled) ? want : 'month');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const go = () => {
    const o = opts.find((x) => x.id === mode) ?? opts[0];
    if (o.id !== 'selected') setLastMode(o.id);
    onClose();
    onExport(fmt, o.keys, o.suffix);
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="exTitle" narrow>
      <header><h2 id="exTitle">Download {label}</h2></header>
      <div className="body">
        <fieldset className="seg" id="exFmt">
          <legend className="exlegend">Format</legend>
          <label><input type="radio" name="exfmt" value="xlsx" checked={fmt === 'xlsx'} onChange={() => setFmt('xlsx')} /><span>Excel (.xlsx)</span></label>
          <label><input type="radio" name="exfmt" value="pdf" checked={fmt === 'pdf'} onChange={() => setFmt('pdf')} /><span>PDF</span></label>
        </fieldset>
        <fieldset className="exopts" id="exOpts">
          <legend className="exlegend">Days to include</legend>
          {opts.map((o) => (
            <label key={o.id} className={`exopt${o.disabled ? ' disabled' : ''}`}>
              <input type="radio" name="exmode" value={o.id} disabled={o.disabled} checked={mode === o.id} onChange={() => setMode(o.id)} />
              <span><b>{o.title}</b><small>{o.desc}</small></span>
            </label>
          ))}
        </fieldset>
      </div>
      <footer>
        <button className="btn" type="button" id="exNo" onClick={onClose}>Cancel</button>
        <button className="btn primary" type="button" id="exGo" onClick={go}>Download</button>
      </footer>
    </Modal>
  );
}
