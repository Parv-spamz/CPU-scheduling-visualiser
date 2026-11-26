<p align="center">
  <img src="assets/banner.svg" alt="CPU Scheduling Motherboard Visualizer" width="880">
</p>

<p align="center">
  <strong>An interactive 3D motherboard that shows how FCFS, SJF, Priority and Round Robin schedule processes, from the disk to the CPU, one event at a time.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tests-104%20passing-10b981?style=for-the-badge" alt="104 tests passing" />
  <img src="https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Three.js-3D-000000?style=for-the-badge&logo=threedotjs&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript strict" />
</p>

<p align="center">
  <a href="#what-it-shows">What it shows</a> &bull;
  <a href="#algorithms">Algorithms</a> &bull;
  <a href="#controls">Controls</a> &bull;
  <a href="#getting-started">Quickstart</a> &bull;
  <a href="#how-it-is-built">Architecture</a> &bull;
  <a href="#limitations">Limitations</a>
</p>

---

## Overview

An operating system decides which ready process gets the CPU next, and the choice changes how long every
process waits. This project makes that decision visible. You load a workload of processes, pick an
algorithm, and watch each process leave the storage bay, travel across the board to RAM, queue for a
memory slot, and run on the CPU core. A results view then compares all four algorithms on the same
workload and names the one with the lowest average waiting time.

The scene is a real-scale ATX motherboard rendered in 3D with React Three Fiber, set on a bed in a
teenager's bedroom. The camera stays around the board.

---

## What it shows

| Area | What you see |
| :--- | :--- |
| **Storage to RAM** | Processes travel from the SSD across the board, arriving in the order they enter the system. |
| **Ready queue** | The four DDR5 slots light up as the ready queue; each segment is one waiting process. |
| **CPU core** | The running process glows on the socket, with the scheduler's decision shown as a short note. |
| **Gantt chart** | The playback scrubber is the Gantt chart: each segment is coloured by the process that ran. |
| **Results** | Per-process waiting, turnaround and response times, averages, CPU utilisation, context switches and a CSV export. |
| **Insights** | Live run metrics and a one-click comparison of the four algorithms by average waiting time. |

---

## Algorithms

| Algorithm | Behaviour | Options |
| :--- | :--- | :--- |
| **FCFS** | First come, first served. Non-preemptive. | None |
| **SJF** | Shortest job first. Non-preemptive, or preemptive (shortest remaining time). | Preemptive |
| **Priority** | Highest priority first, lower number first. Non-preemptive, or preemptive. | Preemptive, priority direction |
| **Round Robin** | Each process runs for a fixed time quantum, then goes to the back of the queue. | Quantum |

The engine is a pure TypeScript module with no UI dependencies, so every result can be checked with the
unit tests in `src/engine`.

---

## Controls

| Input | Action |
| :--- | :--- |
| **Space** | Play or pause |
| **← →** | Step to the previous or next event |
| **1 – 4** | FCFS, SJF, Priority, Round Robin |
| **[  ]** | Slower or faster playback |
| **D** | Open or close the workload drawer |
| **F** | Follow the running process |
| **I** | Show or hide the insights card |
| **R** | Reset the camera view |
| **Esc** | Zoom out one level |
| **?** | Show all shortcuts |
| **Drag · wheel · right-drag** | Orbit, zoom and pan the board |

The workload drawer edits arrival time, burst time, priority and quantum for each process, loads presets,
generates random workloads, and copies a share link that restores the same run.

---

## Getting started

Requires a current Node.js LTS release.

```bash
git clone https://github.com/Parv-spamz/CPU-scheduling-visualiser.git
cd CPU-scheduling-visualiser
npm install
npm run dev        # http://localhost:5173
```

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Development server |
| `npm test` | Vitest unit tests (104 tests) |
| `npm run build` | Strict type-check and production build |
| `npm run preview` | Serve the production build on port 4173 |

Debug flags for the URL: `?fx=0` turns post-processing off, `?no=bloom,ao` drops single effects, and
`?debug=1` exposes the renderer and the chosen quality tier in the console.

---

## How it is built

| Layer | Path | Role |
| :--- | :--- | :--- |
| **Engine** | `src/engine` | Pure scheduling simulation, validation and comparison. |
| **Store** | `src/store` | Zustand state: workload, settings, run results, playback, share links. |
| **Player** | `src/player` | Turns a run into timed keyframes for the chips and the Gantt scrubber. |
| **Scene** | `src/three` | The 3D board, CPU, memory, storage and bedroom, built procedurally with React Three Fiber. |
| **Camera** | `src/camera` | Orbit camera bounded to the board, with the reset and zoom-level rules. |
| **UI** | `src/ui` | Breadcrumbs, algorithm switch, playback bar, drawer, tooltip, insights, shortcut sheet. |

The 3D scene uses no 3D model files. The board, chips and furniture are generated in code. The bedroom
uses six CC0 photographic textures from [Poly Haven](https://polyhaven.com), kept in `public/assets/tex/`.

Quality adapts to the device: the scene picks one of three effect tiers after warm-up, from the measured
frame time, and never flips back and forth during playback.

---

## Repository layout

```text
CPU-scheduling-visualiser/
├── assets/banner.svg        # README banner
├── docs/
│   ├── BRIEF.md             # Original requirements
│   └── REDESIGN-MODULES.md  # Module map for the frontend redesign
├── public/assets/tex/       # CC0 PBR textures for the bedroom
├── src/
│   ├── engine/              # Scheduling algorithms, validation, comparison
│   ├── store/               # Zustand store and share links
│   ├── player/              # Keyframes and playback driver
│   ├── three/               # 3D motherboard, CPU, memory, storage, bedroom
│   ├── camera/              # Orbit camera rig
│   ├── ui/                  # 2D overlay controls
│   └── scene/               # Layout constants and results model
├── PLAN.md                  # Implementation plan and work packages
└── package.json
```

---

## Limitations

- The workload is a simplified model: processes are CPU bursts only, with no I/O waits and no context-switch cost.
- Performance depends on the GPU. The scene is tuned for integrated graphics, but very old devices may
  run it at lower quality.
- The bedroom textures are third-party photographs. They are CC0, but they are not part of this project's
  licence.

---

<p align="center">
  Built by <strong>Parv Arora</strong>
</p>
