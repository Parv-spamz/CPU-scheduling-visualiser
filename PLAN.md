# Implementation Plan: CPU Scheduling Motherboard Visualizer

Source of truth for requirements: `docs/BRIEF.md` (copy of the build brief). This plan turns the brief into
work packages that several coding sub-agents can run, partly in parallel, without stepping on each other.
Section numbers like "§7.5" refer to the brief.

---

## 1. How to use this plan (read first, every agent)

1. Read `docs/BRIEF.md` in full, then this file, then the **Locked contracts** (§3 below).
2. Find your work package (WP) in §5. Touch **only the files your WP owns**. If you need a change in a
   file you do not own, write it under "Requests to lead" in your final report instead of editing.
3. Work in your own git worktree/branch (`wp/<id>-<slug>`), commit with Conventional Commits, do not push.
4. Before you report done, run and paste the result of:
   - `npm test` (all suites green)
   - `npm run build` (no type errors; `tsc -b` runs in strict mode, no `any`)
   - your WP's acceptance checks (§5), including a look at the running app via `npm run dev` where the WP has UI.
5. Never report an unrun check as passed. If something is blocked, say exactly what and why.
6. Rules from the brief that are never negotiable:
   - Engine (`src/engine/**`) imports nothing from React, DOM, GSAP, Zustand.
   - The UI/player never computes scheduling. It replays `RunResult.events` / `segments` only.
   - No dashboard UI: no card grids, stat tiles, chart side panels or results tables around the scene.
     Numbers live on the hardware (labels, readouts, Gantt trace, mini-CPUs).
   - All geometry comes from `src/scene/layout.ts`. No numeric coordinates anywhere else.
   - Animate through refs + GSAP. Never set React state per animation frame.
   - No network calls, no backend.

---

## 2. Phases and parallelism

```
Wave 0  (lead, sequential)   M0 scaffold + locked contracts + stubs ................ DONE in this repo
            │
Wave 1  (4 agents in parallel, disjoint files)
            ├── WP-A  Engine                (M1)
            ├── WP-B  Static scene          (M2)
            ├── WP-C  Camera + levels       (M3)
            └── WP-D  UI chrome             (M5 UI half: drawer, playback bar shell, tooltip)
            │
        lead merges A,B,C,D → removes engine stub → integration check
            │
Wave 2  (2 agents in parallel)
            ├── WP-E  Event player + keyboard (M4)
            └── WP-F  Results level + algorithm ring (M6, M5 switcher half)
            │
        lead merges E,F → full end-to-end run
            │
Wave 3  (1 agent, or lead)
            └── WP-G  Polish, responsive, reduced motion, perf, README, final acceptance (M7)
```

Merge order inside a wave does not matter because file ownership is disjoint. The lead resolves only
`App.tsx`, `Scene.tsx` and `store/useApp.ts` if a request needs them.

Cut order if time runs short (brief §11): L2 core zoom + quantum ring → SRTF / preemptive priority →
parallax and extra glow → narrow-screen layout. Never cut: engine tests, Gantt strip, board→CPU zoom,
four-algorithm comparison.

---

## 3. Locked contracts (created in Wave 0; change only through the lead)

| File | What it locks |
| --- | --- |
| `src/engine/types.ts` | Brief §5.1 verbatim + `ValidationError`, `ValidationResult`, `Workload` |
| `src/scene/layout.ts` | Every number from §7.5, trace waypoints, chip sizing, storage cell + slot helpers, level rects, LOD thresholds, camera tween params |
| `src/scene/targets.ts` | DOM hook names (data attributes / ids) shared by scene, camera and player |
| `src/theme/palette.ts` | 12 process colours, `colorForPid(pid)` |
| `src/theme/theme.css` | CSS variables (board, copper, neon, text, glow) |
| `src/store/useApp.ts` | Zustand store shape and action names (§4.3) |
| `src/data/sample-result.json` | Hand-made RunResult: RR q=2, P1(0,5) P2(1,3) P3(2,1). **Also the engine's golden test.** |

### 3.1 Engine semantics that the brief leaves implicit (decided here)

- **ARRIVE/ENQUEUE are emitted at the process's real arrival time**, also when it arrives while another
  process is running. This does not change any decision (decisions only happen at slice boundaries,
  §5.2a) but makes the chips travel at the right moment.
