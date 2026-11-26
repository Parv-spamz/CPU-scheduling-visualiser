import type { Level } from '../../scene/layout';
import { useApp } from '../../store/useApp';
import './tooltip.css';

const LEVEL_HELP: Record<Level, string> = {
  L0: 'The motherboard: jobs wait in storage, travel to RAM and queue for the CPU. Press Play or click the CPU.',
  L1: 'Inside the CPU: the scheduler picks the next job from the RAM queue using the current rule.',
  L2: 'One core: the running job, its remaining burst and the time-slice ring.',
  L3: 'Results: all four algorithms ran the same jobs. Lowest average wait wins.',
};

/** One line of plain-English context, just above the playback bar. */
export default function Tooltip() {
  const tooltip = useApp((s) => s.tooltip);
  const level = useApp((s) => s.level);
  const text = tooltip.trim() || LEVEL_HELP[level];
  return (
    <p className="ui-tooltip" title={text}>
      {text}
    </p>
  );
}
