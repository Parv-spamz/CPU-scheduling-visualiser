import { useEffect } from 'react';
import SceneGuard from './three/stage/SceneGuard';
import Drawer from './ui/drawer/Drawer';
import PlaybackBar from './ui/playback/PlaybackBar';
import AlgoSwitch from './ui/algo/AlgoSwitch';
import Breadcrumbs from './ui/breadcrumbs/Breadcrumbs';
import Tooltip from './ui/tooltip/Tooltip';
import Insights from './ui/insights/Insights';
import Help from './ui/help/Help';
import ResultsTable from './ui/a11y/ResultsTable';
import { useKeyboard } from './ui/a11y/useKeyboard';
import { useApp } from './store/useApp';
import { useShareLink } from './store/useShareLink';

export default function App() {
  const recompute = useApp((s) => s.recompute);
  useEffect(() => recompute(), [recompute]);
  useKeyboard();
  useShareLink();
  return (
    <>
      <SceneGuard />
      <Breadcrumbs />
      <Drawer />
      <AlgoSwitch />
      <PlaybackBar />
      <Tooltip />
      <Insights />
      <Help />
      <ResultsTable />
    </>
  );
}
