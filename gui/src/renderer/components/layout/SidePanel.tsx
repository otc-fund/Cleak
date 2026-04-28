import React from 'react';
import { useUi } from '../../store/ui';
import { SettingsPanel } from '../settings/SettingsPanel';
import { FilePanel } from '../files/FilePanel';

function PanelPlaceholder({ label }: { label: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full text-muted text-sm">
      {label} — coming soon
    </div>
  );
}

function PanelContent(): React.ReactElement {
  const { activeActivity } = useUi();
  switch (activeActivity) {
    case 'settings': return <SettingsPanel />;
    case 'files':    return <FilePanel />;
    case 'search':   return <PanelPlaceholder label="Search" />;
    case 'tasks':    return <PanelPlaceholder label="Tasks & Todos" />;
    case 'agents':   return <PanelPlaceholder label="Agents" />;
    case 'mcp':      return <PanelPlaceholder label="MCP Servers" />;
    case 'git':      return <PanelPlaceholder label="Git" />;
    default:         return <PanelPlaceholder label="Chat panel" />;
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
