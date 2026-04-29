import { create } from 'zustand';

export type TodoStatus = 'pending' | 'in-progress' | 'completed';

export interface Todo {
  content: string;
  status: TodoStatus;
}

interface TodosState {
  todos: Todo[];
  todosVisible: boolean;
  setTodos(todos: Todo[]): void;
  toggleVisibility(): void;
}

export const useTodos = create<TodosState>((set) => ({
  todos: [],
  todosVisible: false,
  setTodos: (todos) => set({ todos, todosVisible: todos.length > 0 }),
  toggleVisibility: () => set(s => ({ todosVisible: !s.todosVisible })),
}));
