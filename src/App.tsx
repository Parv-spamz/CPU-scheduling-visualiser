import { useEffect } from 'react';
import Scene3D from './three/Scene3D';
import Drawer from './ui/Drawer';
import PlaybackBar from './ui/PlaybackBar';
import Breadcrumbs from './ui/Breadcrumbs';
import Tooltip from './ui/Tooltip';
import ResultsTable from './ui/ResultsTable';
import { useKeyboard } from './ui/useKeyboard';
import { useApp } from './store/useApp';
import { useShareLink } from './store/useShareLink';

export default function App() {
  const recompute = useApp((s) => s.recompute);
  useEffect(() => recompute(), [recompute]);
  useKeyboard();
  useShareLink();
  return (
    <>
      <Scene3D />
      <Breadcrumbs />
      <Drawer />
      <PlaybackBar />
      <Tooltip />
      <ResultsTable />
    </>
  );
}