- **Events are sorted by `(time, typeRank, seq)`** where `typeRank` follows §5.2a
  (COMPLETE, PREEMPT, ARRIVE, ENQUEUE, CONTEXT_SWITCH, DISPATCH, RUN, IDLE) and `seq` is emission order.
  So at an RR slice end: PREEMPT(old) → ARRIVE(new) → ENQUEUE(new) → ENQUEUE(old) → CONTEXT_SWITCH → DISPATCH → RUN.
- `queue` on every event is the ready queue **after** the event. DISPATCH removes the pid from the queue.
  For non-RR algorithms the queue is still listed in admission order (front first); the pick rule, not the
  array order, decides who runs.
- `remaining`: on DISPATCH = remaining before running; on RUN, PREEMPT, COMPLETE = remaining after the slice;
  on the ENQUEUE that follows a PREEMPT = the same remaining. ARRIVE, the arrival ENQUEUE, CONTEXT_SWITCH
  and IDLE omit `remaining`.
- **Engine API never throws:** `simulate(processes, settings): SimulateOutcome` and
  `compareAll(processes, settings): CompareOutcome` return `{ok:false, errors}` on invalid input
  (types in `types.ts`). The store unwraps them.
- `CONTEXT_SWITCH.pid` = the incoming pid. No CONTEXT_SWITCH for the first dispatch of a run, and idle gaps
  are ignored (last pid that actually ran is compared).
- `IDLE` has `pid: null`, `duration` = gap length; emitted at the start of the gap.
- **Note strings** (exact, so the golden file matches):
  - FCFS `earliest arrival: P1 (0)` · SJF `shortest burst: P2 (2)` · SRTF `shortest remaining: P2 (2)`
  - Priority `highest priority: P2 (1)` · RR `front of queue: P1`
- `makespan` = last completion − earliest arrival; `utilisation` = busy / makespan; `throughput` = n / makespan.
- Averages are raw floats (no rounding in the engine); the UI rounds to 2 decimals.
- Priority with `lowerIsHigherPriority=false`: compare `-priority`. Preemptive priority uses the same key.
- `compareAll` runs the 4 algorithms with the shared settings (quantum, preemptive, priority order) and
  `winner` = lowest average waiting time, ties broken by fixed order `fcfs, sjf, priority, rr`;
  `runnerUp` = second by the same ordering. `reason` names the winner, its average wait, the runner-up, and
  a trade-off (e.g. the process with the largest waiting time under the winner).

### 3.2 Scene ↔ player hook contract (`src/scene/targets.ts`)

The player animates DOM nodes found by these hooks. Scene components must render them; the player must
not rely on anything else.

| Hook | Element | Animated props |
| --- | --- | --- |
| `[data-chip="<pid>"]` | `<g>` drawn centred on (0,0); world position via GSAP `x`,`y`,`scale` (storage scale = `storageChipScale(burst)`) | x, y, scale, opacity |
| `[data-chip-check="<pid>"]` | green check inside chip | opacity |
| `[data-chip-flash="<pid>"]` | red overlay inside chip | opacity |
| `#core-glow` | rect over the core, fill = process colour via `fill` attr | opacity, attr fill |
| `#core-flash` | white rect over core | opacity |
| `#core-idle` | "idle" label group | opacity |
| `#core-progress` | circle with `pathLength=1` | strokeDashoffset (0 = full, 1 = empty) |
| `#quantum-ring` | circle with `pathLength=1` | strokeDashoffset |
| `#scheduler-flash` | highlight rect on scheduler block | opacity |
| `[data-gantt-seg="<index>"]` | rect per segment at final x, width animated | attr width (0 → final) |
| `#gantt-cursor` | vertical line drawn at x=0, placed by transform | x = absolute world `ganttX(t)` |
| `[data-trace-pulse="storage-ram"|"ram-cpu"|"cpu-out"]` | small dot on trace | x, y, opacity |
| `[data-hit="cpu"|"core"|"board"]` | click targets for the camera | — (pointer only) |
| `[data-lod="name"|"detail"]` | label groups faded by level of detail | opacity (set by camera via CSS var) |

Text readouts (clock, context-switch count, scheduler note, chip remaining) are React-rendered from store
fields that the timeline writes **only on event boundaries** (`store.setPlayhead`), never per frame.

