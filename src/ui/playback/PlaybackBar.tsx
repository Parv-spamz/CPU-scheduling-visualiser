import { useId, useMemo } from 'react';
import { PLAYBACK } from '../../scene/layout';
import { useApp } from '../../store/useApp';
import './playback.css';

const EPS = 1e-6;

function Icon({ d, filled }: { d: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d={d}
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const PLAY = 'M6.5 4.2v11.6a.6.6 0 0 0 .9.5l9-5.8a.6.6 0 0 0 0-1L7.4 3.7a.6.6 0 0 0-.9.5z';
const PAUSE = 'M5.5 4h3v12h-3zM11.5 4h3v12h-3z';
const STEP_BACK = 'M5 4v12M15 4.5L8 10l7 5.5z';
const STEP_FWD = 'M15 4v12M5 4.5L12 10l-7 5.5z';

function formatTick(t: number): string {
  return String(Math.max(0, Math.floor(t + EPS)));
}

/** Slim bottom-centre transport. Only writes to the store; the player reacts to it. */
export default function PlaybackBar() {
  const run = useApp((s) => s.run);
  const playing = useApp((s) => s.playing);
  const speed = useApp((s) => s.speed);
  const progress = useApp((s) => s.progress);
  const seekTo = useApp((s) => s.seekTo);
  const hasErrors = useApp((s) => s.errors.length > 0);
  const togglePlay = useApp((s) => s.togglePlay);
  const pause = useApp((s) => s.pause);
  const seek = useApp((s) => s.seek);
  const setSpeed = useApp((s) => s.setSpeed);
  const speedId = useId();
  const scrubId = useId();

  const { start, end, times } = useMemo(() => {
    if (!run || run.segments.length === 0) return { start: 0, end: 0, times: [] as number[] };
    const s = run.segments[0].start;
    const e = run.segments[run.segments.length - 1].end;
    const ts = Array.from(new Set(run.events.map((ev) => ev.time))).sort((a, b) => a - b);
    return { start: s, end: Math.max(e, s + run.makespan), times: ts };
  }, [run]);

  const disabled = !run || end <= start;
  // Show a pending seek immediately so the controls respond before the player catches up.
  const current = Math.min(end, Math.max(start, seekTo ?? progress));

  const stepTo = (dir: -1 | 1) => {
    pause();
    const target =
      dir < 0 ? [...times].reverse().find((t) => t < current - EPS) ?? start : times.find((t) => t > current + EPS) ?? end;
    seek(target);
  };

  const blocks = useMemo(() => {
    if (!run || end <= start) return [];
    const colour = new Map(run.processes.map((p) => [p.pid, p.color]));
    const span = end - start;
    return run.segments
      .filter((g) => g.pid !== null)
      .map((g) => ({
        key: `${g.pid}-${g.start}`,
        left: ((g.start - start) / span) * 100,
        width: ((g.end - g.start) / span) * 100,
        color: colour.get(g.pid as number) ?? '#888',
      }));
  }, [run, start, end]);

  const speeds = PLAYBACK.speeds.includes(speed) ? PLAYBACK.speeds : [...PLAYBACK.speeds, speed].sort((a, b) => a - b);

  return (
    <div className="ui-bar ui-panel" role="group" aria-label="Playback">
      <button
        type="button"
        className="ui-icon-btn"
        aria-label="Step back to previous event"
        disabled={disabled || current <= start + EPS}
        onClick={() => stepTo(-1)}
      >
        <Icon d={STEP_BACK} filled={false} />
      </button>
      <button
        type="button"
        className="ui-icon-btn ui-play"
        aria-label={playing ? 'Pause' : 'Play'}
        aria-pressed={playing}
        disabled={disabled || (hasErrors && !playing)}
        title={hasErrors ? 'Fix the workload input to play' : undefined}
        onClick={togglePlay}
      >
        <Icon d={playing ? PAUSE : PLAY} filled />
      </button>
      <button
        type="button"
        className="ui-icon-btn"
        aria-label="Step forward to next event"
        disabled={disabled || current >= end - EPS}
        onClick={() => stepTo(1)}
      >
        <Icon d={STEP_FWD} filled={false} />
      </button>

      <label htmlFor={scrubId} className="ui-sr-only">
        Timeline position
      </label>
      <div className="ui-scrub-wrap">
        <div className="ui-gantt" aria-hidden="true">
          {blocks.map((b) => (
            <span key={b.key} style={{ left: `${b.left}%`, width: `${b.width}%`, background: b.color }} />
          ))}
        </div>
        <input
          id={scrubId}
          className="ui-scrub"
          type="range"
          min={start}
          max={end}
          step={0.1}
          value={current}
          disabled={disabled}
          aria-valuetext={`tick ${formatTick(current)} of ${formatTick(end)}`}
          onChange={(e) => seek(Number(e.target.value))}
        />
      </div>

      <output className="ui-readout" htmlFor={scrubId} aria-label="Current tick">
        <span className="ui-readout-t">t</span>
        {formatTick(current)}
        <span className="ui-readout-sep">/</span>
        {formatTick(end)}
      </output>

      <label htmlFor={speedId} className="ui-sr-only">
        Playback speed
      </label>
      <select
        id={speedId}
        className="ui-input ui-select ui-speed"
        value={String(speed)}
        onChange={(e) => setSpeed(Number(e.target.value))}
      >
        {speeds.map((s) => (
          <option key={s} value={String(s)}>
            {s}×
          </option>
        ))}
      </select>
    </div>
  );
}
