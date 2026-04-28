# Sprint 5 — Terminal & Processes

> Paste into a fresh `claude` CLI session from `D:\cleak2`.
> Use `superpowers:subagent-driven-development` to execute task-by-task.

---

## Context

Cleak GUI is an Electron 31 + React 18 + TypeScript desktop app at `D:\cleak2\gui`.
Sprints 1–4 complete: bridge, app shell, rich chat renderer, files + Monaco editor.
**Previous tag:** `gui-s4`

---

## Goal

Add a real multi-tab terminal panel (xterm.js + node-pty) and a process-list panel.
Agent `BashTool`/`PowerShellTool` output is piped live into the matching terminal tab.
Background-task badges appear in the status bar and clicking them focuses the terminal tab.

---

## New Dependencies

```bash
cd D:\cleak2\gui
npm install xterm @xterm/xterm xterm-addon-fit xterm-addon-web-links
npm install node-pty
npm install -D electron-rebuild
```

> `node-pty` is a native Node.js addon — it must be rebuilt for the Electron version:
```bash
cd D:\cleak2\gui
npx electron-rebuild -f -w node-pty
```

---

## Architecture

- `node-pty` spawns shell processes in the **main process** only.
- `xterm.js` renders in the **renderer** only.
- Data flows over IPC:
  - Renderer → main: `pty:create`, `pty:input`, `pty:resize`, `pty:kill`
  - Main → renderer: `pty:data` (push)

The bridge also writes agent tool output into named pseudo-terminals via the same IPC.
When a `BashTool` tool_use block arrives, the chat store calls `pty:attachAgent`
(or creates a virtual tab) to stream subsequent `tool_result` content there.

---

## File Structure

```
gui/src/
├── main/
│   ├── ptyManager.ts         ← Create: node-pty lifecycle, IPC handlers
│   └── index.ts              ← Modify: register pty IPC, pass win to ptyManager
├── renderer/
│   ├── store/
│   │   └── terminals.ts      ← Create: terminal tab state (id, title, pid, active, background-task badges)
│   └── components/
│       ├── layout/
│       │   └── MainArea.tsx  ← Modify: add Terminal tab
│       └── terminal/
│           ├── TerminalPanel.tsx   ← Create: tab strip + TerminalPane per tab
│           ├── TerminalPane.tsx    ← Create: mounts xterm, handles resize
│           └── ProcessList.tsx     ← Create: ps-style list of active ptys with kill button
gui/tests/
└── terminal/
    └── terminalsStore.test.ts  ← Create
```

---

## IPC Channels to Add

In `gui/src/main/ipc.ts`:

```ts
export const PtyIpcChannels = {
  create:      'pty:create',      // renderer → main: { id, shell, cwd } → { pid }
  input:       'pty:input',       // renderer → main: { id, data: string }
  resize:      'pty:resize',      // renderer → main: { id, cols, rows }
  kill:        'pty:kill',        // renderer → main: { id }
  data:        'pty:data',        // main → renderer push: { id, data: string }
  exit:        'pty:exit',        // main → renderer push: { id, code: number }
} as const;
```

In `preload/index.ts`, expose:
```ts
ptyCreate:  (id: string, shell: string, cwd: string) => ipcRenderer.invoke(PtyIpcChannels.create, { id, shell, cwd }),
ptyInput:   (id: string, data: string) => ipcRenderer.send(PtyIpcChannels.input, { id, data }),
ptyResize:  (id: string, cols: number, rows: number) => ipcRenderer.send(PtyIpcChannels.resize, { id, cols, rows }),
ptyKill:    (id: string) => ipcRenderer.send(PtyIpcChannels.kill, { id }),
onPtyData:  (cb: (id: string, data: string) => void) => {
  const h = (_: unknown, p: { id: string; data: string }) => cb(p.id, p.data);
  ipcRenderer.on(PtyIpcChannels.data, h);
  return () => ipcRenderer.off(PtyIpcChannels.data, h);
},
onPtyExit:  (cb: (id: string, code: number) => void) => {
  const h = (_: unknown, p: { id: string; code: number }) => cb(p.id, p.code);
  ipcRenderer.on(PtyIpcChannels.exit, h);
  return () => ipcRenderer.off(PtyIpcChannels.exit, h);
},
```

