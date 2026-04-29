import { describe, it, expect } from 'vitest';
import { useSessions } from '../../src/renderer/store/sessions';

describe('useSessions', () => {
  it('initializes with empty sessions and null current', () => {
    const s = useSessions.getState();
    expect(s.sessions).toEqual([]);
    expect(s.currentSession).toBeNull();
  });

  it('selectSession sets currentSession from sessions list', () => {
    useSessions.setState({
      sessions: [
        { id: 'a', name: 'Project A', createdAt: 1, lastActive: 2, messageCount: 5, tokenCount: 1000, cost: 0.01 },
        { id: 'b', name: 'Project B', createdAt: 3, lastActive: 4, messageCount: 10, tokenCount: 2000, cost: 0.02 },
      ],
    });
    useSessions.getState().selectSession('b');
    expect(useSessions.getState().currentSession?.id).toBe('b');
  });

  it('selectSession sets null for unknown id', () => {
    useSessions.getState().selectSession('unknown');
    expect(useSessions.getState().currentSession).toBeNull();
  });

  it('deleteSession removes session from list', () => {
    useSessions.setState({
      sessions: [
        { id: 'a', name: 'A', createdAt: 1, lastActive: 2, messageCount: 5, tokenCount: 1000, cost: 0.01 },
      ],
    });
    useSessions.getState().deleteSession('a');
    expect(useSessions.getState().sessions).toEqual([]);
  });

  it('deleteSession keeps other sessions intact', () => {
    useSessions.setState({
      sessions: [
        { id: 'a', name: 'A', createdAt: 1, lastActive: 2, messageCount: 5, tokenCount: 1000, cost: 0.01 },
        { id: 'b', name: 'B', createdAt: 3, lastActive: 4, messageCount: 10, tokenCount: 2000, cost: 0.02 },
      ],
    });
    useSessions.getState().deleteSession('a');
    expect(useSessions.getState().sessions).toHaveLength(1);
    expect(useSessions.getState().sessions[0]!.id).toBe('b');
  });

  it('loadSessions is async and does not throw', async () => {
    await expect(useSessions.getState().loadSessions()).resolves.toBeUndefined();
    expect(useSessions.getState().sessions).toBeDefined();
  });
});
