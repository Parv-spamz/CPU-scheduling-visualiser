import { useEffect, useRef, useState } from 'react';
import './help.css';

const ROWS: [string, string][] = [
  ['Space', 'Play or pause'],
  ['← →', 'Step to the previous or next event'],
  ['1 – 4', 'FCFS, SJF, Priority, Round Robin'],
  ['[  ]', 'Slower or faster playback'],
  ['D', 'Open or close the workload drawer'],
  ['F', 'Follow the running process'],
  ['I', 'Show or hide insights'],
  ['R', 'Reset the camera view'],
  ['Esc', 'Zoom out one level'],
  ['Mouse', 'Drag orbits, wheel zooms, right-drag pans'],
];

/** A small question-mark button and a glass sheet that lists every shortcut. Press ? to open it. */
export default function Help() {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        btn.current?.focus();
        e.stopPropagation();
        return;
      }
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('input, select, textarea, [contenteditable="true"]')) return;
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  return (
    <>
      <button ref={btn} type="button" className="ui-help-btn ui-panel" aria-label="Keyboard shortcuts" aria-expanded={open} aria-controls="ui-help-sheet" title="Shortcuts (?)" onClick={() => setOpen((o) => !o)}>
        ?
      </button>
      <section id="ui-help-sheet" className="ui-help ui-panel" role="dialog" aria-label="Keyboard shortcuts" hidden={!open}>
        <h2>Shortcuts</h2>
        <dl>
          {ROWS.map(([k, v]) => (
            <div key={k}>
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
