# CPU Scheduling Motherboard Visualizer: Build Brief

Nov 25, 2026 · @parv

## 0. Brief for the coding agent

Build the app described in this document: an interactive, zooming motherboard UI that visualises CPU scheduling (FCFS, SJF, Priority, Round Robin) for a workload the user enters. Read the whole document before writing code.

**Rules**

1. Follow the build order in section 11, one milestone at a time. At the end of each milestone run the tests and `npm run build`, commit, then move on.
2. The engine (section 5) is pure TypeScript with no UI imports. The UI never calculates scheduling; it only replays the engine's events.
3. The UI is the motherboard scene in section 7. No dashboards: no card grids, stat tiles, or sidebars of charts and tables around the scene. All numbers appear inside the scene.
4. Everything runs in the browser. No backend, no Python, no external services, no network calls at runtime.
5. Geometry has one source of truth, `src/scene/layout.ts` (section 7.5). Never hard-code coordinates anywhere else.
6. Where this document leaves a detail open, choose the simplest option that respects these rules and note the choice in `README.md`.
7. Get a crude version working end to end before refining it. Each milestone must run before the next begins.

**Fixed stack:** TypeScript (strict mode, no `any`), React, Vite, SVG, GSAP, Zustand, Vitest.

## 1. Vision

The app is a living motherboard you fly into, not a dashboard: you start on a full board, zoom into the CPU, and watch processes get scheduled inside it as the camera moves.

**The experience, in order:**

1. **Board view.** A top-down motherboard fills the screen: CPU socket, RAM slots, a storage connector, bus traces glowing between them. Idle, it pulses gently.
2. **Load the workload.** A small side drawer lets you enter processes (arrival, burst, priority) or pick a preset. As you add them, tiny chips slide out of the storage connector and travel along traces toward RAM, showing a job queue forming.
3. **Zoom into the CPU.** Scroll, click the CPU, or press Play. The camera dives into the chip: you see the die, cores, cache and the scheduler block.
4. **Watch scheduling happen.** Processes leave the ready queue, enter the core, run, and leave. The Gantt chart is drawn live along the bottom as a timeline, like a logic analyser trace.
5. **Switch algorithm.** Change FCFS to SJF, Priority or Round Robin and replay the same workload. The motion changes, and the numbers change with it.
6. **Zoom out to compare.** The camera pulls back to the board and four mini-CPUs show the results side by side, with a winner badge.

**Design feel:** dark PCB-green or deep navy board, copper traces, neon accent lights, subtle glow and depth. Smooth, cinematic camera moves, never jumpy.

**UI hard requirements**

- The whole app is one full-screen motherboard scene. The user starts zoomed out on the whole board and zooms into the CPU as a continuous camera move, never a page change or a modal.
- Zoom is interactive and animated: mouse wheel or pinch, clicking a component, level breadcrumbs, and automatic follow during playback. Manual input always overrides auto-follow.
- Responsive: the scene fills any window size and keeps its aspect ratio. On narrow screens the camera frames the active area and the workload drawer becomes a bottom sheet.
- Detail appears as you zoom in: each level reveals more (for example, process names on chips only once they are large enough to read).
- No dashboard. Forbidden as the main UI: card grids, stat tiles, side panels of charts, results tables. Numbers live on the hardware: labels, readouts, the Gantt trace and the mini-CPUs.
- Minimal chrome only: a collapsible workload drawer, a playback bar, breadcrumbs and one tooltip line.

## 2. Primer: what you need to know about CPU scheduling

A CPU can run only one process per core at a time, so the operating system's scheduler decides who runs next. Everything in this project is a different answer to that one question.

**Key ideas in plain words**

- **Process:** a program that wants CPU time. For this project it has four numbers: arrival time (when it shows up), burst time (how long it needs the CPU), priority (how important it is) and a name.
- **Ready queue:** the waiting line of processes that have arrived and are not finished.
- **Gantt chart:** a timeline showing which process ran during which time slice.
- **Preemption:** the OS can kick a running process off the CPU to run another. Non-preemptive means a process keeps the CPU until it finishes.
- **Context switch:** the small cost of swapping one process out for another. We will count them.
- **Time quantum:** in Round Robin, the fixed slice each process gets before going to the back of the queue.

**The four algorithms**

| Algorithm | Rule for picking the next process | Preemptive? | Strength | Weakness |
| --- | --- | --- | --- | --- |
| FCFS (First Come First Served) | Earliest arrival goes first | No | Simple and fair by order | One long job blocks everyone (convoy effect) |
| SJF (Shortest Job First) | Smallest burst time goes first | No (SRTF is the preemptive version) | Lowest average waiting time | Long jobs can starve; needs to know burst time |
| Priority | Highest priority goes first | Non-preemptive (preemptive as an option) | Important work runs first | Low priority can starve |
| Round Robin | Take turns, one quantum each | Yes | Fair, good response time | Many context switches if the quantum is small |

**The metrics we calculate for every process (waiting, turnaround and response, plus completion time as the input to them)**

