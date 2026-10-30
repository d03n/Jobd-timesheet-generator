import { useRef, type ChangeEvent, type KeyboardEvent } from 'react';
import { useStore } from '../state/store';
import { monthLabel, plural } from '../lib/dates';
import { Icon } from './Icon';

interface HeaderProps {
  busy: boolean;
  onDownload: () => void;
  onSettings: () => void;
}

export function Header({ busy, onDownload, onSettings }: HeaderProps) {
  const s = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const [{ default: Excel }, { importTimesheet }] = await Promise.all([import('exceljs'), import('../lib/importer')]);
      const res = await importTimesheet(Excel, await file.arrayBuffer(), s.settings);
      const apply = () => {
        s.replaceMonth(res.ym, { days: res.days });
        if (res.customers.length || res.categories.length || (res.staff && !s.settings.staffName)) {
          s.updateSettings((st) => {
            st.customers.push(...res.customers);
            st.categories.push(...res.categories);
            if (res.staff && !st.staffName) st.staffName = res.staff;
          });
        }
        s.goMonth(res.ym);
        s.showToast(`Imported ${plural(res.count, 'entry', 'entries')} for ${monthLabel(res.ym)}.`);
      };
      const existing = Object.values(s.months[res.ym]?.days ?? {}).some((d) => d.records.length || d.holiday);
      if (existing) {
        s.ask({
          title: `Replace ${monthLabel(res.ym)}?`,
          msg: `This file has ${plural(res.count, 'entry', 'entries')}. They’ll replace what you’ve already entered for that month.`,
          yesLabel: 'Replace',
          onYes: apply,
        });
      } else apply();
    } catch (err) {
      s.showToast(`Couldn’t read that file. ${err instanceof Error ? err.message : 'Use a timesheet in the Job-D format (.xlsx).'}`);
    }
  }

  const onImportKey = (e: KeyboardEvent<HTMLLabelElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileRef.current?.click();
    }
  };

  return (
    <>
      <a className="skip" href="#editor">Skip to entries</a>
      <header className="bar">
        <div className="brand">
          <h1>Job-D timesheet</h1>
          <small>
            <span>{s.settings.staffName ? `Staff: ${s.settings.staffName}` : 'Staff name not set — open Settings'}</span>{' '}
            <span className="sync" role="status" aria-live="polite">{s.saveStatus}</span>
          </small>
        </div>
        <div className="actions">
          <label className="btn" htmlFor="importFile" tabIndex={0} id="importLbl" title="Import an existing Job-D .xlsx" aria-label="Import .xlsx" onKeyDown={onImportKey}>
            <Icon name="upload" />
            <span>Import</span>
          </label>
          <input ref={fileRef} type="file" id="importFile" accept=".xlsx" className="sr" tabIndex={-1} onChange={onFile} />
          <button className="btn" id="openSettings" type="button" aria-label="Settings" onClick={onSettings}>
            <Icon name="settings" />
            <span>Settings</span>
          </button>
          <button className="btn primary" id="download" type="button" onClick={onDownload} disabled={busy} aria-busy={busy}>
            {busy ? <span className="spin" aria-hidden="true" /> : <Icon name="download" />}
            <span id="dlLabel">{busy ? 'Preparing…' : 'Download'}</span>
          </button>
        </div>
      </header>
    </>
  );
}