---

## Task 1 — ptyManager.ts (Main Process)

**File:** `gui/src/main/ptyManager.ts`

```ts
import pty from 'node-pty';
import type { IPty } from 'node-pty';
import { ipcMain, BrowserWindow } from 'electron';
import { PtyIpcChannels } from './ipc';

interface PtyEntry { pty: IPty; shell: string; cwd: string; }

const ptys = new Map<string, PtyEntry>();

function getShell(): string {
  if (process.platform === 'win32') return process.env['COMSPEC'] ?? 'powershell.exe';
  return process.env['SHELL'] ?? '/bin/bash';
}

export function registerPtyIpc(win: BrowserWindow): void {
  ipcMain.handle(PtyIpcChannels.create, (_e, { id, shell, cwd }: { id: string; shell?: string; cwd: string }) => {
    const sh = shell ?? getShell();
    const p = pty.spawn(sh, [], {
      name: 'xterm-256color',
      cols: 80, rows: 24,
      cwd,
      env: { ...process.env } as Record<string, string>,
    });
    ptys.set(id, { pty: p, shell: sh, cwd });

    p.onData(data => {
      if (!win.isDestroyed()) win.webContents.send(PtyIpcChannels.data, { id, data });
    });
    p.onExit(({ exitCode }) => {
      ptys.delete(id);
      if (!win.isDestroyed()) win.webContents.send(PtyIpcChannels.exit, { id, code: exitCode });
    });

    return { pid: p.pid };
  });

  ipcMain.on(PtyIpcChannels.input, (_e, { id, data }: { id: string; data: string }) => {
    ptys.get(id)?.pty.write(data);
  });

  ipcMain.on(PtyIpcChannels.resize, (_e, { id, cols, rows }: { id: string; cols: number; rows: number }) => {
    ptys.get(id)?.pty.resize(cols, rows);
  });

  ipcMain.on(PtyIpcChannels.kill, (_e, { id }: { id: string }) => {
    ptys.get(id)?.pty.kill();
    ptys.delete(id);
  });
}

export function killAllPtys(): void {
  for (const { pty: p } of ptys.values()) {
    try { p.kill(); } catch { /* ignore */ }
  }
  ptys.clear();
}

export function listPtys(): { id: string; shell: string; cwd: string; pid: number }[] {
  return [...ptys.entries()].map(([id, e]) => ({
    id, shell: e.shell, cwd: e.cwd, pid: e.pty.pid,
  }));
}
```

In `index.ts`:
```ts
import { registerPtyIpc, killAllPtys } from './ptyManager';
// After win is created:
registerPtyIpc(win);
win.on('closed', () => { bridge.stop(); shim.close(); killAllPtys(); void watcher.close(); });
```

Write tests in `gui/tests/terminal/terminalsStore.test.ts` (store tests only — pty is too
native to unit-test; integration tested via the running app).

Commit: `git commit -m "feat(terminal): node-pty manager with IPC create/input/resize/kill"`

---

## Task 2 — Terminals Store

**File:** `gui/src/renderer/store/terminals.ts`

```ts
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
}

let counter = 0;
function nextTermId(): string { return `term-${++counter}`; }

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
}));
```

Tests:
- `createTab` adds tab and sets it active
- `removeTab` removes and updates activeId
- `setActive` clears showBadge
- `markDead` sets alive false

Run: `npm test`
Commit: `git commit -m "feat(terminal): terminals Zustand store"`

---

## Task 3 — TerminalPane Component

**File:** `gui/src/renderer/components/terminal/TerminalPane.tsx`

Uses xterm.js. Mounts the terminal into a `div` ref. Uses `FitAddon` for resize.

