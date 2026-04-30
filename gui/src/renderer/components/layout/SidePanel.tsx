import React from 'react';
import { useUi } from '../../store/ui';
import { SettingsPanel } from '../settings/SettingsPanel';
import { FilePanel } from '../files/FilePanel';
import { ProcessList } from '../terminal/ProcessList';
import { GrepPanel } from '../search/GrepPanel';
import { TodoPanel } from '../todos/TodoPanel';
import { TaskPanel } from '../tasks/TaskPanel';
import { TaskOutput } from '../tasks/TaskOutput';
import { AgentDashboard } from '../agents/AgentDashboard';
import { AgentChat } from '../agents/AgentChat';
import { SessionManager } from '../sessions/SessionManager';
import { CronManager } from '../scheduling/CronManager';
import { MemoryBrowser } from '../memory/MemoryBrowser';
import { ContextUsageGrid } from '../context/ContextUsageGrid';
import { useTasks } from '../../store/tasks';
import { useAgents } from '../../store/agents';

function PanelPlaceholder({ label }: { label: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full text-muted text-sm">
      {label} — coming soon
    </div>
  );
}

const CHAT_TABS: { key: import('../../store/ui').ChatSideTab; label: string }[] = [
  { key: 'sessions', label: 'Sessions' },
  { key: 'search', label: 'Search' },
  { key: 'context', label: 'Context' },
];

export function SidePanel(): React.ReactElement | null {
  const { sidePanelOpen, activeActivity, chatSideTab } = useUi();
  if (!sidePanelOpen) return null;

  const { tasks, activeTaskId } = useTasks();
  const { activeAgentId } = useAgents();

  if (activeActivity === 'chat') {
    return (
      <div
        className="flex flex-col shrink-0 overflow-hidden"
        style={{
          width: 'var(--side-w)',
          background: 'var(--bg-panel)',
          borderRight: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center shrink-0 border-b border-border" style={{ height: '36px' }}>
          {CHAT_TABS.map(t => (
            <button
              key={t.key}
              className={`flex-1 text-xs font-medium transition-colors ${
                chatSideTab === t.key
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted hover:text-primary'
              }`}
              style={{ height: '100%' }}
              onClick={() => useUi.getState().setChatSideTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden">
          {chatSideTab === 'sessions' && <SessionManager />}
          {chatSideTab === 'search' && <GrepPanel />}
          {chatSideTab === 'context' && <ContextUsageGrid />}
        </div>
      </div>
    );
  }

  let content: React.ReactNode;
  switch (activeActivity) {
    case 'settings':   content = <SettingsPanel />; break;
    case 'files':      content = <FilePanel />; break;
    case 'processes':  content = <ProcessList />; break;
    case 'tasks':      content = activeTaskId ? <TaskOutput /> : <TaskPanel />; break;
    case 'todos':      content = <TodoPanel />; break;
    case 'agents':     content = !activeAgentId ? <AgentDashboard /> : <AgentChat />; break;
    case 'scheduling': content = <CronManager />; break;
    case 'memory':     content = <MemoryBrowser />; break;
    case 'mcp':        content = <PanelPlaceholder label="MCP Servers" />; break;
    case 'git':        content = <PanelPlaceholder label="Git" />; break;
    default:           content = <SessionManager />; break;
  }

  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: 'var(--side-w)',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {content}
    </div>
  );
}
