import React from 'react';
import { Clock, Trash2, Download } from 'lucide-react';
import type { Session } from '../../store/sessions';
import { useSessions } from '../../store/sessions';

interface Props {
  session: Session;
  active: boolean;
  onClick(): void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

export function SessionCard({ session, active, onClick }: Props): React.ReactElement {
  const { deleteSession, exportSession } = useSessions();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete session "${session.name}"?`)) {
      void deleteSession(session.id);
    }
  };

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    exportSession(session.id);
  };

  return (
    <div
      className={`flex flex-col gap-1 px-3 py-2 text-xs cursor-pointer border-l-2 transition-colors ${
        active
          ? 'border-l-accent bg-active'
          : 'border-l-transparent hover:bg-active'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className={`font-medium truncate ${active ? 'text-accent' : 'text-primary'}`}>
          {session.name}
        </span>
        <div className="flex items-center gap-0.5 shrink-0 ml-2">
          <button
            className="p-0.5 rounded hover:bg-hover text-muted hover:text-primary"
            title="Export"
            onClick={handleExport}
          >
            <Download size={11} />
          </button>
          <button
            className="p-0.5 rounded hover:bg-hover text-muted hover:text-red-400"
            title="Delete"
            onClick={handleDelete}
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted">
        <span className="flex items-center gap-0.5">
          <Clock size={10} />
          {formatDate(session.lastActive)}
        </span>
        <span>{session.messageCount} msgs</span>
        <span>{formatTokens(session.tokenCount)} tokens</span>
        <span className="text-subtle">{formatCost(session.cost)}</span>
      </div>
    </div>
  );
}
