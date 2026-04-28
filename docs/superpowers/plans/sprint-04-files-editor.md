# Sprint 4 — Files & Editor

> Paste into a fresh `claude` CLI session from `D:\cleak2`.
> Use `superpowers:subagent-driven-development` to execute task-by-task.

---

## Context

Cleak GUI is an Electron 31 + React 18 + TypeScript desktop app at `D:\cleak2\gui`.
Sprints 1–3 complete: bridge, app shell, rich chat renderer.
**Previous tag:** `gui-s3`

Working directory for the project files: `D:\cleak2` (cwd passed to claude.exe subprocess).

---

## Goal

Add a real file panel and Monaco editor:
- File tree with search/filter, expand/collapse, .gitignore-aware, watch for changes
- Monaco editor with multi-tab, dirty-state, save/discard
- Inline diff view for agent edits (from `FileEditTool` / `FileWriteTool` bridge frames)
- Project-wide search panel
- Live highlight of regions touched by file tool calls in the editor

---

## New Dependencies

```bash
cd D:\cleak2\gui
npm install @monaco-editor/react monaco-editor
npm install ignore   # .gitignore parsing
npm install chokidar # file watcher (main process)
npm install -D @types/node
```

> `chokidar` runs in the **main process** only. `monaco-editor` is renderer-only.
> `ignore` can run in both (used in main for tree building).

---

## File Structure

```
gui/src/
├── main/
│   ├── fileTree.ts          ← Create: build dir tree respecting .gitignore; chokidar watcher
│   └── index.ts             ← Modify: register file IPC channels
├── renderer/
│   ├── store/
│   │   ├── files.ts         ← Replace stub: file tree state, open tabs, dirty tracking
│   │   └── editor.ts        ← Create: editor tab state (path, content, savedContent, highlights)
│   └── components/
│       ├── layout/
│       │   └── SidePanel.tsx ← Modify: render <FilePanel /> for 'files' activity
│       ├── files/
│       │   ├── FilePanel.tsx    ← Create: tree + search bar
│       │   ├── FileTree.tsx     ← Create: recursive virtualized tree
│       │   └── FileTreeNode.tsx ← Create: single node (icon, name, chevron)
│       └── editor/
│           ├── EditorArea.tsx   ← Create: tab strip + Monaco instance
│           ├── EditorTab.tsx    ← Create: tab pill with dirty dot + close
│           └── DiffView.tsx     ← Create: side-by-side diff using Monaco diff editor
gui/tests/
└── files/
    ├── fileTree.test.ts     ← Create: unit tests for tree builder
    └── filesStore.test.ts   ← Create: store tests
```

---

## IPC Channels to Add

In `gui/src/main/ipc.ts`, add:

```ts
export const FileIpcChannels = {
  listTree:      'files:listTree',
  readFile:      'files:readFile',
  writeFile:     'files:writeFile',
  watchStart:    'files:watchStart',
  watchStop:     'files:watchStop',
  watchEvent:    'files:watchEvent',  // main → renderer push
} as const;
```

In preload `index.ts`, expose:
```ts
listTree: (root: string) => ipcRenderer.invoke(FileIpcChannels.listTree, root),
readFile: (path: string) => ipcRenderer.invoke(FileIpcChannels.readFile, path),
writeFile: (path: string, content: string) => ipcRenderer.invoke(FileIpcChannels.writeFile, path, content),
onWatchEvent: (cb: (e: WatchEvent) => void) => {
  const handler = (_: unknown, e: WatchEvent) => cb(e);
  ipcRenderer.on(FileIpcChannels.watchEvent, handler);
  return () => ipcRenderer.off(FileIpcChannels.watchEvent, handler);
},
```

---

## Task 1 — fileTree.ts (Main Process)

**File:** `gui/src/main/fileTree.ts`

