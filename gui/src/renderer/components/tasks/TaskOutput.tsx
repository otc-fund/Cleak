import React from 'react';
import { useTasks } from '../../store/tasks';
import { cn } from '../../lib/cn';

export function TaskOutput(): React.ReactElement {
  const { activeTaskId, tasks } = useTasks();
  const task = tasks.find(t => t.id === activeTaskId);

  if (!task) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-xs">
        Select a task to view output
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-1.5 border-b text-xs font-medium shrink-0" style={{ borderColor: 'var(--border)' }}>
        {task.name}
      </div>
      <pre className={cn(
        'flex-1 overflow-auto p-3 text-[11px] leading-relaxed whitespace-pre-wrap font-mono',
        task.status === 'failed' ? 'text-red-400' : 'text-primary',
      )}>
        {task.output || 'No output yet'}
      </pre>
      {task.error && (
        <div className="px-3 py-2 text-xs text-red-400 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
          Error: {task.error}
        </div>
      )}
    </div>
  );
}