```tsx
import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface Props {
  id: string;
  cwd: string;
  isActive: boolean;
}

export function TerminalPane({ id, cwd, isActive }: Props): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !containerRef.current) return;
    startedRef.current = true;

    const term = new Terminal({
      theme: {
        background: '#0b0b0b',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
      },
      fontSize: 13,
      fontFamily: '"Cascadia Code", "JetBrains Mono", monospace',
      cursorBlink: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    // Spawn pty in main
    void window.bridge.ptyCreate(id, undefined, cwd).then(() => {
      // Data from pty → terminal
      const offData = window.bridge.onPtyData((tabId, data) => {
        if (tabId === id) term.write(data);
      });
      // Terminal input → pty
      term.onData(data => window.bridge.ptyInput(id, data));
      // Pty exit
      const offExit = window.bridge.onPtyExit((tabId) => {
        if (tabId === id) {
          term.writeln('\r\n[Process exited]');
        }
      });
      return () => { offData(); offExit(); };
    });

    return () => {
      window.bridge.ptyKill(id);
      term.dispose();
    };
  }, []);

  // Resize when tab becomes active
  useEffect(() => {
    if (isActive && fitRef.current) fitRef.current.fit();
  }, [isActive]);

  // ResizeObserver for container size changes
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => fitRef.current?.fit());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ display: isActive ? 'block' : 'none' }}
    />
  );
}
```

Note: xterm.js CSS must be imported. Add to renderer entry or App.tsx:
```ts
import '@xterm/xterm/css/xterm.css';
```

Commit: `git commit -m "feat(terminal): TerminalPane with xterm.js + FitAddon + node-pty wiring"`

---

## Task 4 — TerminalPanel Component

**File:** `gui/src/renderer/components/terminal/TerminalPanel.tsx`

Tab strip (+ New Terminal button) + renders one `TerminalPane` per tab:

```tsx
import React from 'react';
import { Plus, X } from 'lucide-react';
import { useTerminals } from '../../store/terminals';
import { TerminalPane } from './TerminalPane';
import { cn } from '../../lib/cn';

const DEFAULT_CWD = 'D:\\cleak2'; // TODO: expose from bridge

export function TerminalPanel(): React.ReactElement {
  const { tabs, activeId, createTab, removeTab, setActive } = useTerminals();

  function handleNew(): void {
    const id = createTab('Terminal');
    // TerminalPane handles ptyCreate on mount
    void id;
  }

  return (
    <div className="flex flex-col h-full bg-[#0b0b0b]">
      {/* Tab strip */}
      <div className="flex items-center border-b border-border shrink-0 bg-surface/30">
        {tabs.map(t => (
          <button
            key={t.id}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-border shrink-0 transition-colors',
              t.id === activeId ? 'bg-[#0b0b0b] text-primary' : 'text-muted hover:text-primary',
              !t.alive && 'opacity-50',
            )}
            onClick={() => setActive(t.id)}
          >
            {t.agentOwned && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
            <span>{t.title}</span>
            <span
              className="ml-1 rounded hover:bg-active p-0.5 text-muted"
              onClick={e => { e.stopPropagation(); removeTab(t.id); }}
            >
              <X size={10} />
            </span>
          </button>
        ))}
        <button
          className="px-2 py-1.5 text-muted hover:text-primary transition-colors"
          onClick={handleNew}
          title="New Terminal"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Panes */}
      <div className="flex-1 min-h-0 relative">
        {tabs.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted text-sm">
            <button
              className="px-3 py-1.5 rounded border border-border hover:border-accent text-xs transition-colors"
              onClick={handleNew}
            >
              + New Terminal
            </button>
          </div>
        )}
        {tabs.map(t => (
          <div key={t.id} className="absolute inset-0">
            <TerminalPane id={t.id} cwd={DEFAULT_CWD} isActive={t.id === activeId} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Wire into `MainArea.tsx`: add a "Terminal" tab that renders `<TerminalPanel />`.

Commit: `git commit -m "feat(terminal): TerminalPanel with multi-tab strip and + New button"`

---

## Task 5 — ProcessList Component

**File:** `gui/src/renderer/components/terminal/ProcessList.tsx`

Shows active terminal tabs with their titles and a Kill button. Doubles as the "Processes"
right-panel content.

```tsx
import React from 'react';
import { Cpu, X } from 'lucide-react';
import { useTerminals } from '../../store/terminals';
import { cn } from '../../lib/cn';

