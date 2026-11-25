import { useEffect } from 'react';
import Scene from './scene/Scene';
import Drawer from './ui/Drawer';
import PlaybackBar from './ui/PlaybackBar';
import Breadcrumbs from './ui/Breadcrumbs';
import Tooltip from './ui/Tooltip';
import { useApp } from './store/useApp';

export default function App() {
  const recompute = useApp((s) => s.recompute);
  useEffect(() => recompute(), [recompute]);
  return (
    <>
      <Scene />
      <Breadcrumbs />
      <Drawer />
      <PlaybackBar />
      <Tooltip />
    </>
  );
}