| Metric | Formula | Meaning |
| --- | --- | --- |
| Completion time (CT) | Time the process finishes | Read off the Gantt chart |
| Turnaround time (TAT) | CT minus arrival time | Total time in the system |
| Waiting time (WT) | TAT minus burst time | Time spent waiting, not running |
| Response time (RT) | First CPU start minus arrival time | How long until it first gets the CPU |

The project then averages these over all processes and compares algorithms. Lower is better for all three.

**Worked example (so the numbers feel real)**

Three processes arrive at time 0: P1 needs 6, P2 needs 2, P3 needs 4.

- FCFS runs P1, P2, P3. Waiting times are 0, 6 and 8, so the average is 4.67.
- SJF runs P2, P3, P1. Waiting times are 0, 2 and 6, so the average is 2.67.

Same jobs, a different rule, a much shorter average wait. That contrast is the whole story the app tells visually.

## 3. Scope and key decisions

Build the engine and the zoom experience for four algorithms first; everything else is optional polish. The brief in the manual only needs the four algorithms, Gantt charts, the three metrics and a comparison, so the extras below are bonus.

| Tier | What is in it | Rule |
| --- | --- | --- |
| Must have (today) | Engine with FCFS, SJF, Priority and Round Robin; waiting, turnaround and response times with averages; Gantt strip; motherboard board view (L0); zoom into the CPU (L1); playback with play, pause and scrubber; results view with four algorithms side by side (L3) | Nothing else starts until all of this works |
| Should have (only if ahead of schedule) | Core zoom (L2); preemptive SJF (SRTF); presets; context-switch counter; CSV export | Add in this order |
| Cut for now | Multi-core, quantum sweep chart, cache and RAM levels, sound, guided tour, any server or Python backend | Do not touch before the deadline |

**Decisions already made (change any of these if you disagree)**

- **No server.** Everything runs in the browser in TypeScript. The course does not require Python, and one language and one project means nothing to deploy and fewer things to break before the deadline.
- **Single core by default.** One CPU core keeps the algorithms textbook-correct.
- **Lower priority number means higher priority.** This is the common textbook convention; a toggle flips it.
- **Ties break by arrival time, then by process ID.** Results stay deterministic and testable.
- **The simulation is computed first, then animated.** The engine produces a full event timeline and the animation only replays it.
- **Time is in abstract units, not seconds.** One unit is one tick on the Gantt chart.

**Constraints**

- **One builder with a coding agent.** Parv builds it; the other two team members are credited on the submission only.
- **Deadline is tomorrow.** Scope is frozen at the Must have tier; the build order in section 11 is the plan.
- **No Python requirement.** The engine is written in TypeScript.

## 4. System architecture

The app is a single browser page with two halves: a plain TypeScript engine that calculates and a UI that draws. There is no server.

&#91;embedded content: architecture · UI and engine, 9 parts\]

The UI hands the workload to the engine and gets back a complete timeline, so the animation can pause, rewind and scrub without recalculating anything.

**Why split it this way**

- **Separation:** scheduling maths lives in one testable place, and the visuals can change freely without risking correctness.
- **Parallel work:** one person builds the engine while others build the scene and camera, agreeing only on the types and the sample result file in section 5.3.
- **Speed today:** no server, no API, no second language. Start with `npm run dev` and demo from the laptop.

## 5. Engine: the simulation core

The engine is a set of pure TypeScript functions under `src/engine/`. It takes a workload, runs a scheduling algorithm and returns a complete, replayable timeline plus metrics. It imports nothing from React, the DOM or GSAP, so it can be tested alone.

### 5.1 Data model

| Object | Fields |
| --- | --- |
| Process | pid, name, arrival, burst, priority, colour |
| Workload | list of Process, plus settings |
| Settings | algorithm, quantum, preemptive (true/false), priority order (low number = high priority or the reverse) |
| Segment | pid, start, end (one block on the Gantt chart; pid is null for CPU idle) |
| Event | time, type, pid, detail (see 5.3) |
| ProcessResult | pid, completion, turnaround, waiting, response |
| RunResult | algorithm, segments, events, per-process results, averages, utilisation, throughput, context switches |

Write these exactly as the contract in `src/engine/types.ts`:

