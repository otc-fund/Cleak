import { create } from 'zustand';

export type TaskStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface SubAgentTask {
  id: string;
  name: string;
  status: TaskStatus;
  parentId: string | null;
  output: string;
  error?: string;
}

interface TasksState {
  tasks: SubAgentTask[];
  activeTaskId: string | null;
  registerTask(id: string, name: string, parentId?: string | null): void;
  updateStatus(id: string, status: TaskStatus, error?: string): void;
  appendOutput(id: string, text: string): void;
  setActive(id: string | null): void;
  removeTask(id: string): void;
  clear(): void;
}

export const useTasks = create<TasksState>((set) => ({
  tasks: [],
  activeTaskId: null,
  registerTask: (id, name, parentId: string | null | undefined = null) =>
    set(s => ({
      tasks: [...s.tasks, { id, name, status: 'running', parentId, output: '' }],
    })),
  updateStatus: (id, status, error) =>
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === id ? { ...t, status, error: error ?? t.error } : t,
      ),
    })),
  appendOutput: (id, text) =>
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === id ? { ...t, output: t.output + text } : t,
      ),
    })),
  setActive: (id) => set({ activeTaskId: id }),
  removeTask: (id) => set(s => ({ tasks: s.tasks.filter(t => t.id !== id) })),
  clear: () => set({ tasks: [], activeTaskId: null }),
}));
