import React from 'react';
import { Play, CheckCircle, XCircle, Ban } from 'lucide-react';
import { useTasks, type SubAgentTask } from '../../store/tasks';
import { TaskNode } from './TaskNode';

function SectionHeader({ icon, label, count, color }: { icon: React.ReactNode; label: string; count: number; color: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-[11px] font-medium text-muted">
      <span className={color}>{icon}</span>
      <span>{label}</span>
      <span className="ml-auto text-[10px]">{count}</span>
    </div>
  );
}

function TaskRow({ task }: { task: SubAgentTask }): React.ReactElement {
  const { setActive, activeTaskId } = useTasks();
  const isActive = activeTaskId === task.id;

  const statusIcon = (() => {
    switch (task.status) {
      case 'running':   return <Play size={10} className="text-accent" />;
      case 'completed': return <CheckCircle size={10} className="text-green-500" />;
      case 'failed':    return <XCircle size={10} className="text-red-400" />;
      case 'cancelled': return <Ban size={10} className="text-muted" />;
    }
  })();

  return (
    <div
      className={`group flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors ${
        isActive ? 'bg-active text-primary' : 'text-muted hover:bg-hover hover:text-primary'
      }`}
      onClick={() => setActive(task.id)}
    >
      <span className="shrink-0">{statusIcon}</span>
      <span className="flex-1 truncate">{task.name}</span>
      {task.status === 'running' && (
        <button
          className="hidden group-hover:block p-0.5 rounded text-muted hover:text-red-400 transition-colors"
          onClick={e => { e.stopPropagation(); (window.bridge as any).taskStop?.(task.id); }}
          title="Cancel"
        >
          <XCircle size={12} />
        </button>
      )}
    </div>
  );
}

export function TaskPanel(): React.ReactElement {
  const { tasks } = useTasks();
  const [query, setQuery] = React.useState('');

  const filtered = query
    ? tasks.filter(t => t.name.toLowerCase().includes(query.toLowerCase()))
    : tasks;

  const running = filtered.filter(t => t.status === 'running');
  const completed = filtered.filter(t => t.status === 'completed');
  const failed = filtered.filter(t => t.status === 'failed');
  const cancelled = filtered.filter(t => t.status === 'cancelled');

  if (!tasks.length) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-2 py-1 border-b border-border shrink-0">
          <input
            className="w-full bg-[#0b0b0b] text-xs text-primary px-2 py-1.5 rounded border border-border outline-none placeholder:text-muted"
            placeholder="Search tasks..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="px-3 py-6 text-xs text-muted text-center">No sub-agents running</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-1 border-b border-border shrink-0">
        <input
          className="w-full bg-[#0b0b0b] text-xs text-primary px-2 py-1.5 rounded border border-border outline-none placeholder:text-muted"
          placeholder="Search tasks..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-auto">
        {running.length > 0 && (
          <>
            <SectionHeader icon={<Play size={10} />} label="Running" count={running.length} color="text-accent" />
            {running.map(t => (
              <TaskNode key={t.id} task={t} depth={0} allTasks={filtered} />
            ))}
          </>
        )}
        {completed.length > 0 && (
          <>
            <SectionHeader icon={<CheckCircle size={10} />} label="Completed" count={completed.length} color="text-green-500" />
            {completed.map(t => (
              <TaskNode key={t.id} task={t} depth={0} allTasks={filtered} />
            ))}
          </>
        )}
        {failed.length > 0 && (
          <>
            <SectionHeader icon={<XCircle size={10} />} label="Failed" count={failed.length} color="text-red-400" />
            {failed.map(t => (
              <TaskNode key={t.id} task={t} depth={0} allTasks={filtered} />
            ))}
          </>
        )}
        {cancelled.length > 0 && (
          <>
            <SectionHeader icon={<Ban size={10} />} label="Cancelled" count={cancelled.length} color="text-muted" />
            {cancelled.map(t => (
              <TaskNode key={t.id} task={t} depth={0} allTasks={filtered} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