```ts
export type AlgorithmId = 'fcfs' | 'sjf' | 'priority' | 'rr';

export interface Process {
  pid: number;        // unique, 1-based
  name: string;       // 'P1', 'P2', ...
  arrival: number;    // integer >= 0
  burst: number;      // integer >= 1
  priority: number;   // integer; lower = more important by default
  color: string;      // stable per pid, from the theme palette
}

export interface Settings {
  algorithm: AlgorithmId;
  quantum: number;                 // Round Robin only, integer >= 1
  preemptive: boolean;             // SJF (becomes SRTF) and Priority only
  lowerIsHigherPriority: boolean;  // default true
}

export interface Segment { pid: number | null; start: number; end: number } // pid null = CPU idle

export type EventType =
  | 'ARRIVE' | 'ENQUEUE' | 'DISPATCH' | 'RUN'
  | 'PREEMPT' | 'CONTEXT_SWITCH' | 'IDLE' | 'COMPLETE';

export interface SimEvent {
  time: number;
  type: EventType;
  pid: number | null;
  duration?: number;    // RUN and IDLE only
  remaining?: number;   // burst left after this event, for the pid
  queue: number[];      // ready-queue pids, front first, AFTER this event
  note?: string;        // one-line reason for the scheduler block, e.g. 'shortest burst: P2 (2)'
}

export interface ProcessResult {
  pid: number; completion: number; turnaround: number; waiting: number; response: number;
}

export interface RunResult {
  algorithm: AlgorithmId;
  settings: Settings;
  processes: Process[];
  segments: Segment[];
  events: SimEvent[];
  perProcess: ProcessResult[];
  averages: { waiting: number; turnaround: number; response: number };
  utilisation: number;      // busy time / makespan, 0..1
  throughput: number;       // processes / makespan
  contextSwitches: number;
  idleTime: number;
  makespan: number;         // last completion minus earliest arrival
}

export interface CompareResult {
  runs: Record<AlgorithmId, RunResult>;
  winner: AlgorithmId;      // lowest average waiting time
  runnerUp: AlgorithmId;
  reason: string;           // one plain-English sentence that names the trade-off
}
```

### 5.2 Engine design

One simulator loop handles every algorithm. Only the rule for choosing the next process changes, so each algorithm is a small "pick next" function.

1. Keep a clock `t` starting at the earliest arrival.
2. At each step, move newly arrived processes into the ready queue and emit an arrival event.
3. If the queue is empty, emit an idle segment and jump the clock to the next arrival.
4. Otherwise call the algorithm's pick function to choose a process and decide how long it runs: until it finishes (FCFS, non-preemptive SJF and Priority), for one quantum (Round Robin), or until the next arrival that could preempt it (SRTF, preemptive Priority).
5. Emit a segment and the matching events, advance the clock, and repeat until all processes are done.
6. Compute the metrics from the segments.

**Pick rules**

- FCFS: smallest arrival time.
- SJF: smallest burst; SRTF uses smallest remaining time.
- Priority: best priority value; ties go to earlier arrival.
- Round Robin: front of the queue; a preempted process goes to the back, after any process that arrived during its slice.

### 5.2a Exact simulation rules

Implement these precisely so that results are deterministic and match textbooks.

- **Time** is integer ticks. Scheduling decisions happen only at integer times: when a process arrives, finishes, or its quantum ends.
- **Ready item:** `{ pid, arrival, burst, remaining, priority, enqueuedAt }`.
- **Total order for every pick rule:** compare the primary key first, then smaller `arrival`, then smaller `pid`. No rule may depend on array position except Round Robin.
- **Admission:** a process joins the ready queue at its arrival time. If several arrive at the same time they join in `(arrival, pid)` order.
- **Round Robin queue order:** when a slice ends, first admit every process with `arrival <= sliceEnd`, then append the preempted process to the back. This is the standard textbook convention.
- **Slice length:**
  - FCFS, non-preemptive SJF, non-preemptive Priority: the picked process's full `remaining`.
  - Round Robin: `min(quantum, remaining)`.
  - SRTF and preemptive Priority: run until the process finishes or the next arrival time, whichever is first, then re-pick. If the same pid is picked again, do not emit PREEMPT or CONTEXT\_SWITCH and merge the two slices into one segment.
- **Idle:** if the queue is empty, emit an idle segment (`pid: null`) up to the next arrival and jump the clock there. The clock starts at the earliest arrival, so there is never a leading idle segment; idle appears only in the middle of a run.
- **Response time:** the first start time of a process minus its arrival.
- **Context switch:** count one whenever a DISPATCH picks a different pid than the last process that ran, ignoring the first dispatch of the run and ignoring idle gaps in between.
- **Event order at equal times:** COMPLETE, PREEMPT, ARRIVE, ENQUEUE, CONTEXT\_SWITCH, DISPATCH, RUN, IDLE.
- **Events per slice:** DISPATCH (with a `note`) then RUN (with `duration`), and then either COMPLETE or, if the process leaves unfinished, PREEMPT followed by ENQUEUE.
- **Validation:** reject empty workloads, non-integers, `burst < 1`, `arrival < 0`, `quantum < 1`, duplicate pids, and more than 12 processes. Return typed errors with readable messages; never throw raw exceptions into the UI.

```ts
// Shape of the pick rules in src/engine/algorithms.ts
type ReadyItem = { pid: number; arrival: number; burst: number; remaining: number; priority: number; enqueuedAt: number };
type PickRule = (ready: ReadyItem[], settings: Settings, now: number) => { item: ReadyItem; note: string };
// fcfs: min by (arrival, pid) | sjf: min by (preemptive ? remaining : burst, arrival, pid)
// priority: min by (priority, arrival, pid) with the sign flipped when lowerIsHigherPriority is false
// rr: ready[0] (queue is kept in service order by the simulator)
```

### 5.3 Event types (the contract the animation depends on)

