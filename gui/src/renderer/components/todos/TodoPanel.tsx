import React from 'react';
import { useTodos } from '../../store/todos';
import { TodoItem } from './TodoItem';

export function TodoPanel(): React.ReactElement {
  const { todos } = useTodos();

  if (!todos.length) {
    return <div className="px-3 py-6 text-xs text-muted text-center">No todos</div>;
  }

  return (
    <div className="flex flex-col h-full py-2">
      {todos.map((todo, i) => (
        <TodoItem key={i} todo={todo} index={i} />
      ))}
    </div>
  );
}
