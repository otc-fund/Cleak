import { create } from 'zustand';

export interface TreeNode {
  name: string;
  path: string;
  kind: 'file' | 'dir';
  children?: TreeNode[];
}

interface FilesState {
  root: string;
  tree: TreeNode[];
  expanded: Set<string>;
  filter: string;
  loading: boolean;
  error: string | null;
  loadTree(root: string): Promise<void>;
  toggleExpand(path: string): void;
  setFilter(f: string): void;
  refreshNode(path: string): void;
}

export const useFiles = create<FilesState>((set, get) => ({
  root: '',
  tree: [],
  expanded: new Set(),
  filter: '',
  loading: false,
  error: null,

  async loadTree(root) {
    set({ loading: true, error: null, root });
    try {
      const tree = await window.bridge.listTree(root) as TreeNode[];
      set({ tree, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  toggleExpand(path) {
    set(s => {
      const next = new Set(s.expanded);
      next.has(path) ? next.delete(path) : next.add(path);
      return { expanded: next };
    });
  },

  setFilter(f) { set({ filter: f }); },

  refreshNode(_path) { void get().loadTree(get().root); },
}));
