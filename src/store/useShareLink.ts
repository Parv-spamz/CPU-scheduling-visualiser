import { useEffect } from 'react';
import { DEFAULT_SETTINGS, useApp } from './useApp';
import { decodeShare, encodeShare } from './share';

/**
 * Keeps the URL hash in sync with the workload and settings so the address bar is always a
 * shareable link, and loads a link pasted into an already-open tab. Uses replaceState so editing
 * the workload does not flood the browser history.
 */
export function useShareLink(): void {
  useEffect(() => {
    let written = '';
    const write = () => {
      const { workload, settings, errors } = useApp.getState();
      if (errors.length > 0) return; // never share a broken workload
      const hash = '#' + encodeShare({ processes: workload, settings });
      if (hash === window.location.hash) return;
      written = hash;
      window.history.replaceState(null, '', hash);
    };
    write();
    const unsub = useApp.subscribe((s, prev) => {
      if (s.workload !== prev.workload || s.settings !== prev.settings || s.errors !== prev.errors) write();
    });
    const onHash = () => {
      if (window.location.hash === written) return;
      const shared = decodeShare(window.location.hash, DEFAULT_SETTINGS);
      if (!shared) return;
      useApp.setState({ settings: shared.settings });
      useApp.getState().setWorkload(shared.processes);
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      unsub();
      window.removeEventListener('hashchange', onHash);
    };
  }, []);
}
