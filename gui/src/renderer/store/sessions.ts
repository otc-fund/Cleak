import { create } from 'zustand';

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  lastActive: number;
  messageCount: number;
  tokenCount: number;
  cost: number;
}

interface SessionState {
  sessions: Session[];
  currentSession: Session | null;
  loadSessions(): Promise<void>;
  selectSession(id: string): void;
  deleteSession(id: string): Promise<void>;
  exportSession(id: string): void;
  importSession(file: File): Promise<void>;
}

export const useSessions = create<SessionState>((set) => ({
  sessions: [],
  currentSession: null,

  async loadSessions() {
    // Request session list from bridge
    // const sessions = await window.bridge.listSessions();
    set({ sessions: [] });
  },

  selectSession(id) {
    set(s => ({
      currentSession: s.sessions.find(s => s.id === id) ?? null,
    }));
    // Send session switch to bridge
  },

  async deleteSession(id) {
    // await window.bridge.deleteSession(id);
    set(s => ({ sessions: s.sessions.filter(s => s.id !== id) }));
  },

  exportSession(id) {
    // Generate JSON blob, trigger download
  },

  async importSession(file) {
    // Read file, parse JSON, send to bridge as new session
  },
}));
