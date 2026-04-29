import React from 'react';
import { type Agent, type AgentStatus, useAgents } from '../../store/agents';
import { cn } from '../../lib/cn';

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'Idle',
  working: 'Working',
  waiting: 'Waiting',
  done: 'Done',
  error: 'Error',
};

export function AgentCard({ agent, active, onClick }: {
  agent: Agent;
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      className={cn(
        'flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-active transition-colors',
        active && 'bg-active',
      )}
      onClick={onClick}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: agent.color }}
      />
      <div className="flex-1 text-left">
        <div className="text-primary font-medium">{agent.name}</div>
        <div className="text-muted text-[10px]">{STATUS_LABELS[agent.status]}</div>
      </div>
      {agent.currentTask && (
        <span className="text-muted text-[10px] truncate max-w-[100px]">{agent.currentTask}</span>
      )}
    </button>
  );
}
