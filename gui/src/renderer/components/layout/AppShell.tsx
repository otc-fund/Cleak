import React, { useEffect } from 'react';
import { ActivityBar } from './ActivityBar';
import { SidePanel } from './SidePanel';
import { MainArea } from './MainArea';
import { RightPanel } from './RightPanel';
import { StatusBar } from '../StatusBar';
import { PlanModeBanner } from '../plan/PlanModeBanner';
import { AskUserQuestionModal } from '../modals/AskUserQuestionModal';
import { useUi } from '../../store/ui';
import { useSettings } from '../../store/settings';

export function AppShell(): React.ReactElement {
  const theme = useUi((s) => s.theme);
  const settingsTheme = useSettings((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Sync persisted theme into ui store once settings load
  useEffect(() => {
    if (settingsTheme) setTheme(settingsTheme);
  }, [settingsTheme, setTheme]);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      <PlanModeBanner />
      <AskUserQuestionModal />
      <div className="flex flex-1 min-h-0">
        <ActivityBar />
        <SidePanel />
        <MainArea />
        <RightPanel />
      </div>
      <StatusBar />
    </div>
  );
}
