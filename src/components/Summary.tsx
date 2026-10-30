import { useStore } from '../state/store';
import { computeSheet } from '../lib/sheet';
import { fmtDays, fmtPct, fmtShort, plural, round3 } from '../lib/dates';

export function Summary() {
  const { settings, curYM, month, viewScope, isMulti } = useStore();
  const data = computeSheet(settings, curYM, month, viewScope);
  const shown = data.summary.filter((r) => r.days > 0);
  const leaveCats = settings.leaves.map((l) => l.category);
  const accounted = round3(data.summary.reduce((a, r) => a + r.days, 0));
  const missing = data.rows.filter((r) => r.rec && Number(r.rec.days) > 0 && (!r.rec.cat || (!r.rec.cust && !leaveCats.includes(r.rec.cat)))).length;

  const warnings: string[] = [];
  if (Math.abs(accounted - data.total) > 0.0001)
    warnings.push(`${fmtDays(round3(data.total - accounted))} days aren’t counted in any summary row (customer not in the list, or a leave category without a summary row).`);
  if (missing) warnings.push(`${plural(missing, 'entry is', 'entries are')} missing a category or customer.`);

  const scopeLabel = !viewScope ? 'whole month' : isMulti ? plural(viewScope.length, 'selected day') : fmtShort(viewScope[0]);
  const note = warnings.length
    ? warnings.join(' ')
    : !viewScope
      ? 'Whole month = 100%. Same figures as the SUMMARY formulas in the exported file.'
      : !isMulti
        ? 'This day = 100%. Open the Table tab for the whole month.'
        : 'Only the selected days count toward 100%. Export them as their own sheet with “Selected days only”.';

  return (
    <section className="panel sumpanel" aria-label="Summary">
      <div className="sumhead">
        <h2>Summary <small id="sumScope">{scopeLabel}</small></h2>
        <span>Total <b id="sumTotal">{fmtDays(data.total)}</b> days</span>
      </div>
      <div className="sumrows">
        {!shown.length && <div className="sumnote" style={{ padding: '10px 0' }}>Nothing logged here yet. Pick a day on the calendar to start.</div>}
        {shown.map((r) => (
          <div key={r.name} className={`srow${r.leave ? ' leave' : ''}`}>
            <span className="nm">{r.name}</span>
            <span className="v">{fmtDays(r.days)}</span>
            <span className="p">{fmtPct(r.days, data.total)}</span>
            <div className="track"><span style={{ width: `${data.total > 0 ? (r.days / data.total) * 100 : 0}%` }} /></div>
          </div>
        ))}
      </div>
      <div className={`sumnote${warnings.length ? ' warn' : ''}`}>{note}</div>
    </section>
  );
}