| Event | Meaning | What the UI shows |
| --- | --- | --- |
| ARRIVE | A process enters the system | Chip leaves storage and travels to RAM |
| ENQUEUE | Process joins the ready queue | Chip slots into the queue near the CPU |
| DISPATCH | Scheduler picks a process | Scheduler block lights up, chip moves into the core |
| RUN | Process executes for a slice | Core glows, progress bar fills, Gantt grows |
| PREEMPT | Running process is kicked off | Chip returns to the queue |
| CONTEXT\_SWITCH | CPU swaps process state | Brief flash on the core and a counter ticks up |
| IDLE | Nothing ready | Core dims |
| COMPLETE | Process finishes | Chip exits the core with a check mark |

### 5.4 Metrics module

- Per process: completion, turnaround, waiting, response.
- Overall: average of each, CPU utilisation (busy time over total time), throughput (processes per unit time), number of context switches, total idle time.
- Comparison: runs all four algorithms on the same workload and picks a winner. The default criterion is lowest average waiting time, and the verdict text also names the runner-up and the trade-off (for example "SJF wins on waiting time, but a long job is delayed the most").

### 5.5 Engine functions and the shared contract

| Function | Purpose |
| --- | --- |
| simulate(workload, settings) | Returns one RunResult for the chosen algorithm |
| compareAll(workload, settings) | Runs all four algorithms on the same workload and returns four RunResults plus the verdict |
| presets | Ready-made workloads: textbook example, convoy effect, starvation demo |
| randomWorkload(seed, size) | Generates a workload for quick testing |
| toCsv(result) | Exports a result as CSV (only if time allows) |

**Build against the contract first:** write `types.ts` and a hand-made `src/data/sample-result.json` (one small workload, for example P1 arrival 0 burst 5, P2 arrival 1 burst 3, P3 arrival 2 burst 1, run with Round Robin quantum 2). The scene, camera and player are developed against that file so they never wait for the real engine.

Validation rules: arrival and burst must be whole numbers, burst at least 1, quantum at least 1, at most about 12 processes so the animation stays readable, and clear error messages for anything else.

## 6. The pipeline: from input to animation

One request travels through five stages. Each stage hands a clean data object to the next, so any stage can be tested or replaced alone.

&#91;embedded content: pipeline · 5 stages, input to animation\]

| Stage | Input | What happens | Output |
| --- | --- | --- | --- |
| 1 Input | User edits or a preset | The workload is validated in the browser (whole numbers, burst at least 1, at most 12 processes) | Workload and settings as JSON |
| 2 Simulate | Workload and settings | The simulator loop runs the chosen algorithm's pick rule until every process is done | An ordered list of segments |
| 3 Timeline | Segments | The engine also writes events (ARRIVE, DISPATCH, RUN, PREEMPT, COMPLETE and so on) in time order | Event list |
| 4 Metrics | Segments and events | Per-process times, averages, utilisation, throughput, context switches; compare mode repeats this for all four algorithms | RunResult, or four RunResults and a verdict |
| 5 Animate | RunResult | The player maps each event to a chip movement, camera cue and glow, driven by a clock the user controls | The moving motherboard |

**Rules that keep the pipeline honest**

- Stages 2 to 4 are deterministic: the same input always gives the same output, so results can be cached and compared.
- The animation never recalculates anything. If the screen and the numbers disagree, the bug is in the player.
- A change of algorithm re-runs stages 2 to 5 with the same workload, so the chips and colours stay the same and only the behaviour changes.

## 7. Frontend: the motherboard scene

The frontend is one big scene drawn as layered SVG, with a virtual camera that pans and zooms between levels. There are no dashboard cards. All numbers appear as part of the hardware (labels on the chips, glowing readouts, the live Gantt strip).

### 7.1 The four zoom levels

| Level | Camera | What you see | What you can do |
| --- | --- | --- | --- |
| L0 Board | Full motherboard | CPU socket, RAM slots, storage connector, power block, traces. Job chips sit in storage. | Open the workload drawer, press Play, click the CPU |
| L1 CPU package | Zoomed onto the socket | The chip with its cores, cache and a scheduler block, plus the ready queue feeding in from RAM | Pick the algorithm, set the quantum, watch dispatch, scrub the timeline |
| L2 Core | Zoomed into one core | The running process as a glowing chip, a progress ring for burst time, the context-switch circuit | Pause on a single step, inspect process details |
| L3 Results | Pulled back to the board | Four mini-CPUs, one per algorithm, each with its Gantt strip and averages, and a winner badge | Compare, export, replay any algorithm |

The camera moves between levels automatically as the playback reaches the matching phase, and you can also scroll, click or use the level buttons to go yourself. Manual control always wins over auto-follow.

### 7.2 Scene objects

| Object | Drawn as | Data it shows |
| --- | --- | --- |
| Storage connector | A drive bay with chips stacked in it | Processes not yet arrived, labelled with name and arrival time |
| Traces / bus | Copper lines with moving light pulses | A pulse travels when a chip is in transit |
| RAM slots | Slots holding chips | Arrived processes waiting, i.e. the ready queue (the chips line up in slot order) |
| CPU die | The central chip | Core count (1 by default), cache blocks as decoration, scheduler block |
| Scheduler block | A small labelled logic area on the die | Current algorithm, quantum, who was picked and why (one short line) |
| Core | A square on the die | Currently running process, progress ring, glow |
| Clock / counter | A small readout near the CPU | Current time tick, context-switch count |
| Gantt strip | A trace-like timeline along the bottom, drawn as a logic analyser | Segments appear as the clock advances; hover shows start, end and process |
| Metrics rails | Small readouts that appear on the board in L3 | Waiting, turnaround, response averages |

