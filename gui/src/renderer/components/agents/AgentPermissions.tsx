import React, { useState } from 'react';
import { useAgents } from '../../store/agents';
import { cn } from '../../lib/cn';

const PERMISSIONS = ['Read', 'Write', 'Execute', 'Network', 'Install'];

export function AgentPermissions(): React.ReactElement {
  const { agents, activeAgentId } = useAgents();
  const active = agents.find(a => a.id === activeAgentId);

  return (
    <div className="flex flex-col h-full py-2">
      <div className="px-3 py-2 border-b shrink-0 text-xs font-medium text-primary">
        {active ? `${active.name} — Permissions` : 'Select an agent'}
      </div>
      {active && (
        <div className="px-3 py-2 space-y-1">
          {PERMISSIONS.map(p => (
            <PermissionToggle key={p} agentId={active.id} permission={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PermissionToggle({ agentId, permission }: { agentId: string; permission: string }) {
  const [allowed, setAllowed] = useState(true);
  return (
    <button
      className={cn(
        'flex items-center justify-between w-full px-2 py-1 text-xs rounded hover:bg-active transition-colors',
      )}
      onClick={() => setAllowed(v => !v)}
    >
      <span className="text-primary">{permission}</span>
      <span className={cn(
        'w-8 h-4 rounded-full relative transition-colors',
        allowed ? 'bg-green-500/50' : 'bg-red-500/50',
      )}>
        <span className={cn(
          'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
          allowed ? 'left-4' : 'left-0.5',
        )} />
      </span>
    </button>
  );
}
