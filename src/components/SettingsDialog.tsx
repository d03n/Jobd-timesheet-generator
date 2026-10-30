import { useState } from 'react';
import { useStore } from '../state/store';
import { BOT_HOLIDAYS } from '../lib/holidays';
import { DEFAULT_SETTINGS } from '../lib/storage';
import { clone } from '../lib/ids';
import { Modal } from './Modal';
import { IconButton } from './Icon';
import { OptionSelect } from './Fields';

interface ListEditorProps {
  items: string[];
  label: string;
  onChange: (items: string[]) => void;
  onRename?: (from: string, to: string) => void;
}

/** Editable, reorderable list of names (customers, categories). Renames commit on blur. */
function ListEditor({ items, label, onChange, onRename }: ListEditorProps) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<Record<number, string>>({});
  const { showToast } = useStore();
  const move = (i: number, d: number) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (items.includes(v)) {
      showToast(`${v} is already in the list.`);
      return;
    }
    onChange([...items, v]);
    setDraft('');
  };
  return (
    <div>
      <div className="listed">
        {items.map((v, i) => (
          <div className="lrow" key={`${v}-${i}`}>
            <input
              type="text"
              aria-label={`${label} ${i + 1}`}
              value={editing[i] ?? v}
              onChange={(e) => setEditing({ ...editing, [i]: e.target.value })}
              onBlur={() => {
                const nv = (editing[i] ?? v).trim();
                setEditing({});
                if (!nv || nv === v) return;
                onChange(items.map((x, j) => (j === i ? nv : x)));
                onRename?.(v, nv);
              }}
            />
            <IconButton icon="up" label={`Move ${v} up`} disabled={i === 0} onClick={() => move(i, -1)} />
            <IconButton icon="down" label={`Move ${v} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)} />
            <IconButton icon="trash" label={`Delete ${v}`} danger onClick={() => onChange(items.filter((_, j) => j !== i))} />
          </div>
        ))}
      </div>
      <div className="addrow">
        <input
          type="text"
          placeholder={`New ${label.toLowerCase()}`}
          aria-label={`New ${label.toLowerCase()}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn small" onClick={add}>Add</button>
      </div>
    </div>
  );
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const { settings: st, updateSettings: up } = s;
  const [newHol, setNewHol] = useState({ date: '', name: '' });
  const sources = Object.entries(BOT_HOLIDAYS.sources).map(([y, src]) => `${y} (${src})`).join('; ');

  const text = (label: string, key: 'staffName' | 'titleLeft' | 'titleRight') => (
    <label className="fld">
      <span>{label}</span>
      <input type="text" value={st[key]} onChange={(e) => up((x) => (x[key] = e.target.value))} />
    </label>
  );

  return (
    <Modal open={open} onClose={onClose} labelledBy="setTitle">
      <header className="stickyhead">
        <h2 id="setTitle">Settings</h2>
        <button className="btn primary" type="button" onClick={onClose}>Done</button>
      </header>
      <div className="body">
        <div className="sec">
          <h3>Sheet header</h3>
          <div className="grid2">
            {text('Staff name', 'staffName')}
            <div />
            {text('Title (grey part)', 'titleLeft')}
            {text('Title (black part)', 'titleRight')}
          </div>
        </div>

        <div className="sec">
          <h3>Customers</h3>
          <p className="hint">Feeds the Customer dropdown and the customer rows of the SUMMARY. Renaming a customer also updates your saved entries.</p>
          <ListEditor label="Customer" items={st.customers} onChange={(items) => up((x) => (x.customers = items))} onRename={(a, b) => s.renameEverywhere('cust', a, b)} />
        </div>

        <div className="sec">
          <h3>Categories</h3>
          <p className="hint">Feeds the Category dropdown. The list is also written (hidden) below the summary in the Excel file, so the dropdown works there too.</p>
          <ListEditor
            label="Category"
            items={st.categories}
            onChange={(items) => up((x) => (x.categories = items))}
            onRename={(a, b) => {
              s.renameEverywhere('cat', a, b);
              up((x) => x.leaves.forEach((l) => l.category === a && (l.category = b)));
            }}
          />
        </div>

        <div className="sec">
          <h3>Leave rows in the summary</h3>
          <p className="hint">Each row totals the days for one category (=SUMIF on Category). Those days are subtracted from the customer rows, exactly like the original sheet does for A/L and M/L.</p>
          <div className="listed">
            {st.leaves.map((l, i) => (
              <div className="lrow leave" key={i}>
                <input type="text" aria-label="Summary row label" value={l.label} onChange={(e) => up((x) => (x.leaves[i].label = e.target.value))} />
                <OptionSelect aria-label={`Category for ${l.label || 'leave row'}`} value={l.category} options={st.categories} onValue={(v) => up((x) => (x.leaves[i].category = v))} />
                <IconButton icon="trash" label={`Delete summary row ${l.label}`} danger onClick={() => up((x) => x.leaves.splice(i, 1))} />
              </div>
            ))}
          </div>
          <div className="addrow">
            <button type="button" className="btn small" onClick={() => up((x) => x.leaves.push({ label: 'New leave', category: '' }))}>Add summary row</button>
          </div>
        </div>

        <div className="sec">
          <h3>Public holidays</h3>
          <p className="hint">Built in from the Bank of Thailand’s official financial institutions’ holiday notifications: {sources}. Holidays show on the calendar and are written as grey rows in the sheet (unless you log work that day).</p>
          <label className="check"><input type="checkbox" checked={st.useBotHolidays} onChange={(e) => up((x) => (x.useBotHolidays = e.target.checked))} /> Use Bank of Thailand holidays</label>
          <label className="check" style={{ marginTop: 6 }}><input type="checkbox" checked={st.botBangkok} onChange={(e) => up((x) => (x.botBangkok = e.target.checked))} /> Include Bangkok-only special holidays (e.g. 16 Oct 2026)</label>
          <a href="https://www.bot.or.th/en/financial-institutions-holiday.html" target="_blank" rel="noopener noreferrer" className="hint" style={{ display: 'inline-block', margin: '8px 0' }}>Check the latest list on bot.or.th</a>
          <div className="fld">
            <span>Custom holidays</span>
            <div className="listed">
              {[...st.customHolidays].sort((a, b) => a.date.localeCompare(b.date)).map((c) => {
                const idx = st.customHolidays.indexOf(c);
                return (
                  <div className="lrow leave" key={`${c.date}-${idx}`}>
                    <input type="date" aria-label="Holiday date" value={c.date} onChange={(e) => e.target.value && up((x) => (x.customHolidays[idx].date = e.target.value))} />
                    <input type="text" aria-label="Holiday name" value={c.name} onChange={(e) => up((x) => (x.customHolidays[idx].name = e.target.value))} />
                    <IconButton icon="trash" label={`Delete holiday ${c.name}`} danger onClick={() => up((x) => x.customHolidays.splice(idx, 1))} />
                  </div>
                );
              })}
            </div>
            <div className="addrow">
              <input type="date" aria-label="New holiday date" value={newHol.date || `${s.curYM}-01`} onChange={(e) => setNewHol({ ...newHol, date: e.target.value })} />
              <input type="text" placeholder="Holiday name" aria-label="New holiday name" value={newHol.name} onChange={(e) => setNewHol({ ...newHol, name: e.target.value })} />
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  const date = newHol.date || `${s.curYM}-01`;
                  up((x) => x.customHolidays.push({ date, name: newHol.name.trim() || 'Holiday' }));
                  setNewHol({ date: '', name: '' });
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="sec">
          <h3>Rows</h3>
          <div className="grid2">
            <label className="fld">
              <span>Blank rows before TOTAL (for later edits in Excel)</span>
              <input type="number" min={0} max={50} style={{ maxWidth: 110 }} value={st.spareRows} onChange={(e) => up((x) => (x.spareRows = Math.max(0, Math.min(50, parseInt(e.target.value, 10) || 0))))} />
            </label>
            <label className="check"><input type="checkbox" checked={st.includeWeekdays} onChange={(e) => up((x) => (x.includeWeekdays = e.target.checked))} /> List every weekday, even without entries</label>
          </div>
        </div>

        <div className="sec">
          <h3>Reset</h3>
          <button
            type="button"
            className="btn small"
            onClick={() =>
              s.ask({
                title: 'Restore default lists?',
                msg: 'Customers, categories and leave rows go back to the defaults. Your entries stay.',
                yesLabel: 'Restore',
                onYes: () =>
                  up((x) => {
                    const d = clone(DEFAULT_SETTINGS);
                    x.customers = d.customers;
                    x.categories = d.categories;
                    x.leaves = d.leaves;
                  }),
              })
            }
          >
            Restore default lists
          </button>
        </div>
      </div>
    </Modal>
  );
}
