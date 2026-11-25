import { useRef } from 'react';
import { LEVEL_RECTS } from './layout';
import { useCamera } from '../camera/useCamera';
import { usePlayer } from '../player/usePlayer';
import Board from './Board';

/** The single full-screen <svg>. The camera drives its viewBox; children draw the world. */
export default function Scene() {
  const svgRef = useRef<SVGSVGElement>(null);
  useCamera(svgRef);
  usePlayer(svgRef);
  const r = LEVEL_RECTS.L0;
  return (
    <svg
      ref={svgRef}
      className="scene"
      viewBox={`${r.x} ${r.y} ${r.width} ${r.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label="Motherboard scheduling scene"
    >
      <Board />
    </svg>
  );
}
