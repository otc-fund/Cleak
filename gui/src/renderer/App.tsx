import React, { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { QuickOpen } from './components/search/QuickOpen';
import { useBridgeWiring } from './lib/bridge';
import { useSearch } from './store/search';
import { useSettings } from './store/settings';
import '@xterm/xterm/css/xterm.css';

export default function App(): React.ReactElement {
  useBridgeWiring();
  const load = useSettings((s) => s.load);

  // Load persisted settings from main process on first render
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Populate quick open entries on mount
  useEffect(() => {
    void window.bridge.searchGlob('**/*.{ts,tsx,js,jsx,json,md,css,html,py,rs,go,sh,yaml,yml,toml}', 'D:\\cleak2')
      .then((paths: string[]) => {
        const entries = paths.map(p => ({
          path: p,
          label: p.replace(/^.*[/\\]/, ''),
        }));
        useSearch.getState().populateQuickOpen(entries);
      });
  }, []);

  return (
    <>
      <AppShell />
      <QuickOpen />
    </>
  );
}
