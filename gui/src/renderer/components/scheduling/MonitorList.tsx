import React from 'react';
import { Activity } from 'lucide-react';
import { useScheduling } from '../../store/scheduling';

export function MonitorList(): React.ReactElement {
  const { monitors } = useScheduling();

  if (!monitors.length) {
    return (
      <div className="px-3 py-6 text-xs text-muted text-center">No active monitors</div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-medium text-primary">Monitors</span>
      </div>

      <div className="flex-1 overflow-auto py-1">
        {monitors.map(m => (
          <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-active">
            <div className={m.running ? 'w-1.5 h-1.5 rounded-full bg-green-500 shrink-0' : 'w-1.5 h-1.5 rounded-full bg-muted/40 shrink-0'} />
            <div className="flex-1 min-w-0">
              <div className="text-primary truncate">{m.description}</div>
              <div className="text-[10px] text-muted">{m.events} events</div>
            </div>
            <Activity size={11} className={m.running ? 'text-green-500' : 'text-muted'} />
          </div>
        ))}
      </div>
    </div>
  );
}
