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

function PanelPlaceholder({ label }: { label: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full text-muted text-sm">
      {label} — coming soon
    </div>
  );
}

function PanelContent(): React.ReactElement {
  const { activeActivity } = useUi();
  const { tasks, activeTaskId } = useTasks();
  const { activeAgentId } = useAgents();
  switch (activeActivity) {
    case 'settings':   return <SettingsPanel />;
    case 'files':      return <FilePanel />;
    case 'search':     return <GrepPanel />;
    case 'processes':  return <ProcessList />;
    case 'tasks':      return activeTaskId ? <TaskOutput /> : <TaskPanel />;
    case 'todos':      return <TodoPanel />;
    case 'agents':     return !activeAgentId ? <AgentDashboard /> : <AgentChat />;
    case 'sessions':   return <SessionManager />;
    case 'scheduling': return <CronManager />;
    case 'memory':     return <MemoryBrowser />;
    case 'context':    return <ContextUsageGrid />;
    case 'mcp':        return <PanelPlaceholder label="MCP Servers" />;
    case 'git':        return <PanelPlaceholder label="Git" />;
    default:           return <PanelPlaceholder label="Chat panel" />;
  }
}

export function SidePanel(): React.ReactElement | null {
  const { sidePanelOpen } = useUi();
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
      <PanelContent />
    </div>
  );
}
