import { create } from 'zustand';
import Fuse from 'fuse.js';

export interface GrepMatch {
  file: string;
  line: number;
  column: number;
  matchText: string;
}

export interface SearchResultGroup {
  file: string;
  matches: GrepMatch[];
}

export interface QuickOpenEntry {
  path: string;   // relative path
  label: string;  // basename
}

export interface SearchState {
  // Grep
  grepQuery: string;
  grepGlob: string;
  grepRegex: boolean;
  grepResults: SearchResultGroup[];
  grepRunning: boolean;
  setGrepQuery(q: string): void;
  setGrepGlob(g: string): void;
  toggleGrepRegex(): void;
  runGrep(cwd: string): Promise<void>;

  // Quick Open
  quickOpenEntries: QuickOpenEntry[];
  quickOpenOpen: boolean;
  quickOpenQuery: string;
  quickOpenFuse: Fuse<QuickOpenEntry> | null;
  quickOpenMatches: QuickOpenEntry[];
  setQuickOpen(open: boolean): void;
  setQuickOpenQuery(q: string): void;
  populateQuickOpen(entries: QuickOpenEntry[]): void;

  // Glob picker
  globResults: string[];
  runGlob(pattern: string, cwd: string): Promise<void>;
}

const MAX_QUICK_OPEN_RESULTS = 30;

export const useSearch = create<SearchState>((set, get) => ({
  grepQuery: '',
  grepGlob: '',
  grepRegex: false,
  grepResults: [],
  grepRunning: false,

  setGrepQuery: (q) => set({ grepQuery: q }),
  setGrepGlob: (g) => set({ grepGlob: g }),
  toggleGrepRegex: () => set((s) => ({ grepRegex: !s.grepRegex })),

  async runGrep(cwd) {
    const { grepQuery, grepGlob, grepRegex } = get();
    if (!grepQuery) return;
    set({ grepRunning: true, grepResults: [] });
    try {
      const raw = await window.bridge.searchGrep(grepQuery, cwd, {
        glob: grepGlob || undefined,
        regex: grepRegex,
      }) as GrepMatch[];
      const grouped = new Map<string, GrepMatch[]>();
      for (const m of raw) {
        if (!grouped.has(m.file)) grouped.set(m.file, []);
        grouped.get(m.file)!.push(m);
      }
      const results: SearchResultGroup[] = [...grouped.entries()].map(([file, matches]) => ({
        file, matches,
      }));
      set({ grepResults: results });
    } finally {
      set({ grepRunning: false });
    }
  },

  // Quick open
  quickOpenEntries: [],
  quickOpenOpen: false,
  quickOpenQuery: '',
  quickOpenFuse: null,
  quickOpenMatches: [],

  setQuickOpen(open) {
    set({ quickOpenOpen: open, quickOpenQuery: '', quickOpenMatches: open ? get().quickOpenEntries : [] });
  },
  setQuickOpenQuery(q) {
    const { quickOpenFuse, quickOpenEntries } = get();
    const matches = quickOpenFuse && q
      ? quickOpenFuse.search(q).slice(0, MAX_QUICK_OPEN_RESULTS).map(r => r.item)
      : quickOpenEntries.slice(0, MAX_QUICK_OPEN_RESULTS);
    set({ quickOpenQuery: q, quickOpenMatches: matches });
  },
  populateQuickOpen(entries) {
    const fuse = new Fuse(entries, { keys: ['label', 'path'], threshold: 0.4 });
    set({ quickOpenEntries: entries, quickOpenFuse: fuse, quickOpenMatches: entries.slice(0, MAX_QUICK_OPEN_RESULTS) });
  },

  // Glob
  globResults: [],
  async runGlob(pattern, cwd) {
    try {
      const raw = await window.bridge.searchGlob(pattern, cwd) as string[];
      set({ globResults: raw });
    } catch (err) {
      console.error('[search:runGlob] Error:', err);
      set({ globResults: [] });
    }
  },
}));
