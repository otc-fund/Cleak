import React, { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { QuickOpen } from './components/search/QuickOpen';
import { useBridgeWiring, useMessagePersistence } from './lib/bridge';
import { useSearch } from './store/search';
import { useSettings } from './store/settings';
import { useTodos } from './store/todos';
import '@xterm/xterm/css/xterm.css';

export default function App(): React.ReactElement {
  useBridgeWiring();
  useMessagePersistence();
  const load = useSettings((s) => s.load);

  // Load persisted settings from main process on first render
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Seed sample todos for demo, then auto-complete them
  useEffect(() => {
    const todos = [
      { content: 'Implement notification badges on side panel tabs', status: 'in-progress' as const },
      { content: 'Add session auto-rename trigger on first user message', status: 'pending' as const },
      { content: 'Test the chat input across all screen sizes', status: 'pending' as const },
    ];
    useTodos.getState().setTodos(todos);

    // Cycle todo 0: in-progress -> completed after 2s
    const t1 = setTimeout(() => {
      const s = useTodos.getState();
      s.setTodos(s.todos.map((t, i) => i === 0 ? { ...t, status: 'completed' as const } : t));
    }, 2000);

    // Cycle todo 1: pending -> in-progress -> completed after 4s
    const t2 = setTimeout(() => {
      const s = useTodos.getState();
      s.setTodos(s.todos.map((t, i) => i === 1 ? { ...t, status: 'in-progress' as const } : t));
    }, 4000);
    const t3 = setTimeout(() => {
      const s = useTodos.getState();
      s.setTodos(s.todos.map((t, i) => i === 1 ? { ...t, status: 'completed' as const } : t));
    }, 5500);

    // Cycle todo 2: pending -> in-progress -> completed after 7s
    const t4 = setTimeout(() => {
      const s = useTodos.getState();
      s.setTodos(s.todos.map((t, i) => i === 2 ? { ...t, status: 'in-progress' as const } : t));
    }, 7000);
    const t5 = setTimeout(() => {
      const s = useTodos.getState();
      s.setTodos(s.todos.map((t, i) => i === 2 ? { ...t, status: 'completed' as const } : t));
    }, 8500);

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      clearTimeout(t4); clearTimeout(t5);
    };
  }, []);

  // Populate quick open entries on mount
  useEffect(() => {
    if (!window.bridge?.searchGlob) return;
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
