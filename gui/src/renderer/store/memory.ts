import { create } from 'zustand';

export type MemoryType = 'user' | 'feedback' | 'project' | 'reference';

/** One entry in the memory index (MEMORY.md line). */
export interface MemoryIndexEntry {
  title: string;
  file: string;
  summary: string;
}

/** Full memory from a .md file (frontmatter + body). */
export interface MemoryFile {
  name: string;
  description: string;
  type: MemoryType;
  file: string;
  body: string;
  why?: string;
  howToApply?: string;
}

export interface RememberConfig {
  enabled: boolean;
  types: MemoryType[];
}

interface MemoryState {
  index: MemoryIndexEntry[];
  selected: MemoryFile | null;
  filter: MemoryType | 'all';
  rememberConfig: RememberConfig;
  loadMemories(): Promise<void>;
  selectMemory(file: string): Promise<void>;
  createMemory(file: string, entry: {
    name: string;
    description: string;
    type: MemoryType;
    body: string;
  }): Promise<void>;
  updateMemory(file: string, updates: Partial<{
    name: string;
    description: string;
    type: MemoryType;
    body: string;
  }>): Promise<void>;
  deleteMemory(file: string): Promise<void>;
  setFilter(type: MemoryType | 'all'): void;
  updateRememberConfig(cfg: Partial<RememberConfig>): Promise<void>;
}

export const useMemory = create<MemoryState>((set, get) => ({
  index: [],
  selected: null,
  filter: 'all',
  rememberConfig: { enabled: true, types: ['user', 'feedback', 'project', 'reference'] },

  async loadMemories() {
    // 1. Read MEMORY.md, parse each line: "- [Title](file.md) — summary"
    // 2. For each file, read memory/<file>.md, parse frontmatter + body
    // 3. Merge into index[] (from MEMORY.md) + enrich from file content
    // const raw = await window.bridge.loadMemories();
    set({ index: [] });
  },

  async selectMemory(file) {
    // Read full .md file content
    // const full = await window.bridge.readMemoryFile(file);
    // Parse frontmatter + extract **Why:** / **How to apply:** sections
    set({ selected: null });
  },

  async createMemory(file, entry) {
    // Step 1: Write memory/<file>.md with frontmatter + body
    // Step 2: Append "- [Name](file) — description" to MEMORY.md index
    // await window.bridge.createMemory(file, entry);
    const newEntry: MemoryIndexEntry = {
      title: entry.name,
      file,
      summary: entry.description.length > 150
        ? entry.description.slice(0, 147) + '...'
        : entry.description,
    };
    set(s => ({ index: [...s.index, newEntry] }));
  },

  async updateMemory(file, updates) {
    // Rewrite .md file with updated frontmatter + body
    // If name changed, update corresponding MEMORY.md line
    // await window.bridge.updateMemory(file, updates);
    set(s => ({
      index: s.index.map(e =>
        e.file === file
          ? { ...e, title: updates.name ?? e.title, summary: updates.description ?? e.summary }
          : e,
      ),
    }));
  },

  async deleteMemory(file) {
    // Remove memory/<file>.md
    // Remove matching line from MEMORY.md index
    // await window.bridge.deleteMemory(file);
    set(s => ({
      index: s.index.filter(e => e.file !== file),
      selected: s.selected?.file === file ? null : s.selected,
    }));
  },

  setFilter(type) {
    set({ filter: type });
  },

  async updateRememberConfig(cfg) {
    // Persist to .remember file via bridge
    set(s => ({ rememberConfig: { ...s.rememberConfig, ...cfg } }));
  },
}));
