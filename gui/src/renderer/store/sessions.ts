import { create } from 'zustand';

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  lastActive: number;
  messageCount: number;
  tokenCount: number;
  cost: number;
  /** Whether session is pinned to top of list. */
  pinned?: boolean;
}

interface SessionState {
  sessions: Session[];
  currentSession: Session | null;
  loadSessions(): Promise<void>;
  createSession(id: string, name?: string): void;
  selectSession(id: string): void;
  deleteSession(id: string): Promise<void>;
  exportSession(id: string): void;
  importSession(file: File): Promise<void>;
  syncSession(sessionId: string): void;
  togglePin(id: string): void;
  clearSessions(): void;
}

export const useSessions = create<SessionState>((set) => ({
  sessions: [],
  currentSession: null,

  async loadSessions() {
    // Request session list from bridge
    // const sessions = await window.bridge.listSessions();
    set({ sessions: [] });
  },

  createSession(id, name) {
    set(s => {
      if (s.sessions.some(sess => sess.id === id)) return s;
      const now = Date.now();
      const session: Session = {
        id,
        name: name ?? `Session ${s.sessions.length + 1}`,
        createdAt: now,
        lastActive: now,
        messageCount: 0,
        tokenCount: 0,
        cost: 0,
      };
      return { sessions: [...s.sessions, session], currentSession: session };
    });
  },

  syncSession(sessionId) {
    set(s => ({
      sessions: s.sessions.map(sess =>
        sess.id === sessionId ? { ...sess, lastActive: Date.now(), messageCount: sess.messageCount + 1 } : sess,
      ),
    }));
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

  togglePin(id) {
    set(s => ({
      sessions: s.sessions.map(sess =>
        sess.id === id ? { ...sess, pinned: sess.pinned ? undefined : true } : sess,
      ),
    }));
  },

  clearSessions() {
    set({ sessions: [], currentSession: null });
  },
}));
