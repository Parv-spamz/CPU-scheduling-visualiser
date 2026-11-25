import { useApp } from '../store/useApp';
import { PROCESS_PALETTE } from '../theme/palette';
import Defs from './Defs';
import Pcb from './Pcb';
import Traces from './Traces';
import Storage from './Storage';
import Ram from './Ram';
import CpuPackage from './CpuPackage';
import OutputPort from './OutputPort';
import Readouts from './Readouts';
import GanttStrip from './GanttStrip';
import TracePulses from './TracePulses';
import ChipLayer from './ChipLayer';
import './scene.css';

/**
 * The whole world, in z-order: PCB and decoration, traces, components, Gantt, pulses, chips.
 * AlgorithmRing (L1) and ResultsLayer (L3) belong between the Gantt strip and the chips layer.
 */
export default function Board() {
  const run = useApp((s) => s.run);
  const workload = useApp((s) => s.workload);
  const settings = useApp((s) => s.settings);
  const playhead = useApp((s) => s.playhead);
  const setTooltip = useApp((s) => s.setTooltip);

  const processes = run?.processes ?? workload;
  const shownSettings = run?.settings ?? settings;
  const running = processes.find((p) => p.pid === playhead.runningPid);
  const glowFill = running?.color ?? processes[0]?.color ?? PROCESS_PALETTE[0];

  return (
    <g>
      <Defs />
      <Pcb />
      <Traces />
      <Storage processes={processes} />
      <Ram />
      <CpuPackage settings={shownSettings} note={playhead.note} glowFill={glowFill} />
      <OutputPort />
      <Readouts clock={playhead.clock} contextSwitches={playhead.contextSwitches} />
      <GanttStrip run={run} setTooltip={setTooltip} />
      <TracePulses />
      <ChipLayer
        processes={processes}
        run={run}
        runningPid={playhead.runningPid}
        clock={playhead.clock}
        lowerIsHigherPriority={shownSettings.lowerIsHigherPriority}
      />
    </g>
  );
}
