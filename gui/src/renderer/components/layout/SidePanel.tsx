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
import { MonitorList } from '../scheduling/MonitorList';
import { RemotePanel } from '../scheduling/RemotePanel';
import { MemoryBrowser } from '../memory/MemoryBrowser';
import { ContextUsageGrid } from '../context/ContextUsageGrid';
import { useTasks } from '../../store/tasks';
import { useAgents } from '../../store/agents';

const CHAT_TABS: { id: import('../../store/ui').ChatSideTab; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'context', label: 'Context' },
  { id: 'search', label: 'Search' },
];

function ChatSideTabs(): React.ReactElement {
  const { chatSideTab, setChatSideTab } = useUi();
  return (
    <div className="flex items-center gap-0 px-2 pt-1 border-b border-border shrink-0">
      {CHAT_TABS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => setChatSideTab(id)}
          className={`px-2 py-1 text-[10px] font-medium transition-colors rounded-t ${
            chatSideTab === id
              ? 'text-primary border-b-2 border-primary bg-active'
              : 'text-muted hover:text-primary'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function PanelPlaceholder({ label }: { label: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full text-muted text-sm">
      {label} — coming soon
    </div>
  );
}

function SidePanelContent(): React.ReactElement {
  const { activeActivity } = useUi();
  const { tasks, activeTaskId } = useTasks();
  const { activeAgentId } = useAgents();
  switch (activeActivity) {
    case 'settings':   return <SettingsPanel />;
    case 'files':      return <FilePanel />;
    case 'processes':  return <ProcessList />;
    case 'tasks':      return activeTaskId ? <TaskOutput /> : <TaskPanel />;
    case 'todos':      return <TodoPanel />;
    case 'agents':     return !activeAgentId ? <AgentDashboard /> : <AgentChat />;
    case 'scheduling': return <CronManager />;
    case 'memory':     return <MemoryBrowser />;
    case 'mcp':        return <PanelPlaceholder label="MCP Servers" />;
    case 'git':        return <PanelPlaceholder label="Git" />;
    default:           return <PanelPlaceholder label="Chat panel" />;
  }
}

function ChatSidePanelContent(): React.ReactElement {
  const { chatSideTab } = useUi();
  switch (chatSideTab) {
    case 'chat':     return <SidePanelContent />;
    case 'sessions': return <SessionManager />;
    case 'context':  return <ContextUsageGrid />;
    case 'search':   return <GrepPanel />;
  }
}

export function SidePanel(): React.ReactElement | null {
  const { sidePanelOpen, activeActivity } = useUi();
  if (!sidePanelOpen) return null;
  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: 'var(--side-w)',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {activeActivity === 'chat' && <ChatSideTabs />}
      {activeActivity === 'chat' ? <ChatSidePanelContent /> : <SidePanelContent />}
    </div>
  );
}
