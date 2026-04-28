import { create } from 'zustand';

export interface TerminalTab {
  id: string;
  title: string;
  /** True if spawned by agent (BashTool/PowerShellTool) */
  agentOwned: boolean;
  /** True while process is alive */
  alive: boolean;
  /** Badge shown in status bar when agentOwned and not focused */
  showBadge: boolean;
}

interface TerminalsState {
  tabs: TerminalTab[];
  activeId: string | null;
  createTab(title?: string, agentOwned?: boolean): string;
  removeTab(id: string): void;
  setActive(id: string): void;
  markDead(id: string): void;
  /** Write output to a terminal's xterm (used by agent tool_result routing) */
  writeOutput(id: string, text: string): void;
  /** Subscribe to output writes for a specific terminal id */
  onOutput(id: string, cb: (text: string) => void): () => void;
}

let counter = 0;
function nextTermId(): string { return `term-${++counter}`; }

// Callback registry for agent output routing
const outputListeners = new Map<string, Set<(text: string) => void>>();

export const useTerminals = create<TerminalsState>((set, get) => ({
  tabs: [],
  activeId: null,

  createTab(title = 'Terminal', agentOwned = false) {
    const id = nextTermId();
    set(s => ({
      tabs: [...s.tabs, { id, title, agentOwned, alive: true, showBadge: agentOwned }],
      activeId: id,
    }));
    return id;
  },

  removeTab(id) {
    outputListeners.delete(id);
    set(s => {
      const tabs = s.tabs.filter(t => t.id !== id);
      const activeId = s.activeId === id ? (tabs[tabs.length - 1]?.id ?? null) : s.activeId;
      return { tabs, activeId };
    });
  },

  setActive(id) {
    set(s => ({
      activeId: id,
      tabs: s.tabs.map(t => t.id === id ? { ...t, showBadge: false } : t),
    }));
  },

  markDead(id) {
    set(s => ({ tabs: s.tabs.map(t => t.id === id ? { ...t, alive: false } : t) }));
  },

  writeOutput(id, text) {
    const listeners = outputListeners.get(id);
    if (listeners) {
      for (const cb of listeners) cb(text);
    }
  },

  onOutput(id, cb) {
    if (!outputListeners.has(id)) outputListeners.set(id, new Set());
    outputListeners.get(id)!.add(cb);
    return () => {
      const s = outputListeners.get(id);
      if (s) { s.delete(cb); if (s.size === 0) outputListeners.delete(id); }
    };
  },
}));
