import React from 'react';
import { Cpu, X } from 'lucide-react';
import { useTerminals } from '../../store/terminals';
import { cn } from '../../lib/cn';

export function ProcessList(): React.ReactElement {
  const { tabs, activeId, setActive, removeTab } = useTerminals();

  if (tabs.length === 0) {
    return <div className="px-3 py-4 text-xs text-muted">No running processes</div>;
  }

  return (
    <div className="flex flex-col gap-0.5 py-2">
      {tabs.map(t => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-active transition-colors',
            t.id === activeId && 'bg-active',
          )}
          onClick={() => setActive(t.id)}
        >
          <Cpu size={11} className={t.alive ? 'text-green-500' : 'text-muted'} />
          <span className={cn('flex-1 truncate', t.alive ? 'text-primary' : 'text-muted')}>
            {t.title}
          </span>
          {!t.alive && <span className="text-muted">[exited]</span>}
          <button
            className="text-muted hover:text-red-400 transition-colors"
            title="Kill"
            onClick={e => {
              e.stopPropagation();
              window.bridge.ptyKill(t.id);
              removeTab(t.id);
            }}
          >
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}
