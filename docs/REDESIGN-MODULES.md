# Frontend redesign: module map

This splits the frontend into modules that can be redesigned one at a time, or in parallel by separate
agents, without editing each other's files. Each module owns one folder. It reads shared state through the
contracts below and never writes another module's state.

```
src/
├─ engine/  store/  player/  camera/levels.ts  scene/      LOCKED FOUNDATION (logic, not visuals)
├─ theme/  ui/chrome.css  three/kit/                        R0 design system (shared, one owner)
├─ three/
│  ├─ stage/        R1 stage: lights, environment, quality tiers, loading screen, failure notice
│  ├─ room/         R11 room: the teenager's bedroom the board sits in (bed, props, furniture)
│  ├─ board/        R2 board: PCB, copper routing, SMD parts, VRM, slots, connectors, ICs
│  ├─ peripherals/  R3 peripherals: M.2 SSD, memory modules, rear I/O, glowing data traces
│  ├─ cpu/          R4 CPU: socket, die, core, heat spreader, overload glow
│  ├─ chips/        R5 process packets
│  ├─ instruments/  R6 on-board indicators: POST code display, VRM phase LEDs
│  ├─ results/      R7 results level
│  └─ camera/       R8 camera and motion
└─ ui/
   ├─ algo/ breadcrumbs/ drawer/ playback/ tooltip/   R9 2D chrome
   └─ a11y/                                     R10 accessibility (keyboard, screen-reader table)
```

## Ground rules

1. **The foundation is locked.** `src/engine`, `src/store`, `src/player`, `src/camera/levels.ts`,
   `src/scene/resultsModel.ts` are behaviour, not design. A redesign never changes them. If a module
   needs new data, ask the lead (the main session) to add a store field or `rt` field.
2. **Positions live in `src/scene/layout.ts`, in millimetres on a real 244 × 305 mm ATX board.** Every
   part has its real-world size and place (socket 47.5 mm, DIMMs 133 mm, PCIe pitch 20.32 mm, M.2 2280).
   `kit/space.ts` converts millimetres to world units (`mm()`, 0.05 per mm). Moving or resizing a part means editing its rect there.
   This file is shared, so only one module changes it at a time, and every module that reads the rect is
   checked afterwards (see "Shared geometry").
3. **Shared look lives in R0.** Colours, fonts, glow colours, shaders, the `damp()` helper and part
   heights (`kit/space.ts`) belong to R0. Other modules use them and don't redefine them locally. If a
   module needs a new token, R0 adds it first.
4. **State flows one way.** Scene modules read `useApp` (store) and `rt` (per-frame runtime). Only the
   writers listed below may write. No `setState` inside `useFrame` except the coarse writes in
   `PlayerDriver`.
