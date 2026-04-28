import { create } from 'zustand';

export interface EditorTab {
  path: string;
  content: string;
  savedContent: string;
  language: string;
  /** Ranges highlighted due to agent file tool calls { startLine, endLine } */
  highlights: { startLine: number; endLine: number; kind: 'read' | 'edit' }[];
}

interface EditorState {
  tabs: EditorTab[];
  activeTab: string | null;
  openFile(path: string, content: string): void;
  closeTab(path: string): void;
  setContent(path: string, content: string): void;
  saveTab(path: string): Promise<void>;
  discardTab(path: string): void;
  addHighlight(path: string, startLine: number, endLine: number, kind: 'read' | 'edit'): void;
  clearHighlights(path: string): void;
}

function langFromPath(path: string): string {
  const ext = path.split('.').pop() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    json: 'json', md: 'markdown', py: 'python', rs: 'rust', go: 'go',
    css: 'css', html: 'html', sh: 'shell', bash: 'shell',
  };
  return map[ext] ?? 'plaintext';
}

export const useEditor = create<EditorState>((set, get) => ({
  tabs: [],
  activeTab: null,

  openFile(path, content) {
    const exists = get().tabs.find(t => t.path === path);
    if (exists) { set({ activeTab: path }); return; }
    set(s => ({
      tabs: [...s.tabs, { path, content, savedContent: content, language: langFromPath(path), highlights: [] }],
      activeTab: path,
    }));
  },

  closeTab(path) {
    set(s => {
      const tabs = s.tabs.filter(t => t.path !== path);
      const activeTab = s.activeTab === path
        ? (tabs[tabs.length - 1]?.path ?? null)
        : s.activeTab;
      return { tabs, activeTab };
    });
  },

  setContent(path, content) {
    set(s => ({ tabs: s.tabs.map(t => t.path === path ? { ...t, content } : t) }));
  },

  async saveTab(path) {
    const tab = get().tabs.find(t => t.path === path);
    if (!tab) return;
    await window.bridge.writeFile(path, tab.content);
    set(s => ({ tabs: s.tabs.map(t => t.path === path ? { ...t, savedContent: t.content } : t) }));
  },

  discardTab(path) {
    set(s => ({ tabs: s.tabs.map(t => t.path === path ? { ...t, content: t.savedContent } : t) }));
  },

  addHighlight(path, startLine, endLine, kind) {
    set(s => ({ tabs: s.tabs.map(t =>
      t.path === path
        ? { ...t, highlights: [...t.highlights, { startLine, endLine, kind }] }
        : t
    )}));
  },

  clearHighlights(path) {
    set(s => ({ tabs: s.tabs.map(t => t.path === path ? { ...t, highlights: [] } : t) }));
  },
}));