```ts
import { readdir, stat } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import ignore from 'ignore';

export interface TreeNode {
  name: string;
  path: string;   // absolute
  kind: 'file' | 'dir';
  children?: TreeNode[];
}

const ALWAYS_IGNORE = ['.git', 'node_modules', 'out', 'dist', '.vite'];

async function buildTree(dir: string, ig: ReturnType<typeof ignore>): Promise<TreeNode[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nodes: TreeNode[] = [];
  for (const e of entries) {
    if (ALWAYS_IGNORE.includes(e.name)) continue;
    const abs = join(dir, e.name);
    const rel = relative(dir, abs);
    if (ig.ignores(rel)) continue;
    if (e.isDirectory()) {
      const children = await buildTree(abs, ig);
      nodes.push({ name: e.name, path: abs, kind: 'dir', children });
    } else {
      nodes.push({ name: e.name, path: abs, kind: 'file' });
    }
  }
  return nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function getFileTree(root: string): Promise<TreeNode[]> {
  const ig = ignore();
  const gitignorePath = join(root, '.gitignore');
  if (existsSync(gitignorePath)) {
    ig.add(readFileSync(gitignorePath, 'utf8'));
  }
  return buildTree(root, ig);
}
```

Wire chokidar in `index.ts`:
```ts
import chokidar from 'chokidar';
// After window created:
const watcher = chokidar.watch(resolveSdkCwd(), {
  ignored: /(^|[\/\\])(\.git|node_modules|out|dist)/,
  persistent: true, ignoreInitial: true, depth: 6,
});
['add','change','unlink','addDir','unlinkDir'].forEach(ev => {
  watcher.on(ev, (path: string) => {
    if (!win.isDestroyed()) win.webContents.send(FileIpcChannels.watchEvent, { event: ev, path });
  });
});
win.on('closed', () => { bridge.stop(); shim.close(); void watcher.close(); });
```

Register IPC handlers:
```ts
ipcMain.handle(FileIpcChannels.listTree, (_e, root: string) => getFileTree(root));
ipcMain.handle(FileIpcChannels.readFile, (_e, path: string) => readFileSync(path, 'utf8'));
ipcMain.handle(FileIpcChannels.writeFile, (_e, path: string, content: string) => {
  writeFileSync(path, content, 'utf8');
});
```

Write tests in `gui/tests/files/fileTree.test.ts`:
- `getFileTree` returns sorted dirs-first
- skips `node_modules` and `.git`
- respects simple `.gitignore` patterns

Run: `npm test`
Commit: `git commit -m "feat(files): fileTree builder with .gitignore support and chokidar watcher"`

---

## Task 2 — Files Store

**File:** `gui/src/renderer/store/files.ts` (replace the empty stub)

```ts
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

  // Re-fetch tree from root after a watch event
  refreshNode(_path) { void get().loadTree(get().root); },
}));
```

Write tests in `gui/tests/files/filesStore.test.ts`:
- `toggleExpand` adds then removes path
- `setFilter` updates filter
- `loadTree` on success sets tree

Commit: `git commit -m "feat(files): files Zustand store with tree load, expand, filter"`

---

## Task 3 — Editor Store

**File:** `gui/src/renderer/store/editor.ts`

```ts
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
```

Commit: `git commit -m "feat(editor): editor Zustand store with tabs, dirty state, highlights"`

---

## Task 4 — FilePanel & FileTree Components

**Files:** `gui/src/renderer/components/files/FilePanel.tsx`, `FileTree.tsx`, `FileTreeNode.tsx`

`FilePanel.tsx`:
```tsx
import React, { useEffect } from 'react';
import { useFiles } from '../../store/files';
import { useEditor } from '../../store/editor';
import { FileTree } from './FileTree';

const PROJECT_ROOT = 'D:\\cleak2'; // TODO: expose from bridge as cwd

export function FilePanel(): React.ReactElement {
  const { loadTree, tree, filter, setFilter, loading } = useFiles();

  useEffect(() => { void loadTree(PROJECT_ROOT); }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-2">
        <input
          className="w-full text-xs px-2 py-1 rounded bg-base border border-border
                     text-primary placeholder-subtle focus:outline-none focus:border-accent"
          placeholder="Filter files…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>
      {loading && <div className="px-3 text-xs text-muted">Loading…</div>}
      <div className="flex-1 overflow-y-auto">
        <FileTree nodes={tree} depth={0} />
      </div>
    </div>
  );
}
```