5. **Every module keeps its information.** A redesign may restyle anything but must keep the facts the
   part shows (see each module's "Must keep") and its click and hover behaviour.
6. **No text on the board.** Parts carry no labels or printed names; the board explains itself through
   light and motion, and words live in the 2D overlay (tooltip, drawer, playback bar). Only the L3 results
   panels carry text, because they are a data read-out.
7. **No network, no image files.** Textures stay procedural (canvas) and fonts stay bundled. This keeps
   the app offline.
8. **Done means:** `npm test` and `npm run build` pass, the module is checked in the browser at L0–L3,
   the console is clean, and the phone width (375×812) still frames the board.

## Contracts

### Store (`useApp`): what the scene and UI may read and call

| Field / action | Meaning | Used by |
| --- | --- | --- |
| `run`, `compare` | Engine output for the selected algorithm, and all four | R4, R5, R6, R7, R9, R10 |
| `settings`, `workload`, `errors` | Inputs and validation errors | R9 (drawer, algorithm switch) |
| `level`, `setLevel(l, {manual})` | Current zoom level; `manual: true` stops auto-follow | R4 (clicks), R7, R8, R9 |
| `playhead` | Clock tick, context-switch count, scheduler note, running pid, queue | R4, R5, R6 |
| `playing`, `speed`, `progress`, `seek`, `play`, `pause` | Playback | R7, R9, R10 |
| `setAlgorithm` | Switch algorithm (re-runs the engine) | R7, R9, R10 |
| `tooltip`, `setTooltip`, `selectPid` | Hover/click description line | all scene modules, R9 |
| `reducedMotion` | Shorter, calmer motion | R1, R4, R7, R8 |
| `followCore`, `drawerOpen` | UI flags (the player reads `followCore` for auto-zoom) | R9 |

### Runtime (`src/player/runtime.ts`): per-frame values, read inside `useFrame`

| Field | Written by | Read by |
| --- | --- | --- |
| `rt.sec`, `rt.t`, `rt.run`, `rt.plan`, `rt.clock` | `player/PlayerDriver` | R3, R4, R5, R6 |
| `rt.load` (0..1 smoothed queue pressure) | `player/PlayerDriver` | R4 (overload glow), R6 (load bar) |
| `rt.ihsLift` (0 seated .. 1 lifted) | R4 `cpu/Socket` | R1 (shadow re-bake), R5 (chip height on core) |
| `rt.results` (0..1 deck rise) | R7 `results/ResultsDeck` | R1 (shadow re-bake) |

Chip motion is a pure function of time: `chipFrameAt(plan, pid, rt.sec)` in `player/sceneState.ts`.
Never animate a chip from its previous frame's position, or scrubbing breaks.

### Shared geometry

| Constant (`scene/layout.ts`, `three/kit/space.ts`) | Owner | Also read by |
| --- | --- | --- |
| `SOCKET`, `DIE`, `CORE`, `SCHEDULER`, `CACHE_BLOCKS`, `CPU_STACK`, `H.ihsLift` | R4 | R5 (chips land on the core), R8 (framing), R2 (keep-out) |
| `RAM_SLOT`, `ramSlotCenter`, `H.ramSlot` | R3 | R5, R2 (keep-out, traces) |
| `STORAGE`, `storageCellCenter`, `H.storageFloor` | R3 | R5, R2 |
| `OUTPUT_PORT`, trace helpers (`traceStorageToSlot`, …) | R3 | R5 (paths), R2 (copper) |
| `GANTT`, `CLOCK_READOUT`, `ALGO_RING`, `ALGO_BUTTON` | R6 | R2 (keep-out) |
| `RESULT_PANELS`, `RESULT_PANEL_SIZE`, `H.resultsFloat` | R7 | R8 |
| `LEVEL_RECTS`, `CAMERA` | R8 | |
| `BOARD`, `POWER_BLOCK`, `H.pcb` | R2 | everything sits on the board |

`board/pcbTexture.ts` keeps copper and SMD parts out of `KEEP_OUT`, which is built from the other
modules' rects. After moving any part, regenerate and check that no traces run under it.

## Modules

### R0 · Design system (first, single owner)
- **Files:** `src/theme/theme.css` (CSS tokens), `src/theme/palette.ts` (process colours),
  `src/ui/chrome.css` (2D panel surface, buttons, inputs), `src/three/kit/` (`space.ts` heights and
  coordinate mapping, `fonts.ts`, `materials.ts` with `COLORS`, ring and flow shaders, glow sprite,
  `damp`, `canvasTexture.ts` with texture helpers and brushed metal).
- **Decides:** the palette (board, metal, glow accents, the overload red, the per-process colours),
  type scale, 3D font sizes (`FONT_SIZE`), panel style, motion timing.
- **Must keep:** the 12 process colours must stay distinct from each other and from the overload red.
  Text must meet WCAG AA contrast.
- **Output:** a short style note at the top of `theme.css`. All other modules build on it.

### R1 · Stage (`three/stage/`)
- **Depicts:** the room the board sits in: backdrop, desk, lighting, reflections, bloom and
  ambient occlusion, the boot screen, the WebGL failure notice.
- **Files:** `Scene3D.tsx` (Lights, ShadowBaker, Effects tiers, Ready), `Boot.tsx` (loading screen), `SceneGuard.tsx`,
  the `.boot` and `.vignette` styles in `theme.css`.
- **Must keep:** `?fx=0` turns effects off and `?no=ao,bloom` drops single effects; the performance monitor
  moves between three tiers (0 plain, 1 bloom, 2 bloom + ambient occlusion) from measured frame times;
  the vignette is a CSS overlay (free for the GPU); no point lights (each one costs every pixel);
  shadows re-bake only while `rt.ihsLift` or `rt.results` changes; fog must not hide the board at phone width.

### R11 · Room (`three/room/`)
- **Depicts:** a teenager's bedroom at night, with the board lying on a quilted duvet. The bed is kept
  clear: two pillows and a bolster, headphones, a phone, a book and a folded throw. Around it: desk with a
  monitor and lamp, bedside lamp, window with pleated curtains, four posters, fairy lights, a neon bolt,
  a shelf with a vase, a skateboard, a rug and a backpack. Props are real size relative to the board and
  use muted, believable materials (no saturated toy colours).
- **Materials:** photographic CC0 PBR sets (`pbr.ts`, desaturated at load so a tint sets the hue) for the duvet,
  pillows, throw, curtains, floor, walls and wood; the duvet's quilting is a generated normal and occlusion map;
  contact-shadow blobs sit under the props; lamp, monitor and moon light are additive pools and sprites (no
  real lights).
- **Files:** `Room.tsx` (shell, bed, furniture), `BedProps.tsx`, `parts.tsx` (box and cylinder
  helpers), `shapes.ts` (pillow, duvet, curtain, vase and fold geometry), `roomTextures.ts` (canvas textures).
- **Must keep:** the camera never leaves the room (`CameraRig` limits target, distance and azimuth);
  matte parts use the Lambert shader and the duvet is drawn unlit with a shadow-only plane over it,
  because the room covers most of the screen; matrices are frozen after mount; no text that names anything.

### R2 · Board (`three/board/`)
- **Depicts:** the motherboard itself, at real scale: black solder mask with copper routing, vias,
  silkscreen outlines (no text), SMD resistors and capacitors; VRM heatsinks, heat pipe, chokes and
  capacitors, EPS 8-pin; PCIe slots, chipset heatsink, ATX 24-pin, USB 3 header, SATA ports, pin
  headers, support ICs, CMOS battery, power and reset buttons.
- **Files:** `Pcb.tsx`, `pcbTexture.ts`, `PowerDelivery.tsx`, `Components.tsx`.
- **Must keep:** nothing routes under another module's part (`KEEP_OUT`); textures stay procedural.

### R3 · Peripherals (`three/peripherals/`)
- **Depicts:** where processes wait and travel: the M.2 SSD (processes not yet arrived rest on it as
  light packets), four memory modules whose RGB light bars are the ready queue (three segments each,
  module nearest the CPU first, top segment first; a lit segment takes the process colour), the rear
  I/O stack (finished processes leave through the network port, whose activity LED blinks), and glowing
  traces that light up while a packet travels them.
- **Files:** `M2Drive.tsx`, `MemoryBank.tsx`, `RearIO.tsx`, `FlowTraces.tsx`.
- **Must keep:** light-bar segment order is queue order; segment hover/click describes and selects the
  process; trace pulses only while a matching move is in progress; LAN activity blink on exit.

### R4 · CPU (`three/cpu/`)
- **Depicts:** the CPU at real scale: LGA socket, steel load plate and lever (they swing open at L1/L2),
  substrate, silicon die, the system-agent strip (flashes on dispatch), the core (glows in the running process's
  colour), the progress and quantum rings, the context-switch flash, IDLE, the heat spreader that lifts
  off at L1/L2, and the **overload glow** (halo, red light, red-tinted lid and core driven by `rt.load`).
- **Files:** `Socket.tsx`, `cpuTextures.ts` (die, heat spreader, substrate, core floorplan). No text.
- **Must keep:** click package → L1, click core → L2 (with the drag guard); heat spreader click works
  only while seated; the red glow starts once about 2 processes are waiting (`rt.load` 0.45) and is full at 4;
  `rt.ihsLift` stays the single source of the lid position.

### R5 · Process packets (`three/chips/`)
- **Depicts:** each process as a capsule of light in its own colour, with a glow on the board below.
  It shows while it rests on the SSD and while it travels (arcing over parts, red while preempted).
  In the queue the memory light bar shows it, and on the CPU the core glow shows it, so the packet hides.
- **Files:** `Packets.tsx`, `describe.ts` (the tooltip sentence, shared with `MemoryBank`).
- **Must keep:** pose from `chipFrameAt` only; length encodes burst (`chipWidth`); colour comes from
  the process; hover and click show the description and select the pid.

### R6 · On-board indicators (`three/instruments/`)
- **Depicts:** the parts a real board uses to report state: the two-digit POST code display counts
  context switches, and the eight VRM phase LEDs light up green → amber → red with CPU load.
- **Files:** `Indicators.tsx`.
- **Must keep:** POST digits = `playhead.contextSwitches % 100`; lit LEDs follow `rt.load`.

### R7 · Results (`three/results/`)
- **Depicts:** the L3 comparison: the board dims, four panels rise, each with a mini CPU, mode line,
  average waiting / turnaround / response, context switches, utilisation, makespan, a mini Gantt on a
  shared axis; the winner is marked, the runner-up labelled, the verdict sentence shown.
- **Files:** `ResultsDeck.tsx` (uses `cpu/cpuTextures.ihsTexture` for the mini CPU; read-only).
- **Must keep:** numbers from `compare` via `scene/resultsModel.ts` (`fmt2`); panel click → that
  algorithm, L1, play; writes `rt.results`.

### R8 · Camera and motion (`three/camera/`)
- **Depicts:** how the viewer moves: an orbit that stays around the board (drag to rotate within about
  ±115°, wheel or pinch to zoom, right-drag or two-finger drag to pan; the look-at point is boxed in to
  the bed), per-level default views (`AZIMUTH`, `POLAR`, `PAD`,
  `TARGET_Y`), narrow-screen crop, Escape (one level out), R or the reset button (default view,
  `RESET_VIEW_EVENT` in `src/camera/events.ts`), transition timing.
- **Files:** `CameraRig.tsx`.
- **Must keep:** manual input sets follow off and keeps the user's view through resizes; reduced motion shortens transitions; every level
  fits at 16:9 and at 375×812.

### R9 · 2D chrome (`ui/algo`, `ui/breadcrumbs`, `ui/drawer`, `ui/playback`, `ui/tooltip`, `ui/insights`, `ui/help`)
- **Also:** an Insights card (run metrics and a one-click comparison of the four algorithms) and a shortcut sheet (?).
- **Depicts:** the overlay controls: zoom breadcrumbs, the workload drawer (a liquid-glass pane: frosted
  backdrop, bright top edge, sheen; the breadcrumbs, algorithm switch, playback bar and tooltips share the
  same glass tokens from `chrome.css`) (presets, random,
  process table, quantum, preemptive, priority direction, follow core, copy link, CSV), the algorithm
  switch with the reset-view button, the playback bar (step, play/pause, a scrubber whose track is the
  run's Gantt chart, tick readout, speed), the one-line description strip.
- **Files:** each folder's `.tsx` and its own `.css`; shared controls come from `ui/chrome.css` (R0).
- **Must keep:** "no dashboard" (overlays stay slim and translucent); drawer becomes a bottom sheet
  under 720 px and closes itself at L1/L2; the bar goes icon-only on narrow screens; all controls
  labelled and keyboard reachable.

### R10 · Accessibility (`ui/a11y/`)
- **Depicts:** nothing visible: the screen-reader comparison table and global keyboard shortcuts
  (Space, arrows, 1–4, Escape, R).
- **Files:** `ResultsTable.tsx`, `useKeyboard.ts`.
- **Must keep:** table mirrors the results panels; shortcuts ignore keystrokes inside inputs.
  Review every other module's output for contrast, focus states and reduced motion at the end.

## Suggested order

| Wave | Modules | Why |
| --- | --- | --- |
| 1 | R0 | Everyone else consumes its tokens |
| 2 | R1, R2, R4, R9 in parallel | Independent folders; set the overall look |
| 3 | R3, R5, R6, R7, R8, R11 in parallel | Depend on the look and on CPU/board geometry from wave 2 |
| 4 | R10 + a full pass | Accessibility review, phone width, perf (`?fx=0` vs on), demo run on `npm run preview` |

If a module needs to move a part (edit `layout.ts`), run it alone or coordinate through the lead,
because R2's keep-out zones, R5's chip paths and R8's framing all read the same rects.
