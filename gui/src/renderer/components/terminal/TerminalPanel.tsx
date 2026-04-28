import React from 'react';
import { Plus, X } from 'lucide-react';
import { useTerminals } from '../../store/terminals';
import { TerminalPane } from './TerminalPane';
import { cn } from '../../lib/cn';

const DEFAULT_CWD = 'D:\\cleak2';

export function TerminalPanel(): React.ReactElement {
  const { tabs, activeId, createTab, removeTab, setActive } = useTerminals();

  function handleNew(): void {
    createTab('Terminal');
  }

  return (
    <div className="flex flex-col h-full bg-[#0b0b0b]">
      {/* Tab strip */}
      <div className="flex items-center border-b border-border shrink-0 bg-surface/30">
        {tabs.map(t => (
          <button
            key={t.id}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-border shrink-0 transition-colors',
              t.id === activeId ? 'bg-[#0b0b0b] text-primary' : 'text-muted hover:text-primary',
              !t.alive && 'opacity-50',
            )}
            onClick={() => setActive(t.id)}
          >
            {t.agentOwned && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
            <span>{t.title}</span>
            <span
              className="ml-1 rounded hover:bg-active p-0.5 text-muted"
              onClick={e => { e.stopPropagation(); removeTab(t.id); }}
            >
              <X size={10} />
            </span>
          </button>
        ))}
        <button
          className="px-2 py-1.5 text-muted hover:text-primary transition-colors"
          onClick={handleNew}
          title="New Terminal"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Panes */}
      <div className="flex-1 min-h-0 relative">
        {tabs.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted text-sm">
            <button
              className="px-3 py-1.5 rounded border border-border hover:border-accent text-xs transition-colors"
              onClick={handleNew}
            >
              + New Terminal
            </button>
          </div>
        )}
        {tabs.map(t => (
          <div key={t.id} className="absolute inset-0">
            <TerminalPane id={t.id} cwd={DEFAULT_CWD} isActive={t.id === activeId} />
          </div>
        ))}
      </div>
    </div>
  );
}
