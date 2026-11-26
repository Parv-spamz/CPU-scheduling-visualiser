import { useEffect, useState } from 'react';

const LINES = [
  'Tidying the bed',
  'Untangling the headphones',
  'Hunting for a charger that works',
  'Turning the desk lamp on',
  'Plugging the board in, gently',
  'Smoothing out the duvet',
];

/** A sleepy chip with a name for the wait: blinks, yawns, wakes up when the scene is ready. */
function Chip({ awake }: { awake: boolean }) {
  return (
    <svg className="boot-art" viewBox="0 0 96 96" width="96" height="96" aria-hidden="true" focusable="false" data-awake={awake}>
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        {[26, 38, 50, 62, 74].map((v) => (
          <g key={v}>
            <path d={`M${v} 14v10M${v} 72v10`} />
            <path d={`M14 ${v}h10M72 ${v}h10`} />
          </g>
        ))}
      </g>
      <rect x="24" y="24" width="48" height="48" rx="10" fill="var(--boot-chip)" stroke="currentColor" strokeWidth="3" />
      <g className="boot-eyes" fill="currentColor">
        <ellipse cx="39" cy="46" rx="4" ry="5" />
        <ellipse cx="57" cy="46" rx="4" ry="5" />
      </g>
      <path className="boot-mouth" d="M42 58q6 5 12 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Loading screen shown until the scene has rendered its first frames. */
export default function Boot({ ready }: { ready: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (ready) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % LINES.length), 1700);
    return () => window.clearInterval(id);
  }, [ready]);

  return (
    <div className="boot" data-ready={ready} aria-hidden={ready}>
      <Chip awake={ready} />
      <h1 className="boot-title">Setting up my room</h1>
      <p className="boot-line" aria-hidden="true">
        {LINES[i]}
      </p>
      <span className="ui-sr-only" role="status">
        Loading the scene
      </span>
    </div>
  );
}