---

## 4. Wave 0 deliverables (done by lead)

### 4.1 Tooling
- Vite + React + TS (strict, `noImplicitAny`, `noUnusedLocals`), Vitest (jsdom env for `*.dom.test.ts(x)`,
  node env otherwise), deps: `gsap`, `zustand`. Scripts: `dev`, `build` (`tsc -b && vite build`),
  `test` (`vitest run`), `preview`.
- `git init`, first commit `chore: scaffold project and contracts`.

### 4.2 Stubs (to be replaced)
- `src/engine/index.ts` re-exports `simulate`, `compareAll`, `validateWorkload`, `presets`,
  `randomWorkload`. In Wave 0, `simulate`/`compareAll` return the sample result (stub, marked `STUB`).
  WP-A replaces them; lead greps for `STUB` before Wave 2.
- Scene, camera, player and ui modules exist as minimal compiling components so `App.tsx` mounts the full
  tree from day one.

### 4.3 Store shape (`src/store/useApp.ts`)

```ts
type Level = 'L0' | 'L1' | 'L2' | 'L3';
state:   workload: Process[]; settings: Settings; run: RunResult | null; compare: CompareResult | null;
         errors: string[]; level: Level; followMode: boolean; playing: boolean; speed: number;
         progress: number /* sim time t */; playhead: { clock, contextSwitches, note, runningPid, queue };
         drawerOpen: boolean; selectedPid: number | null; tooltip: string; reducedMotion: boolean
actions: setWorkload, updateProcess, addProcess, removeProcess, loadPreset, randomize, setSettings,
         setAlgorithm, recompute, setLevel(level, {manual}), setFollow, play, pause, togglePlay,
         setSpeed, seek(t), step(+1|-1), setPlayhead, setDrawerOpen, selectPid, setTooltip
```
`recompute()` is the only place that calls the engine (validate → simulate → compareAll) and it resets
`progress` to 0. Changing algorithm re-runs with the same workload so colours stay stable.

---

## 5. Work packages

Each WP lists: owned files · inputs it relies on · tasks · acceptance checks · suggested model.

### WP-A · Engine (Wave 1, M1)
**Owns:** `src/engine/*` except `types.ts`; `src/engine/*.test.ts`.
**Tasks**
1. `validate.ts`: `validateWorkload(processes, settings): ValidationResult` — empty, non-integers,
   `burst<1`, `arrival<0`, `quantum<1`, duplicate pids, >12 processes. Messages name the process
   (`P3: burst must be a whole number ≥ 1`). Never throws.
2. `algorithms.ts`: `PickRule`s per §5.2a with total order (key, arrival, pid); RR = `ready[0]`.
3. `simulate.ts`: one loop for all algorithms, rules of §5.2a + §3.1 of this plan; SRTF/preemptive
   priority slice until next arrival; merge consecutive same-pid slices without PREEMPT/CONTEXT_SWITCH.
4. `metrics.ts`: per-process + averages, utilisation, throughput, idle, makespan, context switches.
5. `compare.ts`: `compareAll` per §3.1.
6. `presets.ts`: `textbook` (P1 6, P2 2, P3 4 at t=0 — brief §2 worked example), `convoy` (one long job
   first then several short), `starvation` (low-priority long job vs steady stream of high-priority ones),
   `rrSample` (the sample workload). Each preset carries a one-line description.
7. `random.ts`: seeded PRNG (mulberry32), `randomWorkload(seed, size)`.
8. `csv.ts` (should-have): `toCsv(result)`.
9. Replace the Wave-0 stub in `index.ts`.
**Tests (`engine.test.ts`)**: golden test `simulate(sample workload)` deep-equals `sample-result.json`;
brief §2 worked example (FCFS avg wait 4.67, SJF 2.67); textbook cases for all four algorithms
(segments + every metric); idle gap (late first arrival and mid-run gap); ties; single process; RR with
quantum > max burst equals FCFS segments; RR quantum 1 has the most switches; SRTF and preemptive
priority preempt exactly on better arrival; invariants on 200 seeded random workloads × 4 algorithms ×
preemptive on/off; validation errors.
**Acceptance:** all tests green; engine files import nothing outside `src/engine`. **Model:** strongest.