`FileTreeNode.tsx` — renders one node, recursively renders children if expanded:
```tsx
import React from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import { useFiles, type TreeNode } from '../../store/files';
import { useEditor } from '../../store/editor';
import { cn } from '../../lib/cn';

interface Props {
  node: TreeNode;
  depth: number;
  filter: string;
}

export function FileTreeNode({ node, depth, filter }: Props): React.ReactElement | null {
  const { expanded, toggleExpand } = useFiles();
  const { openFile, activeTab } = useEditor();
  const isOpen = expanded.has(node.path);
  const isActive = activeTab === node.path;

  // Filter: show file if name matches; show dir if any descendant matches
  if (filter) {
    const matches = (n: TreeNode): boolean => {
      if (n.name.toLowerCase().includes(filter.toLowerCase())) return true;
      return (n.children ?? []).some(matches);
    };
    if (!matches(node)) return null;
  }

  const handleClick = async (): Promise<void> => {
    if (node.kind === 'dir') { toggleExpand(node.path); return; }
    const content = await window.bridge.readFile(node.path) as string;
    openFile(node.path, content);
  };

  return (
    <>
      <button
        className={cn(
          'w-full flex items-center gap-1.5 px-2 py-0.5 text-xs text-left truncate hover:bg-active transition-colors',
          isActive && 'bg-active text-primary',
          !isActive && 'text-secondary',
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => void handleClick()}
      >
        {node.kind === 'dir'
          ? isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />
          : <span className="w-[11px]" />}
        {node.kind === 'dir'
          ? isOpen ? <FolderOpen size={12} className="text-accent/70" /> : <Folder size={12} className="text-accent/70" />
          : <File size={12} className="text-muted" />}
        <span className="truncate">{node.name}</span>
      </button>
      {node.kind === 'dir' && isOpen && node.children?.map(child => (
        <FileTreeNode key={child.path} node={child} depth={depth + 1} filter={filter} />
      ))}
    </>
  );
}
```

`FileTree.tsx`:
```tsx
import React from 'react';
import { useFiles, type TreeNode } from '../../store/files';
import { FileTreeNode } from './FileTreeNode';

interface Props { nodes: TreeNode[]; depth: number; }

export function FileTree({ nodes, depth }: Props): React.ReactElement {
  const { filter } = useFiles();
  return (
    <>
      {nodes.map(n => <FileTreeNode key={n.path} node={n} depth={depth} filter={filter} />)}
    </>
  );
}
```

Wire into `SidePanel.tsx`: when `activeActivity === 'files'`, render `<FilePanel />`.

Commit: `git commit -m "feat(files): FilePanel, FileTree, FileTreeNode with filter and expand"`

---

## Task 5 — EditorArea & EditorTab Components

**Files:** `gui/src/renderer/components/editor/EditorArea.tsx`, `EditorTab.tsx`

`EditorTab.tsx`:
```tsx
import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface Props {
  path: string;
  isDirty: boolean;
  isActive: boolean;
  onSelect(): void;
  onClose(): void;
}

export function EditorTab({ path, isDirty, isActive, onSelect, onClose }: Props): React.ReactElement {
  const name = path.split(/[\\/]/).pop() ?? path;
  return (
    <div
      className={cn(
        'flex items-center gap-1 px-3 py-1.5 text-xs border-r border-border cursor-pointer select-none shrink-0',
        isActive ? 'bg-surface text-primary border-b border-b-surface' : 'text-muted hover:text-primary',
      )}
      onClick={onSelect}
    >
      {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" title="Unsaved changes" />}
      <span className="max-w-[120px] truncate">{name}</span>
      <button
        className="ml-1 rounded hover:bg-active p-0.5"
        onClick={e => { e.stopPropagation(); onClose(); }}
        title="Close"
      >
        <X size={10} />
      </button>
    </div>
  );
}
```