### 7.3 Interface outside the scene

Keep it minimal so the scene stays the hero.

- **Workload drawer** (slides in from the left): editable table of processes, preset picker, random generator, quantum input.
- **Algorithm switcher** (a ring of four selector buttons around the CPU in L1).
- **Playback bar** (bottom): play, pause, step forward and back, speed, a scrubber tied to the Gantt strip.
- **Level breadcrumbs** (top left): Board > CPU > Core > Results, clickable.
- **Info tooltip**: a short plain-English explanation of whatever the camera is focused on, which doubles as the presentation script.

### 7.4 Visual style

- Dark board background, copper trace lines, soft neon accent colours; each process gets a stable colour that appears everywhere it does (chip, Gantt block, results).
- Depth through subtle shadows and layered parallax when the camera moves.
- Glow and pulse effects for activity; everything idle stays dim, so attention follows what is running.
- Typography: one monospace for readouts, one clean sans for labels.
- Respect reduced-motion settings with a simpler fade between levels.

### 7.5 Layout and camera spec (`src/scene/layout.ts`)

The scene lives in a **1600 by 1000 world coordinate space**. One `<svg>` fills the window; the camera animates its `viewBox`. Export every number below from `layout.ts` and import it everywhere else.

| Object | Position and size (world units) |
| --- | --- |
| Board (PCB) | x 40, y 40, width 1520, height 920, corner radius 24 |
| Power block and capacitors (decoration) | x 80, y 80, width 200, height 120 |
| CPU socket | centre (700, 400), 300 by 300 |
| CPU die | centre (700, 400), 220 by 220 |
| Core (one) | centre (700, 400), 90 by 90 |
| Scheduler block | on the die, centre (700, 322), 180 by 36 |
| Cache blocks (decoration) | four 36 by 36 blocks in the die corners |
| Ready queue (RAM) | 8 slots, each 240 by 36; slot `i` at x 1100, y `220 + 44 * i`; slot 0 is the front of the queue |
| Storage connector (job pool) | x 60, y 520, width 320, height 240; chip parking grid of 4 columns by 3 rows |
| Output port | centre (700, 90), 120 by 40; finished chips leave upward |
| Gantt strip | x 420, y 640, width 1060, height 100; the time axis scales so the whole makespan fits |
| Results layer (level L3 only) | four panels of 700 by 400 at (80, 100), (820, 100), (80, 540), (820, 540) |

**Traces (orthogonal polylines, exported as waypoint arrays)**

- Storage to RAM: out of storage at (380, 580), right along y 580 to the shared bus at x 1060, up the bus to the slot's y, then right to x 1100.
- RAM to CPU (dispatch): from the slot's left edge to x 1060, along the bus to y 400, then left to the socket edge at (850, 400).
- CPU to output: from (700, 250) straight up to (700, 110).

**Chips**

- Height 28, width `clamp(40 + 12 * burst, 56, 180)`, rounded corners, filled with the process colour, name inside.
- In storage, chips are drawn at 0.6 scale. In a RAM slot they are full size. On the core they scale up to fit the core.

