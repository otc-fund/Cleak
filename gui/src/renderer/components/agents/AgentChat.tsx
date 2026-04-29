import React from 'react';
import { useAgents } from '../../store/agents';
import { cn } from '../../lib/cn';

export function AgentChat(): React.ReactElement {
  const { messages, activeAgentId } = useAgents();
  const filtered = activeAgentId
    ? messages.filter(m => m.from === activeAgentId || m.to === activeAgentId)
    : messages;

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-xs">
        No messages yet
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto py-2 px-3">
      {filtered.map((m, i) => (
        <div key={i} className={cn(
          'max-w-[80%] px-3 py-1.5 rounded text-xs mb-1',
          m.from === activeAgentId ? 'bg-active self-start' : 'bg-surface self-end',
        )}>
          <div className="text-muted text-[10px]">{m.from} → {m.to}</div>
          <div className="text-primary">{m.content}</div>
        </div>
      ))}
    </div>
  );
}