`EditorArea.tsx`:
```tsx
import React, { useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useEditor } from '../../store/editor';
import { EditorTab } from './EditorTab';
import { useUi } from '../../store/ui';

export function EditorArea(): React.ReactElement {
  const { tabs, activeTab, closeTab, setContent, saveTab, discardTab } = useEditor();
  const { theme } = useUi();
  const monacoTheme = theme === 'light' ? 'vs' : 'vs-dark';

  const activeTabData = tabs.find(t => t.path === activeTab);

  const handleMount: OnMount = (editor, monaco) => {
    // Ctrl+S to save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeTab) void saveTab(activeTab);
    });
  };

  if (tabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Open a file from the file panel
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab strip */}
      <div className="flex border-b border-border overflow-x-auto shrink-0 bg-surface/50">
        {tabs.map(t => (
          <EditorTab
            key={t.path}
            path={t.path}
            isDirty={t.content !== t.savedContent}
            isActive={t.path === activeTab}
            onSelect={() => useEditor.getState().tabs && useEditor.setState({ activeTab: t.path })}
            onClose={() => {
              if (t.content !== t.savedContent) {
                if (!confirm(`Discard changes to ${t.path.split(/[\\/]/).pop()}?`)) return;
              }
              closeTab(t.path);
            }}
          />
        ))}
      </div>

      {/* Editor */}
      {activeTabData && (
        <div className="flex-1 min-h-0">
          <Editor
            path={activeTabData.path}
            value={activeTabData.content}
            language={activeTabData.language}
            theme={monacoTheme}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              tabSize: 2,
            }}
            onChange={v => { if (v != null) setContent(activeTabData.path, v); }}
            onMount={handleMount}
          />
        </div>
      )}
    </div>
  );
}
```

Wire `<EditorArea />` into the MainArea's `editor` tab content slot. In `MainArea.tsx`,
add an "Editor" tab that renders `<EditorArea />`.

Commit: `git commit -m "feat(editor): Monaco EditorArea with tabs, dirty state, Ctrl+S save"`

---

## Task 6 — Agent Edit Highlights

When the bridge emits frames containing `tool_use` blocks with names
`FileReadTool`, `FileEditTool`, `FileWriteTool`, or `PatchApplyTool`, parse the file path
from the tool input and add a highlight to the editor store.

In `gui/src/renderer/store/chat.ts` `ingestFrame()`, after processing tool_use blocks,
emit a side-effect to the editor store:

```ts
// In ingestFrame, after pushing a tool_use block:
if (block.type === 'tool_use') {
  const FILE_TOOLS: Record<string, 'read' | 'edit'> = {
    FileReadTool: 'read', FileEditTool: 'edit',
    FileWriteTool: 'edit', PatchApplyTool: 'edit',
  };
  const kind = FILE_TOOLS[block.name];
  if (kind) {
    const input = block.input as Record<string, unknown>;
    const filePath = (input['file_path'] ?? input['path']) as string | undefined;
    const startLine = (input['start_line'] ?? 1) as number;
    const endLine   = (input['end_line']   ?? startLine) as number;
    if (filePath) {
      // lazy import to avoid circular deps
      import('../store/editor').then(({ useEditor }) => {
        useEditor.getState().addHighlight(filePath, startLine, endLine, kind);
      });
    }
  }
}
```

In `EditorArea.tsx`, use Monaco's `editor.deltaDecorations` (or `createDecorationsCollection`)
to highlight the ranges after `onMount`:
```ts
// After mounting, when activeTabData.highlights change:
// Add decorations for each highlight
// 'read' → gutter info icon + light blue background
// 'edit' → gutter pencil icon + amber background
```

Use a `useEffect` that updates decorations when `activeTabData?.highlights` changes.

Commit: `git commit -m "feat(editor): highlight file regions from agent FileReadTool/FileEditTool events"`

---

## Task 7 — Typecheck & Final Test Pass

```bash
cd D:\cleak2\gui
npm run typecheck
npm test
```

Fix all TypeScript errors. All tests must pass.

Tag:
```bash
git tag gui-s4
```

---

## Definition of Done

- [ ] `npm test` passes
- [ ] `npm run typecheck` clean
- [ ] File panel shows project tree filtered by search, expandable dirs
- [ ] Clicking a file opens it in Monaco editor tab
- [ ] Editor tab shows dirty dot; Ctrl+S saves; discard reverts
- [ ] Chokidar watcher refreshes tree on file system changes
- [ ] Agent `FileEditTool` events highlight the touched line range in Monaco
- [ ] Tagged `gui-s4`
