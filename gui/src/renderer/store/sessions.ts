import { create } from 'zustand';
import type { PersistedSession } from '../../main/sessionsStore';

export type Session = PersistedSession;

interface SessionState {
  sessions: Session[];
  currentSession: Session | null;
  loadSessions(): Promise<void>;
  createSession(id: string, name?: string): void;
  renameSession(id: string, name: string): void;
  selectSession(id: string): void;
  deleteSession(id: string): Promise<void>;
  exportSession(id: string): void;
  importSession(file: File): Promise<void>;
  syncSession(sessionId: string): void;
  togglePin(id: string): void;
  clearSessions(): void;
}

const bridge = typeof window !== 'undefined' ? (window as any).bridge : undefined;

async function ipcSave(session: Session): Promise<void> {
  await bridge?.saveSession(session);
}

async function ipcDelete(id: string): Promise<void> {
  await bridge?.deleteSession(id);
}

async function ipcUpdate(id: string, patch: Record<string, unknown>): Promise<void> {
  await bridge?.updateSession(id, patch);
}

export const useSessions = create<SessionState>((set) => ({
  sessions: [],
  currentSession: null,

  async loadSessions() {
    try {
      const persisted = await bridge?.listSessions() as Session[] | undefined;
      set({ sessions: persisted ?? [] });
    } catch {
      set({ sessions: [] });
    }
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
        pinned: false,
      };
      void ipcSave(session);
      return { sessions: [...s.sessions, session], currentSession: session };
    });
  },

  renameSession(id, name) {
    set(s => ({
      sessions: s.sessions.map(sess =>
        sess.id === id ? { ...sess, name } : sess,
      ),
    }));
    void ipcUpdate(id, { name } as Record<string, unknown>);
  },

  syncSession(sessionId) {
    set(s => ({
      sessions: s.sessions.map(sess =>
        sess.id === sessionId ? { ...sess, lastActive: Date.now(), messageCount: sess.messageCount + 1 } : sess,
      ),
    }));
    // Debounced persist: update lastActive and messageCount
    setTimeout(() => {
      const state = useSessions.getState();
      const session = state.sessions.find(s => s.id === sessionId);
      if (session) void ipcUpdate(sessionId, { lastActive: session.lastActive, messageCount: session.messageCount } as Record<string, unknown>);
    }, 2000);
  },

  selectSession(id) {
    set(s => ({
      currentSession: s.sessions.find(s => s.id === id) ?? null,
    }));
    // Send session switch to bridge
  },

  async deleteSession(id) {
    set(s => ({
      sessions: s.sessions.filter(s => s.id !== id),
      currentSession: s.currentSession?.id === id ? null : s.currentSession,
    }));
    await ipcDelete(id);
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
        sess.id === id ? { ...sess, pinned: !sess.pinned } : sess,
      ),
    }));
    const state = useSessions.getState();
    const session = state.sessions.find(s => s.id === id);
    if (session) void ipcUpdate(id, { pinned: session.pinned } as Record<string, unknown>);
  },

  clearSessions() {
    set({ sessions: [], currentSession: null });
  },
}));
