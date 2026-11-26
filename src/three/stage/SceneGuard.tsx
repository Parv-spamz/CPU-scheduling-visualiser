import { Component, useEffect, useState, type ReactNode } from 'react';
import Scene3D from './Scene3D';

type Failure = 'no-webgl' | 'context-lost' | 'crash';

const MESSAGE: Record<Failure, string> = {
  'no-webgl': 'This browser or device has WebGL turned off, so the 3D board cannot be drawn.',
  'context-lost': 'The graphics driver reset and the 3D board was lost.',
  crash: 'The 3D board hit an unexpected error.',
};

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function Fallback({ failure }: { failure: Failure }) {
  return (
    <div className="scene">
      <div className="boot boot--failed" role="alert">
        <div className="boot-chip" />
        <p>{MESSAGE[failure]}</p>
        <p>Reload to try again. The workload drawer and playback controls still work.</p>
        <button type="button" className="ui-btn" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode; onCrash: () => void }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError(): { crashed: boolean } {
    return { crashed: true };
  }
  componentDidCatch(error: unknown): void {
    console.error('3D scene failed', error);
    this.props.onCrash();
  }
  render(): ReactNode {
    return this.state.crashed ? null : this.props.children;
  }
}

/**
 * Mounts the 3D scene only when WebGL is available and replaces it with a readable notice if the
 * scene throws or the GPU context is lost, so the rest of the app keeps working.
 */
export default function SceneGuard() {
  const [failure, setFailure] = useState<Failure | null>(() => (hasWebGL() ? null : 'no-webgl'));

  useEffect(() => {
    // three.js canvases fire this on the canvas element; listen in the capture phase on the document.
    const onLost = (e: Event) => {
      if (e.target instanceof HTMLCanvasElement && e.target.closest('.scene')) setFailure('context-lost');
    };
    document.addEventListener('webglcontextlost', onLost, true);
    return () => document.removeEventListener('webglcontextlost', onLost, true);
  }, []);

  if (failure) return <Fallback failure={failure} />;
  return (
    <Boundary onCrash={() => setFailure('crash')}>
      <Scene3D />
    </Boundary>
  );
}