export function ProcessList(): React.ReactElement {
  const { tabs, activeId, setActive, removeTab } = useTerminals();

  if (tabs.length === 0) {
    return <div className="px-3 py-4 text-xs text-muted">No running processes</div>;
  }

  return (
    <div className="flex flex-col gap-0.5 py-2">
      {tabs.map(t => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-active transition-colors',
            t.id === activeId && 'bg-active',
          )}
          onClick={() => setActive(t.id)}
        >
          <Cpu size={11} className={t.alive ? 'text-green-500' : 'text-muted'} />
          <span className={cn('flex-1 truncate', t.alive ? 'text-primary' : 'text-muted')}>
            {t.title}
          </span>
          {!t.alive && <span className="text-muted">[exited]</span>}
          <button
            className="text-muted hover:text-red-400 transition-colors"
            title="Kill"
            onClick={e => {
              e.stopPropagation();
              window.bridge.ptyKill(t.id);
              removeTab(t.id);
            }}
          >
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}
```

Wire into `RightPanel.tsx` (or the appropriate right-panel slot) and into `SidePanel.tsx`
for the `processes` activity (add a Cpu icon to ActivityBar for it).

---

## Task 6 — Status Bar Background-Task Badges

In `StatusBar.tsx`, read `useTerminals` for tabs with `showBadge === true`.
Render a small clickable badge per agentOwned background terminal:

```tsx
const bgTabs = useTerminals(s => s.tabs.filter(t => t.agentOwned && t.showBadge && t.alive));
const setActive = useTerminals(s => s.setActive);
const setMainTab = useUi(s => s.setMainTab); // switch main area to terminal tab

// In the status bar JSX:
{bgTabs.map(t => (
  <button
    key={t.id}
    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
    onClick={() => { setMainTab('terminal'); setActive(t.id); }}
    title={t.title}
  >
    <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-accent" />
    {t.title}
  </button>
))}
```

Commit: `git commit -m "feat(terminal): ProcessList + status bar background-task badges"`

---

## Task 7 — Agent BashTool → Terminal Tab Routing

When the chat store ingests a `tool_use` block with `name === 'BashTool'` or
`name === 'PowerShellTool'`, create a named terminal tab and stream the `tool_result`
content into it.

In `gui/src/renderer/store/chat.ts` `ingestFrame()`, after detecting a bash tool_use:

```ts
if (block.type === 'tool_use' && (block.name === 'BashTool' || block.name === 'PowerShellTool')) {
  const input = block.input as Record<string, unknown>;
  const cmd = (input['command'] ?? '') as string;
  const title = block.name === 'PowerShellTool' ? 'PS' : 'bash';
  import('../store/terminals').then(({ useTerminals }) => {
    const id = useTerminals.getState().createTab(`${title}: ${cmd.slice(0, 30)}`, true);
    // Store the mapping tool_use_id → terminal id for when result arrives
    agentTerminalMap.set(block.id, id);
  });
}
```

When a matching `tool_result` arrives:
```ts
if (block.type === 'tool_result') {
  const termId = agentTerminalMap.get(block.tool_use_id);
  if (termId) {
    const output = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
    // Write output to the pty data stream (main process isn't involved — write directly to xterm)
    // Use a shared event emitter or store the Terminal ref per tab
    // Simplest: store output in terminals store, TerminalPane picks it up
    import('../store/terminals').then(({ useTerminals }) => {
      useTerminals.getState().writeOutput(termId, output);
    });
    agentTerminalMap.delete(block.tool_use_id);
  }
}
```

Add `writeOutput(id: string, text: string): void` to the terminals store. Each `TerminalPane`
subscribes to its id's output and calls `term.write(output)`.

Commit: `git commit -m "feat(terminal): route BashTool/PowerShellTool output to named terminal tabs"`

---

## Task 8 — Typecheck & Final Test Pass

```bash
cd D:\cleak2\gui
npm run typecheck
npm test
```

Fix all errors. Tag:
```bash
git tag gui-s5
```

---

## Definition of Done

- [ ] `npm test` passes
- [ ] `npm run typecheck` clean
- [ ] "New Terminal" button opens a working shell (PowerShell on Windows)
- [ ] Multi-tab: can have 3+ terminals open, switch between them
- [ ] Agent `BashTool` creates a named background terminal tab, result streams in
- [ ] Status bar shows badge for background agent terminals; click focuses terminal tab
- [ ] Process list shows running terminals with Kill button
- [ ] Tagged `gui-s5`
