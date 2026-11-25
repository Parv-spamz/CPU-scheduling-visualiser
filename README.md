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
- [ ] M4 player (WP-E) · M6 results + algorithm ring (WP-F)
- [ ] M7 polish (WP-G)

## Decisions where the brief was open

- ARRIVE/ENQUEUE fire at the real arrival time, even mid-slice; events sort by `(time, type rank, emission order)`.
- `remaining` on DISPATCH is before the slice; on RUN/PREEMPT/COMPLETE it is after.
- `CONTEXT_SWITCH.pid` is the incoming process.
- Engine API returns `{ ok, result | errors }` instead of throwing.
- DOM hook names shared by scene and player live in `src/scene/targets.ts` (string constants, no geometry).
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
