import React from 'react';
import { useTasks } from '../../store/tasks';
import { TaskNode } from './TaskNode';

export function TaskPanel(): React.ReactElement {
  const { tasks } = useTasks();
  const roots = tasks.filter(t => !t.parentId);

  if (!tasks.length) {
    return <div className="px-3 py-6 text-xs text-muted text-center">No sub-agents running</div>;
  }

  return (
    <div className="flex flex-col h-full py-2">
      {roots.map(t => (
        <TaskNode key={t.id} task={t} depth={0} allTasks={tasks} />
      ))}
    </div>
  );
}
