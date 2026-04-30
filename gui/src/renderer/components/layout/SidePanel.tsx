import React, { useCallback, useEffect, useRef, useState } from 'react';
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

const MIN_WIDTH = 160;
const MAX_WIDTH = 500;
const STORAGE_KEY = 'cleak-side-panel-width';

function getStoredWidth(): number {
  try {
    const w = localStorage.getItem(STORAGE_KEY);
    if (w) { const n = Number(w); if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n; }
  } catch { /* ignore */ }
  return 256; // default 16rem
}

function setStoredWidth(w: number) {
  try { localStorage.setItem(STORAGE_KEY, String(w)); } catch { /* ignore */ }
}

function PanelContainer({ width, children }: { width: number; children: React.ReactNode }): React.ReactElement {
  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width,
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {children}
    </div>
  );
}

function ResizeHandle({ onResize }: { onResize(newWidth: number): void }): React.ReactElement {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = getStoredWidth();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta));
      setStoredWidth(newWidth);
      onResize(newWidth);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [onResize]);

  return (
    <div
      onMouseDown={onMouseDown}
      className="w-1 cursor-col-resize shrink-0"
      style={{ background: 'transparent', zIndex: 10 }}
    />
  );
}

export function SidePanel(): React.ReactElement | null {
  const { sidePanelOpen, activeActivity, chatSideTab } = useUi();
  const [width, setWidth] = useState(getStoredWidth());

  if (!sidePanelOpen) return null;

  const { tasks, activeTaskId } = useTasks();
  const { activeAgentId } = useAgents();

  const content = (() => {
    if (activeActivity === 'chat') {
      return (
        <>
          <ChatTabs chatSideTab={chatSideTab} />
          <div className="flex-1 overflow-hidden">
            {chatSideTab === 'sessions' && <SessionManager />}
            {chatSideTab === 'search' && <GrepPanel />}
            {chatSideTab === 'context' && <ContextUsageGrid />}
          </div>
        </>
      );
    }

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
      default:           return <SessionManager />;
    }
  })();

  return (
    <>
      <PanelContainer width={width}>{content}</PanelContainer>
      <ResizeHandle onResize={setWidth} />
    </>
  );
}

function ChatTabs({ chatSideTab }: { chatSideTab: import('../../store/ui').ChatSideTab }): React.ReactElement {
  const TABS: { key: import('../../store/ui').ChatSideTab; label: string }[] = [
    { key: 'sessions', label: 'Sessions' },
    { key: 'search', label: 'Search' },
    { key: 'context', label: 'Context' },
  ];

  return (
    <div className="flex items-center shrink-0 border-b border-border" style={{ height: '36px' }}>
      {TABS.map(t => (
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
  );
}

function PanelPlaceholder({ label }: { label: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full text-muted text-sm">
      {label} — coming soon
    </div>
  );
}