**Camera levels** (each level is a world rectangle to fit into the window, centred, keeping the window's aspect ratio):

| Level | Rectangle to fit (x, y, width, height) | Shows |
| --- | --- | --- |
| L0 Board | (0, 0, 1600, 1000) | Whole board; chips as plain colours |
| L1 CPU package | (400, 180, 1100, 600) | Die, scheduler block, RAM queue, Gantt strip; chip names and remaining time |
| L2 Core | (560, 260, 280, 280) | Core with progress ring, quantum ring, context-switch flash; full chip details |
| L3 Results | (0, 0, 1600, 1000) | Same view as L0 with the results layer faded in over the board |

- **Transition:** tween the camera over 1.2 seconds with `power3.inOut`. Interpolate the centre linearly and the width in log space, so the zoom speed feels constant. Drive the `viewBox` from a ref inside the GSAP tween; do not re-render React on every frame.
- **Level of detail:** let `zoom = 1600 / viewBoxWidth`. Show chip names when `zoom >= 1.3`, and show detail (rings, remaining time, tooltips) when `zoom >= 3`. Fade labels in and out with opacity, never by mounting and unmounting during a tween.
- **Resizing:** recompute the `viewBox` from the current level rectangle and the new window aspect ratio, without animation.
- **Controls:** mouse wheel or pinch moves one level deeper or shallower (debounce 400 ms); clicking the CPU goes to L1 and clicking the core goes to L2; breadcrumbs and Escape move to a chosen level or one level out. Any manual input pauses auto-follow until the next Play.

## 8. Animation and interaction system

The animation layer is a player that reads the event timeline from the backend and turns each event into motion. It never calculates scheduling itself.

### 8.1 Core pieces

- **Virtual camera:** a position and zoom value applied to the whole scene. Moving between levels means animating the camera's centre and scale, with easing, over about 1 to 1.5 seconds.
- **Playback clock:** the simulation time `t`, advanced by a play/pause/speed control, or set directly by the scrubber.
- **Event player:** at each clock position it finds which events are active and drives the matching animation (see the event table in section 5.3).
- **Level manager:** a small state machine that owns the current zoom level and decides when auto-follow moves the camera.
- **Store:** a single shared state holding workload, results, current level, clock, selected algorithm and UI flags.

### 8.2 Level state machine

| From | Trigger | To |
| --- | --- | --- |
| Board (L0) | Click the CPU, or the first DISPATCH during auto-follow | CPU package (L1) |
| CPU package (L1) | Click a core, or Step into a slice | Core (L2) |
| Core (L2) | Back button, or the slice ends | CPU package (L1) |
| CPU package (L1) | Run finishes, or Compare is pressed | Results (L3) |
| Any level | Breadcrumb click or scroll wheel | The chosen level (manual control, auto-follow pauses) |
| Results (L3) | Click one mini-CPU | CPU package (L1) with that algorithm loaded |

### 8.3 Making playback smooth and scrubbable

- The animation is a **pure function of time**: given a clock value, the scene looks the same every time. This makes pause, step back and scrubbing trivial, because you simply set the clock.
- Precompute where every chip should be at every event boundary, then interpolate between them.
- Keep animations short (0.3 to 0.8 seconds) and speed them with the playback multiplier, so fast-forward stays legible.
- Animate only transform and opacity for smoothness; avoid animating heavy filters on many elements at once.
- Pause the timeline when the tab is hidden.

### 8.4 Interaction list

- Scroll or pinch to zoom between levels, drag to pan within a level.
- Click a chip to see its pid, arrival, burst, priority, remaining time and its metrics so far.
- Hover a Gantt block for its start, end and length.
- Keyboard: space to play or pause, arrow keys to step, 1 to 4 to switch algorithm, Escape to zoom out one level.
- Responsive layout: on narrow screens the drawer becomes a bottom sheet and the playback bar shrinks to icons; the scene keeps its aspect ratio and the camera frames the active area.

### 8.5 Event-to-animation spec

`buildTimeline(result: RunResult): gsap.core.Timeline` converts the engine's events into one GSAP master timeline. **One simulation tick lasts 1.0 second at 1x speed**; the speed control sets `timeline.timeScale()`. Every animation is positioned at an absolute time (`T = event.time * 1.0`), and short transfer animations (at most 0.6 s) always fit inside one tick.

| Event | Animation at the event's time |
| --- | --- |
| ARRIVE | The chip leaves its storage cell and travels the storage-to-RAM trace to the position of its slot (0.6 s), with a light pulse along the trace |
| ENQUEUE | The chip settles into the slot whose index equals its position in `event.queue`; chips already in the queue slide to their new indices (0.3 s) |
| DISPATCH | The scheduler block flashes and shows `note` (0.2 s fade); the chip travels the RAM-to-CPU trace and scales onto the core (0.5 s); the remaining chips slide forward |
| RUN | The core glows in the process colour for `duration` ticks; the progress ring drains in proportion to remaining burst; the Gantt segment grows from `start` to `end` |
| PREEMPT | The chip flashes red and travels back to its slot in the queue (0.4 s) |
| CONTEXT\_SWITCH | A white flash on the core and the counter near the CPU ticks up (0.2 s) |
| IDLE | The core dims and shows a small idle label for `duration` ticks |
| COMPLETE | The chip shows a green check, moves to the output port and fades out (0.5 s) |

**Rules that make scrubbing work**

- Build every tween with explicit start and end values (`fromTo`) at absolute positions. Never use tweens that depend on the previous tween's end state, or seeking backwards will break.
- The scene is a pure function of timeline progress. Callbacks may only write values derived from the current time into the store (clock, context-switch count, current scheduler note).
- Gantt strip: `x = ganttX + (t - t0) / makespan * ganttWidth`; reveal each segment with a growing width tied to the simulation clock.
- The player never imports the engine. It receives a `RunResult` and `layout.ts` only.
- Auto-follow: stay at L0 until the first DISPATCH, move to L1, and when the run ends hold L1 for 1.5 s and then move to L3. Core zoom (L2) is manual unless the user enables a Follow core toggle.

## 9. Scheduling concept to hardware metaphor

Every scheduling idea gets one visual, so the picture explains the theory.

| Scheduling concept | Hardware metaphor | Visual treatment |
| --- | --- | --- |
| Process | A small coloured chip | Name label, colour fixed per process |
| Arrival time | Chip leaves the storage connector | Slides out along a trace at its arrival tick |
| Ready queue | Chips waiting in RAM slots | Lined up in order; the order itself changes by algorithm |
| Burst time | Chip size and a progress ring | A longer burst is a wider chip; the ring drains as it runs |
| Priority | A badge on the chip | A number or star; the highest priority has a brighter rim |
| Scheduler | Control logic block on the die | Lights up during DISPATCH and shows its pick rule in one line |
| Dispatch | A bus transfer from RAM to the core | A light pulse carries the chip along the trace |
| Running | The core is active | Core glows in the process colour |
| Time quantum (Round Robin) | A countdown ring around the core | When it empties, the chip is bumped back to the queue |
| Preemption | The chip is ejected | A quick red flash and a slide back to the queue |
| Context switch | State save and load | A brief white flash and a counter tick |
| CPU idle | Core powered down | Dim and a small "idle" label |
| Completion | Chip leaves the board | Green check, and it slides off to an output port |
| Gantt chart | Logic analyser trace | Coloured blocks drawn along a timeline as the clock advances |
| Waiting time | Time spent sitting in a slot | Shown as a bar that fills while a chip waits |
| Algorithm comparison | Four CPUs side by side | Same workload, four chips, one winner badge |

## 10. Tech stack and project structure

One language, one project, no server: TypeScript with React and Vite, drawing the scene in SVG with GSAP for the camera and timelines. It is the fastest route to a smooth zoom animation by tomorrow.

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript | One language for engine and UI; catches type mistakes before the demo |
| Build and dev server | Vite with React | Starts in seconds with hot reload |
| Engine tests | Vitest | Runs in the same toolchain, no extra setup |
| Scene | Inline SVG | Sharp at every zoom level, easy to style and animate |
| Animation | GSAP | Timelines, easing and scrubbing out of the box |
| State | Zustand | Tiny shared store, almost no boilerplate |
| Styling | Plain CSS with variables | Fast to write, easy glow effects |
| Demo hosting | Run locally; optional Netlify or Vercel deploy | Local is the safest on demo day |

**Suggested folder layout**

```text
sched-motherboard/
  index.html
  package.json
  vite.config.ts           # includes the Vitest config
  tsconfig.json            # strict: true
  src/
    main.tsx
    App.tsx                # mounts <Scene/>, <Drawer/>, <PlaybackBar/>, <Breadcrumbs/>
    engine/
      types.ts             # the contract (section 5.1)
      validate.ts          # input validation with readable errors
      algorithms.ts        # pick rules (section 5.2a)
      simulate.ts          # the one simulator loop
      metrics.ts           # per-process and overall metrics
      compare.ts           # run all four, choose winner and reason
      presets.ts           # textbook example, convoy effect, starvation demo
      random.ts            # seeded random workload
      engine.test.ts       # tests from section 12
    data/
      sample-result.json   # hand-made RunResult for building the UI early
    store/
      useApp.ts            # Zustand store
    scene/
      layout.ts            # all geometry (section 7.5)
      Scene.tsx            # the <svg> and the camera hook
      Board.tsx  CpuPackage.tsx  Core.tsx  Ram.tsx  Storage.tsx
      Traces.tsx  Chip.tsx  GanttStrip.tsx  ResultsLayer.tsx
    camera/
      useCamera.ts         # viewBox tween, levels, resize handling
      levels.ts            # level rectangles and state machine
    player/
      buildTimeline.ts     # RunResult to GSAP timeline (section 8.5)
      usePlayer.ts         # play, pause, step, scrub, speed, auto-follow
    ui/
      Drawer.tsx  PlaybackBar.tsx  Breadcrumbs.tsx  Tooltip.tsx
    theme/
      theme.css            # CSS variables, glow styles
      palette.ts           # 12 process colours
  README.md
```

**Conventions**

- TypeScript strict mode, no `any`. One component per file.
- Engine functions are pure and deterministic: no `Date.now()`, no unseeded `Math.random()`.
- One Zustand store (`useApp`) holds: workload, settings, run, compare, level, followMode, playing, speed, progress.
- Scene components animate through refs and GSAP, never through per-frame React state updates.
- Colours and glows come from CSS variables in `theme.css`; the 12-colour process palette is defined once in `palette.ts`.
- `README.md` states how to run, test and build, and lists any decisions the agent made where this brief was open.

## 11. Build order and acceptance checks

Work through the milestones in order. Before moving on, run every acceptance check yourself: the tests, `npm run build`, and a look at the running app. Approximate effort with an agent is in the second column, so the day stays on track.

| # | Milestone (effort) | Deliverables | Acceptance checks |
| --- | --- | --- | --- |
| M0 | Scaffold (20 min) | Vite, React and TypeScript project; install gsap, zustand, vitest; the folder tree from section 10; `layout.ts` with every constant from 7.5; `types.ts` from 5.1; a hand-made `sample-result.json`; `theme.css` and `palette.ts` | `npm run dev` shows a dark empty page; `npm test` runs; `npm run build` succeeds |
| M1 | Engine (60 min) | `validate`, `algorithms`, `simulate`, `metrics`, `compare`, `presets`, `random`, and the tests from section 12 | All engine tests pass, including the invariants on 200 random workloads |
| M2 | Static board (60 min) | SVG board from `layout.ts`: board, power block, socket, die, core, scheduler block, RAM slots, storage grid, traces, output port, empty Gantt strip; chips drawn in storage for a loaded workload | At L0 every object from 7.5 is visible and positioned correctly; chips appear in storage cells |
| M3 | Camera and levels (60 min) | `useCamera`, level state machine, GSAP tween with log-space width, wheel and pinch, click-to-zoom, breadcrumbs, Escape, resize handling, level of detail | Smooth L0 to L1 to L2 and back; resizing keeps the framing; labels fade in by zoom; manual input pauses auto-follow |
| M4 | Event player (90 min) | `buildTimeline`, `usePlayer`, chip movement for every event type, scheduler note, core glow and rings, Gantt growth, clock and context-switch counter, playback bar with play, pause, step, speed and scrubber, auto-follow | A replay test confirms the DISPATCH order equals the engine's segment order; scrubbing to any time gives the same scene as playing to it; stepping backwards works |
| M5 | Workload drawer and algorithm switching (45 min) | Collapsible drawer with editable process table, presets, random generator, quantum and preemptive controls, validation messages; four algorithm selectors on the CPU; re-run on any change | Changing algorithm or workload re-runs and replays with the same chip colours; invalid input shows a readable message and does not crash |
| M6 | Results level (45 min) | `compareAll` wired in; at L3 four mini-CPUs with mini Gantt strips and the three averages; winner badge and reason line; click a mini-CPU to replay that algorithm | All four results match the engine; the winner is the lowest average waiting time |
| M7 | Polish and hardening (60 min) | Glows, subtle parallax, reduced-motion mode, narrow-screen layout, performance pass, README | Holds about 60 fps with 12 processes; works at phone width; `npm run build` output runs from `npm run preview` |

**If time runs short, cut in this order**

1. Core zoom (L2) and the quantum ring.
2. Preemptive SJF and Priority, and any other should-have item.
3. Parallax and extra glows.
4. Narrow-screen layout.
5. Never cut: the engine tests, the Gantt strip, the zoom from board to CPU, and the four-algorithm comparison.

**Definition of done**

- Every item in the Must have tier (section 3) works.
- `npm test` and `npm run build` pass with no errors or type warnings.
- A person who has never seen the app can load a preset, press Play, watch the zoom, and say which algorithm won, using only what is on screen.

## 12. Testing and verification

The engine must be provably right, because the visuals are only as trustworthy as the numbers. Test the engine hard and the scene lightly.

**Engine tests (Vitest)**

| Test | What it checks |
| --- | --- |
| Textbook cases | Known workloads with published answers for each algorithm: Gantt segments and every metric |
| Idle gap | First process arrives late, or a gap occurs mid-run; idle segment appears and the clock jumps correctly |
| Ties | Same arrival, same burst or same priority; results follow the stated tie rules |
| Single process | Waiting is 0, response is 0 |
| Round Robin quantum | Quantum larger than every burst gives the same result as FCFS; quantum 1 gives the most context switches |
| Preemption | SRTF and preemptive Priority preempt exactly when a better process arrives |
| Invariants (on every run) | Turnaround = completion minus arrival; waiting = turnaround minus burst; total run time per process = its burst; segments never overlap; busy time + idle time = makespan |
| Random fuzzing | Hundreds of random workloads, checking the invariants above |
| Validation | Bad input (negative burst, empty workload) returns a clear error |

**Today's minimum:** the textbook cases for all four algorithms, the idle-gap case, the invariants on a few random workloads, one replay check, and one full demo run on the exact build you will present. Treat everything else in this section as nice to have.

**Frontend checks**

- Replay check: for each preset, the sequence of animated dispatches equals the engine's segment list.
- Scrub check: set the clock to random times and confirm every chip is in the position the timeline says.
- Level check: every transition in the state machine table can be triggered and reversed.
- Visual checks in a desktop browser, a small laptop window and a phone-sized window.
- Performance: stays smooth with 12 processes and a long run (target 60 frames per second on a normal laptop).
- Accessibility: keyboard control works, text contrast is readable, reduced-motion mode works, and the results are also available as a plain table.

**Final acceptance:** an outsider who has never seen the project can load a preset, press Play and say which algorithm won and why, using only what is on screen.

## 13. Pitfalls and stretch goals

**Pitfalls to avoid**

- Doing scheduling maths in React components or in the player. The engine is the only source of truth.
- Updating React state every animation frame. Animate through refs and GSAP.
- Tweens that depend on the previous tween's end state. They break scrubbing and stepping backwards.
- SVG filters or blur on many elements at once. Limit glow to the active chip and the core.
- Hard-coding coordinates outside `layout.ts`.
- Dashboard-style panels. If a number needs showing, put it on the hardware.
- Mounting and unmounting labels during a camera tween. Fade opacity instead.
- Non-deterministic engine output, such as unseeded random numbers.
- Spending time on art before the engine tests pass and the camera works with plain shapes.

**Stretch goals, in suggested order**

1. Preemptive SJF (SRTF) and preemptive Priority toggles.
2. Quantum sweep chart: average waiting time as the quantum changes.
3. Multi-core mode with several cores on the die.
4. A guided tour mode that narrates each level automatically.
5. RAM and cache zoom levels that tie into memory concepts.
6. Sound cues and a light theme.
7. Shareable links that encode a workload.
