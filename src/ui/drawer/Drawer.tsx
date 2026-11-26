import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { presets, toCsv } from '../../engine';
import { ALGORITHMS } from '../../engine/types';
import type { ValidationError } from '../../engine/types';
import { NARROW_BREAKPOINT_PX } from '../../scene/layout';
import { useApp } from '../../store/useApp';
import './drawer.css';

const MAX_PROCESSES = 12;

/** Parse a draft string; blank or malformed input becomes NaN so validation can report it. */
function parseDraft(draft: string): number {
  return draft.trim() === '' ? Number.NaN : Number(draft);
}

function sameNumber(a: number, b: number): boolean {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

function isNarrow(): boolean {
  return typeof window !== 'undefined' && window.innerWidth < NARROW_BREAKPOINT_PX;
}

interface NumberFieldProps {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  invalid?: boolean;
  describedBy?: string;
  min?: number;
  className?: string;
  hideLabel?: boolean;
}

/** Number input that keeps its own draft string so typing never fights the store. */
function NumberField({ label, value, onCommit, invalid, describedBy, min, className, hideLabel }: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(() => (Number.isNaN(value) ? '' : String(value)));

  useEffect(() => {
    setDraft((d) => (sameNumber(parseDraft(d), value) ? d : Number.isNaN(value) ? '' : String(value)));
  }, [value]);

  return (
    <span className={className}>
      <label htmlFor={id} className={hideLabel ? 'ui-sr-only' : 'ui-field-label'}>
        {label}
      </label>
      <input
        id={id}
        className="ui-input ui-num"
        type="number"
        step={1}
        min={min}
        inputMode="numeric"
        value={draft}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          const n = parseDraft(next);
          if (!sameNumber(n, value)) onCommit(n);
        }}
      />
    </span>
  );
}

function ErrorList({ errors, id }: { errors: ValidationError[]; id?: string }) {
  if (errors.length === 0) return null;
  return (
    <ul className="ui-errors" id={id}>
      {errors.map((e, i) => (
        <li key={`${e.field}-${e.pid ?? 'x'}-${i}`}>{e.message}</li>
      ))}
    </ul>
  );
}

function WorkloadIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <path d="M4 5h12M4 10h12M4 15h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Collapsible workload editor: left panel on desktop, bottom sheet on narrow screens. */
export default function Drawer() {
  const open = useApp((s) => s.drawerOpen);
  const setOpen = useApp((s) => s.setDrawerOpen);
  const workload = useApp((s) => s.workload);
  const settings = useApp((s) => s.settings);
  const errors = useApp((s) => s.errors);
  const level = useApp((s) => s.level);
  const playing = useApp((s) => s.playing);
  const updateProcess = useApp((s) => s.updateProcess);
  const addProcess = useApp((s) => s.addProcess);
  const removeProcess = useApp((s) => s.removeProcess);
  const loadPreset = useApp((s) => s.loadPreset);
  const randomize = useApp((s) => s.randomize);
  const setSettings = useApp((s) => s.setSettings);
  const followCore = useApp((s) => s.followCore);
  const setFollowCore = useApp((s) => s.setFollowCore);
  const compare = useApp((s) => s.compare);
  const [shareStatus, setShareStatus] = useState('');

  const downloadCsv = () => {
    if (!compare) return;
    const csv = ALGORITHMS.map((a) => toCsv(compare.runs[a])).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scheduling-results.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus('Link copied');
    } catch {
      setShareStatus('Copy the address bar to share this run');
    }
    window.setTimeout(() => setShareStatus(''), 2500);
  };

  const [presetId, setPresetId] = useState(() => presets[0]?.id ?? '');
  const [seedDraft, setSeedDraft] = useState('42');
  const [sizeDraft, setSizeDraft] = useState('6');

  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);
  const titleId = useId();
  const topErrorsId = useId();

  // Move focus into the drawer when it opens and back to the tab when it closes.
  useEffect(() => {
    if (open && !wasOpen.current) closeRef.current?.focus();
    if (!open && wasOpen.current && document.activeElement instanceof HTMLElement) {
      if (document.activeElement.closest('.ui-drawer')) toggleRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  // Get out of the way when the camera dives into the CPU, so the drawer never hides the die.
  const prevLevel = useRef(level);
  useEffect(() => {
    const entering = (level === 'L1' || level === 'L2') && prevLevel.current !== level;
    prevLevel.current = level;
    if (entering) setOpen(false);
  }, [level, setOpen]);

  // On phones the sheet covers the scene, so close it once playback starts.
  useEffect(() => {
    if (playing && isNarrow()) setOpen(false);
  }, [playing, setOpen]);

  const pids = new Set(workload.map((p) => p.pid));
  const topErrors = errors.filter((e) => e.pid === null || !pids.has(e.pid));
  const quantumInvalid = errors.some((e) => e.field === 'quantum');
  const preset = presets.find((p) => p.id === presetId) ?? presets[0];

  const seed = parseDraft(seedDraft);
  const size = parseDraft(sizeDraft);
  const randomValid = Number.isInteger(seed) && Number.isInteger(size) && size >= 1 && size <= MAX_PROCESSES;
  const atMax = workload.length >= MAX_PROCESSES;

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className="ui-drawer-tab"
        aria-expanded={open}
        aria-controls="workload-drawer"
        hidden={open}
        onClick={() => setOpen(true)}
      >
        <WorkloadIcon />
        <span className="ui-drawer-tab-label">Workload</span>
      </button>

      <aside
        id="workload-drawer"
        className="ui-drawer ui-panel"
        data-open={open}
        data-camera-ignore=""
        aria-labelledby={titleId}
        inert={!open}
        onKeyDown={onKeyDown}
      >
        <header className="ui-drawer-head">
          <h2 id={titleId} className="ui-drawer-title">
            Workload
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="ui-icon-btn"
            aria-label="Close workload drawer"
            onClick={() => setOpen(false)}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="ui-drawer-body">
          {errors.length > 0 && (
            <div className="ui-error-banner" role="alert" id={topErrorsId}>
              <p className="ui-error-lead">Fix the input to re-run. The board keeps showing the last valid run.</p>
              <ErrorList errors={topErrors} />
            </div>
          )}

          <section className="ui-section" aria-label="Presets and random workload">
            <div className="ui-row-inline">
              <label className="ui-field-label" htmlFor="ui-preset">
                Preset
              </label>
              <select
                id="ui-preset"
                className="ui-input ui-select"
                value={preset?.id ?? ''}
                disabled={presets.length === 0}
                onChange={(e) => setPresetId(e.target.value)}
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="ui-btn"
                disabled={!preset}
                onClick={() => preset && loadPreset(preset.id)}
              >
                Load
              </button>
            </div>
            {preset && <p className="ui-hint">{preset.description}</p>}

            <div className="ui-row-inline ui-random">
              <span className="ui-field-label">Random</span>
              <span className="ui-mini-field">
                <label htmlFor="ui-seed" className="ui-mini-label">
                  seed
                </label>
                <input
                  id="ui-seed"
                  className="ui-input ui-num"
                  type="number"
                  step={1}
                  inputMode="numeric"
                  value={seedDraft}
                  aria-invalid={!Number.isInteger(seed) || undefined}
                  onChange={(e) => setSeedDraft(e.target.value)}
                />
              </span>
              <span className="ui-mini-field">
                <label htmlFor="ui-size" className="ui-mini-label">
                  size
                </label>
                <input
                  id="ui-size"
                  className="ui-input ui-num"
                  type="number"
                  step={1}
                  min={1}
                  max={MAX_PROCESSES}
                  inputMode="numeric"
                  value={sizeDraft}
                  aria-invalid={!(Number.isInteger(size) && size >= 1 && size <= MAX_PROCESSES) || undefined}
                  onChange={(e) => setSizeDraft(e.target.value)}
                />
              </span>
              <button
                type="button"
                className="ui-btn"
                disabled={!randomValid}
                onClick={() => randomValid && randomize(seed, size)}
              >
                Generate
              </button>
            </div>
            {!randomValid && <p className="ui-hint ui-hint-warn">Seed must be a whole number and size 1 to 12.</p>}
          </section>

          <section className="ui-section" aria-label="Processes">
            <table className="ui-proc-table">
              <thead hidden={workload.length === 0}>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Arrival</th>
                  <th scope="col">Burst</th>
                  <th scope="col">Priority</th>
                  <th scope="col">
                    <span className="ui-sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {workload.map((p) => {
                  const rowErrors = errors.filter((e) => e.pid === p.pid);
                  const errId = `proc-err-${p.pid}`;
                  const has = (field: ValidationError['field']) => rowErrors.some((e) => e.field === field);
                  const describedBy = rowErrors.length > 0 ? errId : undefined;
                  return (
                    <ProcessRows
                      key={p.pid}
                      name={p.name}
                      color={p.color}
                      rowErrors={rowErrors}
                      errId={errId}
                      onRemove={() => removeProcess(p.pid)}
                    >
                      <td>
                        <NumberField
                          label={`${p.name} arrival`}
                          hideLabel
                          min={0}
                          value={p.arrival}
                          invalid={has('arrival')}
                          describedBy={describedBy}
                          onCommit={(n) => updateProcess(p.pid, { arrival: n })}
                        />
                      </td>
                      <td>
                        <NumberField
                          label={`${p.name} burst`}
                          hideLabel
                          min={1}
                          value={p.burst}
                          invalid={has('burst')}
                          describedBy={describedBy}
                          onCommit={(n) => updateProcess(p.pid, { burst: n })}
                        />
                      </td>
                      <td>
                        <NumberField
                          label={`${p.name} priority`}
                          hideLabel
                          value={p.priority}
                          invalid={has('priority')}
                          describedBy={describedBy}
                          onCommit={(n) => updateProcess(p.pid, { priority: n })}
                        />
                      </td>
                    </ProcessRows>
                  );
                })}
              </tbody>
            </table>
            {workload.length === 0 && <p className="ui-hint">No processes. Add one or load a preset.</p>}
            <div className="ui-row-inline ui-add-row">
              <button type="button" className="ui-btn" disabled={atMax} onClick={addProcess}>
                Add process
              </button>
              <span className="ui-count" aria-live="polite">
                {workload.length} / {MAX_PROCESSES}
              </span>
            </div>
          </section>

          <section className="ui-section" aria-label="Scheduler settings">
            <div className="ui-row-inline">
              <NumberField
                className="ui-mini-field"
                label="Quantum (Round Robin)"
                min={1}
                value={settings.quantum}
                invalid={quantumInvalid}
                describedBy={quantumInvalid ? topErrorsId : undefined}
                onCommit={(n) => setSettings({ quantum: n })}
              />
            </div>
            <label className="ui-check">
              <input
                type="checkbox"
                checked={settings.preemptive}
                onChange={(e) => setSettings({ preemptive: e.target.checked })}
              />
              <span>
                Preemptive
                <span className="ui-hint-inline"> SJF becomes SRTF; Priority can interrupt</span>
              </span>
            </label>
            <label className="ui-check">
              <input
                type="checkbox"
                checked={settings.lowerIsHigherPriority}
                onChange={(e) => setSettings({ lowerIsHigherPriority: e.target.checked })}
              />
              <span>Lower number = higher priority</span>
            </label>
            <label className="ui-check">
              <input type="checkbox" checked={followCore} onChange={(e) => setFollowCore(e.target.checked)} />
              <span>
                Follow the core
                <span className="ui-hint-inline"> camera zooms into the core during playback</span>
              </span>
            </label>
          </section>

          <section className="ui-section" aria-label="Share and export">
            <div className="ui-row-inline">
              <button type="button" className="ui-btn" disabled={errors.length > 0} onClick={copyLink}>
                Copy link
              </button>
              <button type="button" className="ui-btn" disabled={!compare || errors.length > 0} onClick={downloadCsv}>
                Download CSV
              </button>
            </div>
            <p className="ui-hint" role="status" aria-live="polite">
              {shareStatus}
            </p>
          </section>
        </div>
      </aside>
    </>
  );
}

interface ProcessRowsProps {
  name: string;
  color: string;
  rowErrors: ValidationError[];
  errId: string;
  onRemove: () => void;
  children: ReactNode;
}

function ProcessRows({ name, color, rowErrors, errId, onRemove, children }: ProcessRowsProps) {
  return (
    <>
      <tr className={rowErrors.length > 0 ? 'ui-proc-row is-invalid' : 'ui-proc-row'}>
        <th scope="row" className="ui-proc-name">
          <span className="ui-swatch" style={{ background: color }} aria-hidden="true" />
          {name}
        </th>
        {children}
        <td>
          <button type="button" className="ui-icon-btn ui-remove" aria-label={`Remove ${name}`} onClick={onRemove}>
            <CloseIcon />
          </button>
        </td>
      </tr>
      {rowErrors.length > 0 && (
        <tr className="ui-proc-err-row">
          <td colSpan={5}>
            <ErrorList errors={rowErrors} id={errId} />
          </td>
        </tr>
      )}
    </>
  );
}
