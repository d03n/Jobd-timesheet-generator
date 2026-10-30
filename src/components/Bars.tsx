import { useStore } from '../state/store';
import { useActions } from '../state/actions';
import { plural } from '../lib/dates';

/** Shows what's on the in-app clipboard. */
export function ClipBar() {
  const { clip, setClip } = useStore();
  if (!clip.length) return null;
  const first = clip[0].desc || '(no description)';
  return (
    <div className="clipbar">
      <span className="cliplabel">Copied</span>
      <span className="cliptext">{clip.length === 1 ? first : `${clip.length} entries — ${first}`}</span>
      <button type="button" className="btn small quiet" onClick={() => setClip([])}>Clear</button>
    </div>
  );
}

/** Appears when entries are ticked: copy / delete several at once. */
export function CheckBar({ visibleIds }: { visibleIds: string[] }) {
  const { checked, setChecked, month } = useStore();
  const { deleteChecked, copyEntries } = useActions();
  const recs = Object.keys(month.days).sort().flatMap((k) => month.days[k].records.filter((r) => checked.has(r.id)));
  if (!recs.length) return null;
  return (
    <div className="checkbar" id="checkbar">
      <span className="checkcount">{plural(recs.length, 'entry', 'entries')} selected</span>
      <button type="button" className="btn small" onClick={() => setChecked(new Set([...checked, ...visibleIds]))}>Select all shown</button>
      <button type="button" className="btn small" onClick={() => copyEntries(recs, plural(recs.length, 'entry', 'entries'))}>Copy</button>
      <button type="button" className="btn small danger" onClick={deleteChecked}>Delete {recs.length}</button>
      <button type="button" className="btn small quiet2" onClick={() => setChecked(new Set())}>Cancel</button>
    </div>
  );
}
