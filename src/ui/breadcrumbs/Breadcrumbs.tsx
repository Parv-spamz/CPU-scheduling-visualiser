import { useEffect, useState } from 'react';
import { LEVELS, LEVEL_LABEL, NARROW_BREAKPOINT_PX } from '../../scene/layout';
import { useApp } from '../../store/useApp';
import './breadcrumbs.css';

const NARROW_QUERY = `(max-width: ${NARROW_BREAKPOINT_PX - 1}px)`;

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = (): void => setNarrow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

/** Level breadcrumbs (top left): Board › CPU › Core › Results. Every click is manual camera control. */
export default function Breadcrumbs() {
  const level = useApp((s) => s.level);
  const setLevel = useApp((s) => s.setLevel);
  const narrow = useNarrow();

  return (
    <nav className={narrow ? 'breadcrumbs breadcrumbs--compact' : 'breadcrumbs'} aria-label="Zoom level">
      <ol>
        {LEVELS.map((l, i) => {
          const current = l === level;
          return (
            <li key={l}>
              {i > 0 && (
                <span className="breadcrumbs__sep" aria-hidden="true">
                  ›
                </span>
              )}
              <button
                type="button"
                className="breadcrumbs__item"
                aria-current={current ? 'location' : undefined}
                onClick={() => {
                  if (!current) setLevel(l, { manual: true });
                }}
              >
                {LEVEL_LABEL[l]}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