### WP-B · Static scene (Wave 1, M2)
**Owns:** `src/scene/*.tsx` (Board, CpuPackage, Core, Ram, Storage, Traces, Chip, GanttStrip, OutputPort,
Readouts). Not `layout.ts`, `targets.ts`, `Scene.tsx`, `ResultsLayer.tsx`, `AlgorithmRing.tsx`.
**Tasks**
1. Draw every object of §7.5 from `layout.ts`: PCB with corner radius, power block + capacitors, socket,
   die, 4 cache blocks, core, scheduler block (algorithm, quantum, note text), RAM 8 slots, storage bay
   with 4×3 grid, output port, Gantt strip frame (axis ticks from run makespan), clock/ctx readout near CPU.
2. Traces: orthogonal polylines from layout waypoint helpers, copper stroke, plus the three pulse dots.
3. `Chip.tsx`: `<g data-chip>` centred on (0,0), width from `chipWidth(burst)`, name label in
   `data-lod="name"`, remaining/priority badge in `data-lod="detail"`, hidden check and red flash.
   Initial transform = storage cell (`storageCellCenter(index)`, scale `STORAGE_CHIP_SCALE`).
4. Core: glow, flash, idle label, progress ring, quantum ring, all at opacity 0 by default.
5. Gantt: one rect per non-idle segment (idle drawn as hatched) at final x with `width=0` initially
   (the player grows it), plus `#gantt-cursor`. Hover shows start/end/length via `setTooltip`.
6. Visual style per §7.4 using theme variables; glow filter applied only to core + active chip.
**Acceptance:** at L0 every §7.5 object visible and correctly placed (compare against layout numbers in
devtools); chips sit in storage cells for the sample and for a 12-process workload; no number literals
for coordinates outside layout (grep). **Model:** mid/strong (design-heavy).

### WP-C · Camera + levels (Wave 1, M3)
**Owns:** `src/camera/*`, `src/ui/Breadcrumbs.tsx`, `src/camera/*.test.ts`.
**Tasks**
1. `levels.ts` (pure): `fitRect(rect, aspect) → ViewBox`, `interpolateViewBox(a, b, p)` (centre linear,
   width in log space), transition table of §8.2, `deeper(level)`, `shallower(level)`.
2. `useCamera(svgRef)`: subscribes to `level`; GSAP tween 1.2 s `power3.inOut` on a proxy, writes
   `viewBox` attribute directly (no React re-render); resize → recompute without tween; reduced motion →
   0.35 s fade instead of fly. Writes `--zoom`-driven LOD opacities (`zoom = 1600 / vbWidth`; names ≥1.3,
   detail ≥3) as CSS custom properties on the `<svg>` so labels fade via CSS transitions.
3. Inputs: wheel/pinch (debounce 400 ms, one level per gesture), click delegation on `[data-hit]`,
   Escape = one level out, drag-to-pan within a level (clamped, reset on level change). Every manual input
   calls `setLevel(level, {manual:true})` → `followMode=false`.
4. Breadcrumbs: Board › CPU › Core › Results, clickable, current level highlighted.
**Tests:** `fitRect` keeps aspect and contains the rect; log-space interpolation midpoint; transition
table round-trips. **Acceptance:** smooth L0↔L1↔L2, L3; resizing keeps framing; labels fade by zoom;
manual input disables follow. **Model:** mid.

### WP-D · UI chrome (Wave 1, M5 UI half)
**Owns:** `src/ui/Drawer.tsx`, `src/ui/PlaybackBar.tsx`, `src/ui/Tooltip.tsx`, `src/ui/ui.css`.
**Tasks**
1. Drawer (left, collapsible; bottom sheet under 720 px): editable rows (name read-only, arrival, burst,
   priority, colour swatch), add/remove (max 12), preset picker, random (seed input), quantum, preemptive
   toggle, priority-order toggle. Edits call store actions; `errors` from the store shown inline, readable.
2. PlaybackBar (bottom): play/pause, step back/forward, speed (0.5×, 1×, 2×, 4×), scrubber `0..makespan`
   bound to `progress` + `seek`; icon-only under 720 px. Purely calls store actions — the player (WP-E)
   listens to the store.
