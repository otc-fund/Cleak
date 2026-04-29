import React from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { useTasks, type TaskStatus, type SubAgentTask } from '../../store/tasks';
import { cn } from '../../lib/cn';

const STATUS_COLORS: Record<TaskStatus, string> = {
  running: 'text-accent',
  completed: 'text-green-500',
  failed: 'text-red-400',
  cancelled: 'text-muted',
};

export function TaskNode({ task, depth, allTasks }: {
  task: SubAgentTask;
  depth: number;
  allTasks: SubAgentTask[];
}): React.ReactElement {
  const [expanded, setExpanded] = React.useState(true);
  const { setActive, activeTaskId } = useTasks();
  const children = allTasks.filter(t => t.parentId === task.id);

  return (
    <div>
      <button
        className={cn(
          'flex items-center gap-1.5 w-full px-3 py-1.5 text-xs hover:bg-active transition-colors',
          activeTaskId === task.id && 'bg-active',
        )}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => setActive(task.id)}
      >
        {children.length > 0 && (
          <span onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}>
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </span>
        )}
        <span className={cn('shrink-0', STATUS_COLORS[task.status])}>●</span>
        <span className="truncate text-primary">{task.name}</span>
        {task.status === 'running' && (
          <span
            className="ml-auto text-muted hover:text-red-400 cursor-pointer"
            onClick={e => { e.stopPropagation(); (window.bridge as any).taskStop?.(task.id); }}
            title="Cancel"
          >
            <X size={10} />
          </span>
        )}
      </button>
      {expanded && children.map(c => (
        <TaskNode key={c.id} task={c} depth={depth + 1} allTasks={allTasks} />
      ))}
    </div>
  );
}
