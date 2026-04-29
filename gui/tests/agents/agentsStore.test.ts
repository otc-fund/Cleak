import { describe, it, expect, beforeEach } from 'vitest';
import { useAgents, useAskUser } from '../../src/renderer/store/agents';

describe('agents store', () => {
  beforeEach(() => {
    useAgents.setState({ agents: [], messages: [], activeAgentId: null });
  });

  it('starts with empty agents and no active agent', () => {
    const { agents, activeAgentId } = useAgents.getState();
    expect(agents).toEqual([]);
    expect(activeAgentId).toBeNull();
  });

  it('registers an agent', () => {
    useAgents.getState().registerAgent({
      id: 'a1',
      name: 'Researcher',
      color: '#3b82f6',
      status: 'idle',
    });
    const { agents } = useAgents.getState();
    expect(agents).toHaveLength(1);
    expect(agents[0]).toMatchObject({ id: 'a1', name: 'Researcher', status: 'idle' });
  });

  it('updates agent status', () => {
    useAgents.getState().registerAgent({ id: 'a1', name: 'Researcher', color: '#3b82f6', status: 'idle' });
    useAgents.getState().updateStatus('a1', 'working', 'Searching the web');
    const { agents } = useAgents.getState();
    expect(agents[0]!.status).toBe('working');
    expect(agents[0]!.currentTask).toBe('Searching the web');
  });

  it('removes an agent', () => {
    useAgents.getState().registerAgent({ id: 'a1', name: 'Researcher', color: '#3b82f6', status: 'idle' });
    useAgents.getState().removeAgent('a1');
    expect(useAgents.getState().agents).toHaveLength(0);
  });

  it('adds a message', () => {
    useAgents.getState().addMessage({ from: 'a1', to: 'a2', content: 'Hello', timestamp: Date.now() });
    const { messages } = useAgents.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0]!.content).toBe('Hello');
  });

  it('sets active agent', () => {
    useAgents.getState().registerAgent({ id: 'a1', name: 'Researcher', color: '#3b82f6', status: 'idle' });
    useAgents.getState().setActive('a1');
    expect(useAgents.getState().activeAgentId).toBe('a1');
  });
});

describe('askUser store', () => {
  it('starts with no pending question', () => {
    expect(useAskUser.getState().pending).toBeNull();
  });

  it('sets pending question', () => {
    useAskUser.getState().setPending({
      id: 'q1',
      question: 'How should we proceed?',
      options: [{ label: 'A', description: 'Option A' }],
      allowText: true,
    });
    expect(useAskUser.getState().pending?.question).toBe('How should we proceed?');
  });

  it('clears pending question on submit', () => {
    useAskUser.getState().setPending({
      id: 'q1',
      question: 'Test?',
      options: [],
      allowText: false,
    });
    useAskUser.getState().submitAnswer('q1', 'answer');
    expect(useAskUser.getState().pending).toBeNull();
  });
});