3. Tooltip: one line, bottom-centre above the bar, from `store.tooltip`, defaults to a level explanation.
4. Accessible: labelled inputs, focus rings, keyboard reachable, contrast ≥ 4.5:1.
**Acceptance:** invalid input shows message and does not crash; drawer never covers the CPU at L1 on
desktop; works at 375 px width. **Model:** mid.

### WP-E · Event player (Wave 2, M4) — needs A, B, C merged
**Owns:** `src/player/*`, `src/ui/useKeyboard.ts`, `src/player/*.test.ts`.
**Tasks**
1. `keyframes.ts` (pure, no GSAP): from a RunResult compute for each chip its place at every event
   boundary (`storage | transit | slot(i) | core | done`) with world x/y/scale/opacity from layout, and
   `playheadAt(result, t)` (clock, contextSwitches, note, runningPid, queue) by folding events ≤ t.
2. `buildTimeline(result, root)`: GSAP master timeline per §8.5, 1 tick = 1 s, all `fromTo` at absolute
   positions, transfers ≤ 0.6 s, trace pulses follow waypoints, Gantt widths grow with the clock, core
   progress/quantum rings, flashes. Callbacks only `setPlayhead(playheadAt(result, floor(t)))`.
3. `usePlayer()`: owns the timeline, reacts to `run` (rebuild), `playing`, `speed` (`timeScale`),
   `seek`, `step` (jump to previous/next event time), pauses when tab hidden, writes `progress` at most
   ~10×/s for the scrubber. Auto-follow per §8.5: L0 until first DISPATCH → L1; end → hold 1.5 s → L3;
   L2 only with Follow-core toggle. Respects `followMode`.
4. `useKeyboard`: space, ←/→ step, 1–4 algorithm, Escape handled by camera (do not duplicate).
**Tests:** replay check — DISPATCH order from the built timeline equals non-idle segment order for every
preset; scrub check — seek random t on a timeline over plain-object targets and compare with
`keyframes` positions; stepping back restores the earlier state. **Model:** strongest.

### WP-F · Results level + algorithm ring (Wave 2, M6) — needs A, B merged
**Owns:** `src/scene/ResultsLayer.tsx`, `src/scene/MiniCpu.tsx`, `src/scene/AlgorithmRing.tsx`.
**Tasks**
1. Results layer (visible only at L3, fades in): four 700×400 panels from layout, each a mini-CPU
   with algorithm name, mini Gantt strip (process colours), averages WT/TAT/RT, context switches; winner
   badge on the lowest average wait; reason line across the board. Click a panel → `setAlgorithm(id)`,
   `setLevel('L1')`, play.
2. Algorithm ring around the CPU at L1: four selector buttons (FCFS, SJF, PRIO, RR) on the socket edge
   positions from layout; selected glows; quantum shown on RR.
**Acceptance:** numbers equal `compare.runs[*]` exactly; winner = lowest average wait; a newcomer can
tell who won from the screen. **Model:** mid.

### WP-G · Polish + hardening (Wave 3, M7)
**Owns:** anything, coordinated by lead.
Glows limited to active elements, subtle parallax layers on camera move, reduced-motion path end to end,
narrow screen (camera frames active area, bottom sheet), perf pass with 12 processes (60 fps, no React
renders per frame — check with React profiler), accessible plain-table fallback for results (hidden,
screen-reader only, to keep "no dashboard"), README (run/test/build + decisions), `npm run preview` demo.

---

## 6. Integration checkpoints (lead)

| After | Check |
| --- | --- |
| Wave 0 | `npm run dev` shows dark board page, `npm test` runs, `npm run build` passes |
| Wave 1 merge | Stub removed (`grep -r STUB src` empty); board renders real engine output for every preset; camera zooms; drawer edits re-run engine |
| Wave 2 merge | Load preset → Play → auto zoom L0→L1 → chips move → Gantt grows → L3 with winner; scrub anywhere is consistent |
| Wave 3 | Definition of done (brief §11): all must-haves, tests + build clean, outsider test |

## 7. Agent prompt template

> You are implementing **WP-X** of `PLAN.md` in this repo. Read `docs/BRIEF.md`, `PLAN.md` §1, §3 and
> your WP. Own only the listed files. Code strictly against the locked contracts. Finish by running
> `npm test` and `npm run build`, perform the WP acceptance checks, commit on your branch, and report:
> what was built, test/build output, anything not done, and any "Requests to lead".
