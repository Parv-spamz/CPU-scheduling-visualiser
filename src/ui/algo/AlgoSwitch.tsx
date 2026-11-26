import { ALGORITHMS, ALGORITHM_LABEL } from '../../engine/types';
import { useApp } from '../../store/useApp';
import { RESET_VIEW_EVENT } from '../../camera/events';
import './algo.css';

/** Algorithm picker (segmented control) plus a button that returns the camera to its default view. */
export default function AlgoSwitch() {
  const algorithm = useApp((s) => s.settings.algorithm);
  const setAlgorithm = useApp((s) => s.setAlgorithm);
  return (
    <div className="ui-algo ui-panel">
      <div className="ui-algo-seg" role="group" aria-label="Scheduling algorithm">
        {ALGORITHMS.map((id) => (
          <button
            key={id}
            type="button"
            className="ui-algo-btn"
            aria-pressed={algorithm === id}
            onClick={() => setAlgorithm(id)}
          >
            {ALGORITHM_LABEL[id]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="ui-icon-btn ui-algo-reset"
        aria-label="Reset camera view"
        title="Reset view (R)"
        onClick={() => window.dispatchEvent(new Event(RESET_VIEW_EVENT))}
      >
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
          <path
            d="M4.5 9.5a5.5 5.5 0 1 1 1.7 4M4.5 14.5v-4h4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
