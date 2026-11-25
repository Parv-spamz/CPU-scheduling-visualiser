# CPU Scheduling Motherboard Visualizer

An interactive, zooming motherboard that visualises FCFS, SJF, Priority and Round Robin scheduling.
Requirements: `docs/BRIEF.md`. Implementation plan and work packages: `PLAN.md`.

## Run

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # Vitest
npm run build     # type-check (strict) + production build
npm run preview   # serve the production build
```

## Status

- [x] M0 scaffold and locked contracts (`types.ts`, `layout.ts`, `targets.ts`, store, palette, theme, sample result)
- [x] M1 engine (WP-A) · M2 static scene (WP-B) · M3 camera (WP-C) · M5 UI chrome (WP-D)
- [x] M4 player (WP-E) · M6 results + algorithm ring (WP-F)
- [x] 3D rebuild (replaces the SVG scene, see below) · [ ] M7 final polish (WP-G)

## 3D scene (supersedes the brief's SVG/GSAP stack)

The owner asked for a photoreal, interactive 3D motherboard instead of the 2D SVG board, so the scene is
now `three` + `@react-three/fiber` + `drei` + `@react-three/postprocessing` (`src/three/`).

- `src/scene/layout.ts` stays the single source of geometry. `src/three/space.ts` maps layout x → X and
  y → Z (Y up, `U = 0.01` world units per layout unit) and holds part heights.
- Playback is a pure function of `rt.sec` (`src/player/runtime.ts`), advanced in the render loop by
  `PlayerDriver`. The store only gets coarse writes (playhead on tick change, progress at ~10 Hz).
  `src/player/sceneState.ts` derives chip, core and readout state; `sceneState.test.ts` checks dispatch
  order against the engine, scrub purity and that every chip retires.
- Overload glow: CPU load = `min(1, readyQueueLength / 4)`, smoothed. It drives a red halo, a red point
  light, the heat spreader's emissive tint, the core colour and the load bar.
- All textures are procedural canvases and fonts are bundled `@fontsource` files: no network at runtime.
- Shadows are baked on demand (only re-rendered while the heat spreader lifts or the results deck moves);
  chips use contact-shadow sprites.
- `?fx=0` disables post-processing. A performance monitor drops AO and tilt-shift on slow GPUs.
- Narrow / portrait windows frame the centre of each level instead of its full width.
- GSAP and the SVG-era viewBox camera maths were removed; `src/camera/levels.ts` keeps only the level
  state machine and the gesture gate.
- `PLAN.md` still describes the original SVG work packages; the engine, store, camera levels and replay
  plan contracts from it are unchanged.

## Shareable links

The address bar always holds the current workload and settings, e.g.
`#w=0.5.2,1.3.1,2.8.4&a=rr&q=2&p=0&h=1` (`w` = arrival.burst.priority per process, `a` algorithm,
`q` quantum, `p` preemptive, `h` lower number = higher priority). Opening or pasting such a link loads
it; a malformed hash is ignored and the default preset loads. Code: `src/store/share.ts`,
`src/store/useShareLink.ts`.

## Engine extras

- `quantumSweep(processes, settings)` runs Round Robin for every quantum from 1 to the longest burst
  (beyond that RR equals FCFS) and reports the best quantum. Not drawn in the scene yet.

## Decisions where the brief was open

- ARRIVE/ENQUEUE fire at the real arrival time, even mid-slice; events sort by `(time, type rank, emission order)`.
- `remaining` on DISPATCH is before the slice; on RUN/PREEMPT/COMPLETE it is after.
- `CONTEXT_SWITCH.pid` is the incoming process.
- Engine API returns `{ ok, result | errors }` instead of throwing.
- Compare winner ties break in the order FCFS, SJF, Priority, RR.
- Simultaneous arrivals emit all ARRIVE events before their ENQUEUE events (ARRIVE, ARRIVE, ENQUEUE, ENQUEUE).
- Round Robin: when a quantum expires with an empty queue, the same process gets PREEMPT, ENQUEUE, DISPATCH
  and a new segment, without a context switch. Slice merging applies only to SRTF and preemptive Priority.
- The `preemptive` flag is ignored for FCFS and Round Robin.
- Storage chips use `storageChipScale(burst)` (at most 0.6) so wide chips never overflow their cell.
- Two cache blocks sit on the die sides below the scheduler block instead of the top corners, which the
  brief's scheduler position would cover.
- The four algorithm selectors sit in one row above the socket, clear of the storage-to-RAM trace.
- The workload drawer closes itself when the camera enters the CPU or core level, so it never covers the CPU.
- Full list: `PLAN.md` §3.1.
