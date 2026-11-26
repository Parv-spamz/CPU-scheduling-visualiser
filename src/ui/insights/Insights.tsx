import { useEffect, useState } from 'react';
import { ALGORITHMS, ALGORITHM_LABEL } from '../../engine/types';
import { useApp } from '../../store/useApp';
import './insights.css';

const f1 = (n: number): string => (Number.isFinite(n) ? n.toFixed(1) : '–');

/** Live numbers for the current run and a one-click comparison of all four algorithms by average waiting time. */
export default function Insights() {
  const run = useApp((s) => s.run);
  const compare = useApp((s) => s.compare);
  const algorithm = useApp((s) => s.settings.algorithm);
  const setAlgorithm = useApp((s) => s.setAlgorithm);
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 900px)').matches);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() !== 'i' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('input, select, textarea, button, a[href], [contenteditable="true"]')) return;
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!run || !compare) return null;
  const waits = ALGORITHMS.map((a) => compare.runs[a].averages.waiting);
  const max = Math.max(...waits, 0.0001);
  const a = run.averages;

  return (
    <aside className="ui-insights ui-panel" data-open={open} aria-label="Run insights">
      <button type="button" className="ui-insights-head" aria-expanded={open} aria-controls="ui-insights-body" onClick={() => setOpen((o) => !o)} title="Toggle insights (I)">
        <span>Insights</span>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
          <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id="ui-insights-body" className="ui-insights-body" hidden={!open}>
        <dl className="ui-insights-stats">
          <div>
            <dt>Avg wait</dt>
            <dd>{f1(a.waiting)}</dd>
          </div>
          <div>
            <dt>Turnaround</dt>
            <dd>{f1(a.turnaround)}</dd>
          </div>
          <div>
            <dt>Response</dt>
            <dd>{f1(a.response)}</dd>
          </div>
          <div>
            <dt>CPU busy</dt>
            <dd>{Math.round(run.utilisation * 100)}%</dd>
          </div>
          <div>
            <dt>Switches</dt>
            <dd>{run.contextSwitches}</dd>
          </div>
        </dl>
        <p className="ui-insights-sub">Average wait by algorithm</p>
        <ul className="ui-insights-rows">
          {ALGORITHMS.map((id, i) => (
            <li key={id}>
              <button type="button" className="ui-insights-row" aria-pressed={algorithm === id} onClick={() => setAlgorithm(id)}>
                <span className="ui-insights-name">
                  {ALGORITHM_LABEL[id]}
                  {compare.winner === id && <span className="ui-insights-best">best</span>}
                </span>
                <span className="ui-insights-bar" aria-hidden="true">
                  <i style={{ width: `${Math.max(4, (waits[i]! / max) * 100)}%` }} />
                </span>
                <span className="ui-insights-val">{f1(waits[i]!)}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="ui-insights-reason">{compare.reason}</p>
      </div>
    </aside>
  );
}
