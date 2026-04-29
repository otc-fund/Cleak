import { create } from 'zustand';

export type AgentStatus = 'idle' | 'working' | 'waiting' | 'done' | 'error';

export interface Agent {
  id: string;
  name: string;
  color: string;
  status: AgentStatus;
  currentTask?: string;
  config?: Record<string, unknown>;
}

export interface AgentMessage {
  from: string;
  to: string;
  content: string;
  timestamp: number;
}

export interface PendingQuestion {
  id: string;
  question: string;
  options: { label: string; description: string }[];
  allowText: boolean;
}

interface AskState {
  pending: PendingQuestion | null;
  setPending(q: PendingQuestion | null): void;
  submitAnswer(id: string, answer: string): void;
}

interface AgentsState {
  agents: Agent[];
  messages: AgentMessage[];
  activeAgentId: string | null;
  registerAgent(agent: Agent): void;
  updateStatus(id: string, status: AgentStatus, currentTask?: string): void;
  removeAgent(id: string): void;
  addMessage(msg: AgentMessage): void;
  setActive(id: string | null): void;
}

export const useAgents = create<AgentsState>((set) => ({
  agents: [],
  messages: [],
  activeAgentId: null,

  registerAgent(agent) {
    set(s => ({
      agents: [...s.agents, { ...agent }],
    }));
  },
  updateStatus(id, status, currentTask) {
    set(s => ({
      agents: s.agents.map(a =>
        a.id === id ? { ...a, status, currentTask: currentTask ?? a.currentTask } : a,
      ),
    }));
  },
  removeAgent(id) {
    set(s => ({ agents: s.agents.filter(a => a.id !== id) }));
  },
  addMessage(msg) {
    set(s => ({ messages: [...s.messages, msg] }));
  },
  setActive(id) { set({ activeAgentId: id }); },
}));

export const useAskUser = create<AskState>((set, get) => ({
  pending: null,
  setPending: (q) => set({ pending: q }),
  submitAnswer: (id, answer) => {
    // Answer would be sent back via bridge protocol
    set({ pending: null });
  },
}));
