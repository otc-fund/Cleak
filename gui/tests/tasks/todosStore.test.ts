import { describe, it, expect } from 'vitest';
import { useTodos } from '../../src/renderer/store/todos';

describe('todos store', () => {
  it('starts with empty todos and hidden visibility', () => {
    useTodos.setState({ todos: [], todosVisible: false });
    const { todos, todosVisible } = useTodos.getState();
    expect(todos).toEqual([]);
    expect(todosVisible).toBe(false);
  });

  it('sets todos and shows them when non-empty', () => {
    const todos = [
      { content: 'Fix the bug', status: 'pending' as const },
      { content: 'Write tests', status: 'in-progress' as const },
    ];
    useTodos.getState().setTodos(todos);
    const state = useTodos.getState();
    expect(state.todos).toHaveLength(2);
    expect(state.todosVisible).toBe(true);
  });

  it('hides visibility when todos are empty', () => {
    useTodos.getState().setTodos([]);
    expect(useTodos.getState().todosVisible).toBe(false);
  });

  it('toggles visibility', () => {
    useTodos.setState({ todos: [{ content: 'test', status: 'pending' }], todosVisible: true });
    useTodos.getState().toggleVisibility();
    expect(useTodos.getState().todosVisible).toBe(false);
    useTodos.getState().toggleVisibility();
    expect(useTodos.getState().todosVisible).toBe(true);
  });
});
