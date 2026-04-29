import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAgents } from '../../store/agents';
import { AgentCard } from './AgentCard';

export function AgentDashboard(): React.ReactElement {
  const { agents, activeAgentId, setActive, removeAgent } = useAgents();

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border shrink-0 flex items-center justify-between">
        <span className="text-xs font-medium text-primary">Agents</span>
        <button className="p-1 rounded hover:bg-active text-muted hover:text-primary transition-colors">
          <Plus size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-auto py-1">
        {agents.map(a => (
          <div key={a.id} className="flex items-center group">
            <AgentCard agent={a} active={a.id === activeAgentId} onClick={() => setActive(a.id)} />
            {a.status === 'done' || a.status === 'error' ? (
              <button
                className="p-1 mr-1 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeAgent(a.id)}
                title="Remove agent"
              >
                <Trash2 size={10} />
              </button>
            ) : null}
          </div>
        ))}
        {agents.length === 0 && (
          <div className="px-3 py-6 text-xs text-muted text-center">No agents running</div>
        )}
      </div>
    </div>
  );
}
