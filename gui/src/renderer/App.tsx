import React, { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useBridgeWiring } from './lib/bridge';
import { useSettings } from './store/settings';
import '@xterm/xterm/css/xterm.css';

export default function App(): React.ReactElement {
  useBridgeWiring();
  const load = useSettings((s) => s.load);

  // Load persisted settings from main process on first render
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <AppShell />;
}
