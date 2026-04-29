import { describe, it, expect } from 'vitest';
import { useTasks } from '../../src/renderer/store/tasks';

describe('tasks store', () => {
  beforeEach(() => {
    useTasks.getState().clear();
  });

  it('starts with empty tasks and no active task', () => {
    const { tasks, activeTaskId } = useTasks.getState();
    expect(tasks).toEqual([]);
    expect(activeTaskId).toBeNull();
  });

  it('registers a root task with running status', () => {
    useTasks.getState().registerTask('t1', 'Root Task');
    const { tasks } = useTasks.getState();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      id: 't1',
      name: 'Root Task',
      status: 'running',
      parentId: null,
      output: '',
    });
  });

  it('registers a child task with parentId', () => {
    useTasks.getState().registerTask('t1', 'Parent');
    useTasks.getState().registerTask('t2', 'Child', 't1');
    const { tasks } = useTasks.getState();
    expect(tasks).toHaveLength(2);
    expect(tasks[1].parentId).toBe('t1');
  });

  it('updates task status', () => {
    useTasks.getState().registerTask('t1', 'Task');
    useTasks.getState().updateStatus('t1', 'completed');
    const { tasks } = useTasks.getState();
    expect(tasks[0].status).toBe('completed');
  });

  it('updates task status with error message', () => {
    useTasks.getState().registerTask('t1', 'Task');
    useTasks.getState().updateStatus('t1', 'failed', 'Something went wrong');
    const { tasks } = useTasks.getState();
    expect(tasks[0].status).toBe('failed');
    expect(tasks[0].error).toBe('Something went wrong');
  });

  it('appends output to a task', () => {
    useTasks.getState().registerTask('t1', 'Task');
    useTasks.getState().appendOutput('t1', 'Hello ');
    useTasks.getState().appendOutput('t1', 'World');
    const { tasks } = useTasks.getState();
    expect(tasks[0].output).toBe('Hello World');
  });

  it('sets active task', () => {
    useTasks.getState().registerTask('t1', 'Task');
    useTasks.getState().setActive('t1');
    expect(useTasks.getState().activeTaskId).toBe('t1');
  });

  it('removes a task', () => {
    useTasks.getState().registerTask('t1', 'Task');
    useTasks.getState().removeTask('t1');
    expect(useTasks.getState().tasks).toHaveLength(0);
  });

  it('clears all tasks', () => {
    useTasks.getState().registerTask('t1', 'Task');
    useTasks.getState().setActive('t1');
    useTasks.getState().clear();
    const state = useTasks.getState();
    expect(state.tasks).toEqual([]);
    expect(state.activeTaskId).toBeNull();
  });
});
