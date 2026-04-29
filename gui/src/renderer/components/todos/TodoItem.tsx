import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useTodos, type Todo, type TodoStatus } from '../../store/todos';
import { cn } from '../../lib/cn';

const STATUS_ICONS: Record<TodoStatus, React.ReactNode> = {
  'pending': <Circle size={12} className="text-muted" />,
  'in-progress': <Loader2 size={12} className="text-accent animate-spin" />,
  'completed': <CheckCircle2 size={12} className="text-green-500" />,
};

const NEXT_STATUS: Record<TodoStatus, TodoStatus> = {
  'pending': 'in-progress',
  'in-progress': 'completed',
  'completed': 'pending',
};

export function TodoItem({ todo, index }: { todo: Todo; index: number }): React.ReactElement {
  return (
    <button
      className={cn(
        'flex items-start gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-active transition-colors',
        todo.status === 'completed' && 'opacity-50',
      )}
      onClick={() => {
        const { todos } = useTodos.getState();
        const newTodos = todos.map((t, j) =>
          j === index ? { ...t, status: NEXT_STATUS[t.status] } : t,
        );
        useTodos.getState().setTodos(newTodos);
      }}
    >
      <span className="mt-0.5 shrink-0">{STATUS_ICONS[todo.status]}</span>
      <span className={cn(
        'text-primary',
        todo.status === 'completed' && 'line-through text-muted',
      )}>
        {todo.content}
      </span>
    </button>
  );
}
