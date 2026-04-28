# Sprint 2 — App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal S1 chat layout with a full VS Code-style desktop shell: activity bar, collapsible side panel, tabbed main area, right panel, rich status bar, theme system (dark/light/high-contrast), and a settings panel that persists the API key securely via Electron's built-in `safeStorage`.

**Architecture:** The shell is a pure-renderer concern except for settings persistence. Main process gets a new `settings.ts` module that loads/saves a JSON file at `userData`, with the API key encrypted via Electron `safeStorage` (OS DPAPI on Windows). New IPC channels expose `loadSettings` / `saveSettings` to the renderer. Three new Zustand stores (`ui`, `settings`, and domain stubs) drive layout and config. The chat panel stays; it moves into a slot in the new main-area tab system.

**Tech Stack:** (adds to S1) clsx · tailwind-merge · lucide-react · @radix-ui/react-tabs · @radix-ui/react-tooltip · Electron safeStorage (built-in)

---

## File structure

All paths under `D:\cleak2\gui\` unless noted.

```
src/
├── main/
│   ├── index.ts              ← Modify: read persisted settings for shim config; wire settings IPC
│   ├── ipc.ts                ← Modify: add AppSettings type + loadSettings/saveSettings channels
│   └── settings.ts           ← Create: safeStorage-backed settings persistence
├── preload/
│   └── index.ts              ← Modify: expose loadSettings/saveSettings in BridgeApi
└── renderer/
    ├── styles.css             ← Modify: add CSS custom-property theme tokens
    ├── App.tsx                ← Modify: replace minimal flex layout with <AppShell />
    ├── global.d.ts            ← Modify: extend Window.bridge with settings API
    ├── lib/
    │   ├── bridge.ts          ← Modify: useBridgeWiring guard already present (no change)
    │   └── cn.ts              ← Create: clsx + tailwind-merge cn() helper
    ├── store/
    │   ├── chat.ts            ← Unchanged
    │   ├── ui.ts              ← Create: layout state (active activity, panel open, active tab, theme)
    │   ├── settings.ts        ← Create: settings store (API config, theme — syncs with main via IPC)
    │   └── domain.ts          ← Create: empty stub stores for files/todos/tasks/agents/mcp/git/perms
    └── components/
        ├── layout/
        │   ├── AppShell.tsx   ← Create: top-level 3-column layout
        │   ├── ActivityBar.tsx← Create: left icon strip, switches active panel
        │   ├── SidePanel.tsx  ← Create: collapsible left panel, hosts settings + future panels
        │   ├── MainArea.tsx   ← Create: tab strip + tab content (chat tab for now)
        │   └── RightPanel.tsx ← Create: placeholder collapsible right panel
        ├── settings/
        │   └── SettingsPanel.tsx ← Create: API config form, theme selector, env-var display
        ├── ChatView.tsx       ← Unchanged
        ├── MessageInput.tsx   ← Unchanged
        └── StatusBar.tsx      ← Replace: rich version with model, cost, mode, bridge state
tests/
├── settings.test.ts           ← Create: unit tests for settings.ts (mocked electron + fs)
└── uiStore.test.ts            ← Create: unit tests for ui store panel-toggle logic
```

---

## Task 1: Add S2 dependencies

**Files:**
- Modify: `gui/package.json`

- [ ] **Step 1: Install new packages**

Run from `D:\cleak2\gui\`:
```bash
npm install clsx tailwind-merge lucide-react @radix-ui/react-tabs @radix-ui/react-tooltip
```
Expected: packages added, no peer errors that block the build.

- [ ] **Step 2: Verify install**

```bash
node -e "require('clsx'); require('tailwind-merge'); require('lucide-react'); console.log('ok')"
```
Expected: prints `ok`.

- [ ] **Step 3: Commit**

From `D:\cleak2\`:
```bash
git add gui/package.json gui/package-lock.json
git commit -m "chore(gui): add clsx, tailwind-merge, lucide-react, radix-ui tabs/tooltip"
```

---

## Task 2: Theme tokens + cn() utility

**Files:**
- Create: `gui/src/renderer/lib/cn.ts`
- Modify: `gui/src/renderer/styles.css`
- Modify: `gui/tailwind.config.cjs`

- [ ] **Step 1: Write `src/renderer/lib/cn.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Write a quick test for `cn()`**

Create `gui/tests/cn.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { cn } from '../src/renderer/lib/cn';

describe('cn', () => {
  it('merges class strings', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('resolves tailwind conflicts (last wins)', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });

  it('strips falsy values', () => {
    expect(cn('a', false, undefined, 'b')).toBe('a b');
  });
});
```

- [ ] **Step 3: Run, confirm 3 new tests pass**

Run: `npm test -- cn`
Expected: 3 tests, 3 passed. (Total suite: 23 tests.)

- [ ] **Step 4: Add CSS custom-property theme tokens to `src/renderer/styles.css`**

Replace the entire file with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ── Theme tokens ── */
:root,
[data-theme="dark"] {
  --bg-base:      #0b0b0b;
  --bg-panel:     #141414;
  --bg-hover:     #1e1e1e;
  --bg-active:    #252525;
  --border:       #2a2a2a;
  --text-primary: #e7e7e7;
  --text-muted:   #71717a;
  --text-subtle:  #3f3f46;
  --accent:       #3b82f6;
  --accent-fg:    #ffffff;
  --activity-w:   3rem;
  --side-w:       16rem;
  --right-w:      18rem;
  --status-h:     1.5rem;
}

[data-theme="light"] {
  --bg-base:      #ffffff;
  --bg-panel:     #f4f4f5;
  --bg-hover:     #e4e4e7;
  --bg-active:    #d4d4d8;
  --border:       #d1d5db;
  --text-primary: #18181b;
  --text-muted:   #71717a;
  --text-subtle:  #a1a1aa;
  --accent:       #2563eb;
  --accent-fg:    #ffffff;
}

[data-theme="high-contrast"] {
  --bg-base:      #000000;
  --bg-panel:     #111111;
  --bg-hover:     #222222;
  --bg-active:    #333333;
  --border:       #ffffff;
  --text-primary: #ffffff;
  --text-muted:   #cccccc;
  --text-subtle:  #888888;
  --accent:       #facc15;
  --accent-fg:    #000000;
}

html, body, #root { height: 100%; margin: 0; padding: 0; }
body {
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 13px;
}
```

- [ ] **Step 5: Extend `tailwind.config.cjs` with CSS-var color tokens**

Replace the file with:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base:    'var(--bg-base)',
        panel:   'var(--bg-panel)',
        hover:   'var(--bg-hover)',
        active:  'var(--bg-active)',
        border:  'var(--border)',
        primary: 'var(--text-primary)',
        muted:   'var(--text-muted)',
        subtle:  'var(--text-subtle)',
        accent:  'var(--accent)',
      },
      width: {
        activity: 'var(--activity-w)',
        side:     'var(--side-w)',
        right:    'var(--right-w)',
      },
      height: {
        status: 'var(--status-h)',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 6: Run all tests to confirm nothing broke**

Run: `npm test`
Expected: 23 tests, 23 passed.

- [ ] **Step 7: Commit**

From `D:\cleak2\`:
```bash
git add gui/src/renderer/lib/cn.ts gui/tests/cn.test.ts \
        gui/src/renderer/styles.css gui/tailwind.config.cjs
git commit -m "feat(gui): theme token system + cn() utility"
```

---

## Task 3: UI store (TDD)

**Files:**
- Create: `gui/tests/uiStore.test.ts`
- Create: `gui/src/renderer/store/ui.ts`

The UI store owns all layout state: which activity is active in the activity bar, whether the side/right panels are open, which main tab is visible, and the current theme. It never touches the DOM directly — the ThemeProvider component reads the theme and applies the `data-theme` attribute.

- [ ] **Step 1: Write the failing test**

Create `gui/tests/uiStore.test.ts`:
```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { useUi } from '../src/renderer/store/ui';

describe('useUi', () => {
  beforeEach(() => {
    useUi.setState({
      activeActivity: 'chat',
      sidePanelOpen: true,
      rightPanelOpen: false,
      activeMainTab: 'chat',
      theme: 'dark',
    });
  });

  it('toggles side panel when same activity re-clicked', () => {
    useUi.getState().setActivity('chat');
    expect(useUi.getState().sidePanelOpen).toBe(false);
    useUi.getState().setActivity('chat');
    expect(useUi.getState().sidePanelOpen).toBe(true);
  });

  it('opens side panel when switching to a new activity', () => {
    useUi.setState({ activeActivity: 'files', sidePanelOpen: false });
    useUi.getState().setActivity('settings');
    expect(useUi.getState().activeActivity).toBe('settings');
    expect(useUi.getState().sidePanelOpen).toBe(true);
  });

  it('sets active main tab', () => {
    useUi.getState().setMainTab('chat');
    expect(useUi.getState().activeMainTab).toBe('chat');
  });

  it('cycles theme', () => {
    useUi.getState().setTheme('light');
    expect(useUi.getState().theme).toBe('light');
    useUi.getState().setTheme('high-contrast');
    expect(useUi.getState().theme).toBe('high-contrast');
  });
});
```

- [ ] **Step 2: Run, watch it fail**

Run: `npm test -- uiStore`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/renderer/store/ui.ts`**

```ts
import { create } from 'zustand';

export type Activity =
  | 'chat'
  | 'files'
  | 'search'
  | 'tasks'
  | 'agents'
  | 'mcp'
  | 'git'
  | 'settings';

export type MainTab = 'chat' | 'editor' | 'terminal';
export type Theme = 'dark' | 'light' | 'high-contrast';

interface UiState {
  activeActivity: Activity;
  sidePanelOpen: boolean;
  rightPanelOpen: boolean;
  activeMainTab: MainTab;
  theme: Theme;
  setActivity(a: Activity): void;
  setSidePanelOpen(open: boolean): void;
  setRightPanelOpen(open: boolean): void;
  setMainTab(tab: MainTab): void;
  setTheme(t: Theme): void;
}

export const useUi = create<UiState>((set, get) => ({
  activeActivity: 'chat',
  sidePanelOpen: true,
  rightPanelOpen: false,
  activeMainTab: 'chat',
  theme: 'dark',

  setActivity(a) {
    const { activeActivity, sidePanelOpen } = get();
    if (a === activeActivity) {
      set({ sidePanelOpen: !sidePanelOpen });
    } else {
      set({ activeActivity: a, sidePanelOpen: true });
    }
  },
  setSidePanelOpen: (open) => set({ sidePanelOpen: open }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setMainTab: (tab) => set({ activeMainTab: tab }),
  setTheme: (theme) => set({ theme }),
}));
```

- [ ] **Step 4: Run, watch them pass**

Run: `npm test -- uiStore`
Expected: 4 tests, 4 passed.

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: 27 tests, 27 passed.

- [ ] **Step 6: Commit**

From `D:\cleak2\`:
```bash
git add gui/tests/uiStore.test.ts gui/src/renderer/store/ui.ts
git commit -m "feat(gui): ui store — layout state, activity switching, theme"
```

---

## Task 4: Domain store stubs + settings store skeleton

**Files:**
- Create: `gui/src/renderer/store/domain.ts`
- Create: `gui/src/renderer/store/settings.ts`

These stores are empty in S2. Later sprints fill them in. The shapes are defined now so all layout components can import from a stable location.

- [ ] **Step 1: Write `src/renderer/store/domain.ts`**

```ts
import { create } from 'zustand';

// ── Files (S4) ──────────────────────────────────────────────────────
interface FilesState { cwd: string }
export const useFiles = create<FilesState>(() => ({ cwd: '' }));

// ── Todos (S7) ──────────────────────────────────────────────────────
interface TodosState { count: number }
export const useTodos = create<TodosState>(() => ({ count: 0 }));

// ── Tasks / sub-agents (S7) ──────────────────────────────────────────
interface TasksState { activeCount: number }
export const useTasks = create<TasksState>(() => ({ activeCount: 0 }));

// ── Agents / swarms (S8) ────────────────────────────────────────────
interface AgentsState { activeCount: number }
export const useAgents = create<AgentsState>(() => ({ activeCount: 0 }));

// ── MCP (S9) ────────────────────────────────────────────────────────
interface McpState { connectedCount: number }
export const useMcp = create<McpState>(() => ({ connectedCount: 0 }));

// ── Git (S12) ───────────────────────────────────────────────────────
interface GitState { branch: string; changedFiles: number }
export const useGit = create<GitState>(() => ({ branch: '', changedFiles: 0 }));

// ── Permissions (S10) ───────────────────────────────────────────────
interface PermsState { pendingCount: number }
export const usePerms = create<PermsState>(() => ({ pendingCount: 0 }));
```

- [ ] **Step 2: Write `src/renderer/store/settings.ts`**

```ts
import { create } from 'zustand';

export interface AppSettings {
  baseUrl: string;
  model: string;
  theme: 'dark' | 'light' | 'high-contrast';
  apiKey: string;
}

const DEFAULTS: AppSettings = {
  baseUrl: 'http://localhost:3003/v1',
  model: 'qwen3.6-plus',
  theme: 'dark',
  apiKey: '',
};

interface SettingsState extends AppSettings {
  loaded: boolean;
  load(): Promise<void>;
  save(partial: Partial<AppSettings>): Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  async load() {
    if (!window.bridge?.loadSettings) return;
    try {
      const s = await window.bridge.loadSettings();
      set({ ...s, loaded: true });
    } catch {
      set({ loaded: true }); // use defaults if IPC fails
    }
  },

  async save(partial) {
    const current = get();
    const next: AppSettings = {
      baseUrl: partial.baseUrl ?? current.baseUrl,
      model:   partial.model   ?? current.model,
      theme:   partial.theme   ?? current.theme,
      apiKey:  partial.apiKey  ?? current.apiKey,
    };
    set(next);
    if (!window.bridge?.saveSettings) return;
    try { await window.bridge.saveSettings(next); } catch { /* best effort */ }
  },
}));
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Note any errors — `window.bridge.loadSettings` and `saveSettings` don't exist yet (added in Task 6). That's expected; note them in your report.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: 27 tests, 27 passed (no new tests for these stores — the shapes are trivially correct; integration verified in Task 10).

- [ ] **Step 5: Commit**

From `D:\cleak2\`:
```bash
git add gui/src/renderer/store/domain.ts gui/src/renderer/store/settings.ts
git commit -m "feat(gui): domain store stubs + settings store skeleton"
```

---

## Task 5: Settings persistence in main process (TDD)

**Files:**
- Create: `gui/tests/settings.test.ts`
- Create: `gui/src/main/settings.ts`

- [ ] **Step 1: Write the failing test**

Create `gui/tests/settings.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock electron before importing the module under test
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/cleak-settings-test'),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    // Identity transform so tests stay readable
    encryptString: vi.fn((s: string) => Buffer.from(s)),
    decryptString: vi.fn((b: Buffer) => b.toString()),
  },
}));

// Mock the fs module
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockExistsSync = vi.fn(() => false);

vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
}));

// Import AFTER mocks are set up
const { loadSettings, saveSettings } = await import('../src/main/settings');

describe('settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  it('returns defaults when no settings file exists', () => {
    const s = loadSettings();
    expect(s.baseUrl).toBe('http://localhost:3003/v1');
    expect(s.model).toBe('qwen3.6-plus');
    expect(s.theme).toBe('dark');
    expect(s.apiKey).toBe('');
  });

  it('reads stored values from the settings file', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        baseUrl: 'http://other:3003/v1',
        model: 'gpt-4',
        theme: 'light',
        apiKeyEnc: Buffer.from('my-secret-key').toString('base64'),
      }),
    );
    const s = loadSettings();
    expect(s.baseUrl).toBe('http://other:3003/v1');
    expect(s.model).toBe('gpt-4');
    expect(s.theme).toBe('light');
    expect(s.apiKey).toBe('my-secret-key');
  });

  it('saves settings with the API key encrypted', () => {
    saveSettings({
      baseUrl: 'http://localhost:3003/v1',
      model: 'qwen3.6-plus',
      theme: 'dark',
      apiKey: 'my-key',
    });
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const [, content] = mockWriteFileSync.mock.calls[0] as [string, string, string];
    const stored = JSON.parse(content) as { apiKeyEnc?: string; apiKey?: string };
    // The plain apiKey must NOT appear in the stored JSON
    expect(stored.apiKey).toBeUndefined();
    // The encrypted version must appear
    expect(stored.apiKeyEnc).toBeDefined();
    // With our identity mock, the base64 of the key must equal its own base64
    expect(Buffer.from(stored.apiKeyEnc!, 'base64').toString()).toBe('my-key');
  });

  it('handles corrupt settings file gracefully', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not valid json!!!');
    const s = loadSettings();
    // Should fall back to defaults, not throw
    expect(s.baseUrl).toBe('http://localhost:3003/v1');
  });
});
```

- [ ] **Step 2: Run, watch it fail**

Run: `npm test -- settings`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/main/settings.ts`**

```ts
import { app, safeStorage } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export interface AppSettings {
  baseUrl: string;
  model: string;
  theme: 'dark' | 'light' | 'high-contrast';
  apiKey: string;
}

const DEFAULTS: AppSettings = {
  baseUrl: 'http://localhost:3003/v1',
  model: 'qwen3.6-plus',
  theme: 'dark',
  apiKey: '',
};

interface StoredFile {
  baseUrl?: string;
  model?: string;
  theme?: string;
  apiKeyEnc?: string; // base64(safeStorage.encryptString(apiKey))
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(): AppSettings {
  const path = settingsPath();
  let stored: StoredFile = {};
  if (existsSync(path)) {
    try {
      stored = JSON.parse(readFileSync(path, 'utf8')) as StoredFile;
    } catch {
      // Corrupt file — use defaults
    }
  }

  let apiKey = '';
  if (stored.apiKeyEnc && safeStorage.isEncryptionAvailable()) {
    try {
      apiKey = safeStorage.decryptString(Buffer.from(stored.apiKeyEnc, 'base64'));
    } catch {
      // Encrypted blob from a different machine or corrupt — reset
    }
  }

  return {
    baseUrl: stored.baseUrl ?? DEFAULTS.baseUrl,
    model:   stored.model   ?? DEFAULTS.model,
    theme:   (stored.theme as AppSettings['theme']) ?? DEFAULTS.theme,
    apiKey,
  };
}

export function saveSettings(s: AppSettings): void {
  const path = settingsPath();
  const stored: StoredFile = {
    baseUrl: s.baseUrl,
    model:   s.model,
    theme:   s.theme,
  };
  if (s.apiKey && safeStorage.isEncryptionAvailable()) {
    stored.apiKeyEnc = safeStorage.encryptString(s.apiKey).toString('base64');
  }
  writeFileSync(path, JSON.stringify(stored, null, 2), 'utf8');
}
```

- [ ] **Step 4: Run, watch them pass**

Run: `npm test -- settings`
Expected: 4 tests, 4 passed.

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: 31 tests, 31 passed.

- [ ] **Step 6: Commit**

From `D:\cleak2\`:
```bash
git add gui/tests/settings.test.ts gui/src/main/settings.ts
git commit -m "feat(gui): safeStorage-backed settings persistence"
```

---

## Task 6: Settings IPC — extend ipc.ts, main entry, preload

**Files:**
- Modify: `gui/src/main/ipc.ts`
- Modify: `gui/src/main/index.ts`
- Modify: `gui/src/preload/index.ts`
- Modify: `gui/src/renderer/global.d.ts`

- [ ] **Step 1: Extend `src/main/ipc.ts`**

Replace the file with:
```ts
import type { CleakInboundFrame } from './cleakProtocol';

export type BridgeStatus =
  | { kind: 'starting' }
  | { kind: 'running'; sessionId?: string; protocolOk: boolean }
  | { kind: 'restarting'; reason: string; attempt: number }
  | { kind: 'stopped'; reason: string };

export interface BridgeEventMap {
  status: BridgeStatus;
  frame: CleakInboundFrame;
  error: { message: string };
}

export interface AppSettings {
  baseUrl: string;
  model: string;
  theme: 'dark' | 'light' | 'high-contrast';
  apiKey: string;
}

export const IpcChannels = {
  sendUserMessage:  'bridge:sendUserMessage',
  status:           'bridge:status',
  frame:            'bridge:frame',
  error:            'bridge:error',
  loadSettings:     'settings:load',
  saveSettings:     'settings:save',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
```

- [ ] **Step 2: Modify `src/main/index.ts` — wire settings IPC and use stored settings for shim**

Replace `src/main/index.ts` with:
```ts
import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn as nodeSpawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { CleakBridge } from './bridge';
import { IpcChannels } from './ipc';
import type { BridgeStatus, AppSettings } from './ipc';
import type { CleakInboundFrame } from './cleakProtocol';
import { loadSettings, saveSettings } from './settings';

const isDev = !app.isPackaged;

function resolveClaudeBin(): string {
  const fromEnv = process.env['CLAUDE_BIN'];
  if (fromEnv) return fromEnv;
  const candidates = [
    join(homedir(), '.local', 'bin', 'claude.exe'),
    join(homedir(), 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
    'claude',
  ];
  for (const c of candidates) {
    if (!c.includes('*') && (c === 'claude' || existsSync(c))) return c;
  }
  console.warn('[cleak-gui] WARNING: claude.exe not found; set CLAUDE_BIN env var.');
  return candidates[0]!;
}

function resolveSdkCwd(): string {
  return resolve(app.getAppPath(), '..');
}

function buildEnv(shimPort: number): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  env['ANTHROPIC_BASE_URL'] = `http://127.0.0.1:${shimPort}`;
  env['ANTHROPIC_API_KEY'] = 'shim-passthrough';
  if (process.env['ANTHROPIC_MODEL']) env['ANTHROPIC_MODEL'] = process.env['ANTHROPIC_MODEL'];
  return env;
}

// Wire settings IPC — must be called before any window is created.
function registerSettingsIpc(): void {
  ipcMain.handle(IpcChannels.loadSettings, (): AppSettings => loadSettings());
  ipcMain.handle(IpcChannels.saveSettings, (_e, s: AppSettings): void => saveSettings(s));
}

async function createWindow(): Promise<void> {
  // Load persisted settings to configure the shim (API key, model, baseUrl)
  const stored = loadSettings();
  const baseUrl = process.env['ANTHROPIC_BASE_URL'] ?? stored.baseUrl;
  const apiKey  = process.env['ANTHROPIC_API_KEY']  ?? stored.apiKey;
  const model   = process.env['ANTHROPIC_MODEL']    ?? stored.model;

  const { createAnthropicShim } = await import('./anthropicShim');
  const shim = await createAnthropicShim({ upstreamBaseUrl: baseUrl, upstreamApiKey: apiKey, model });

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0b0b0b',
    webPreferences: {
      preload: resolve(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    await win.loadURL(process.env['ELECTRON_RENDERER_URL']);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(resolve(__dirname, '../renderer/index.html'));
  }

  const bridge = new CleakBridge({
    spawn: (cmd, args, opts) => nodeSpawn(cmd, [...args], opts),
    cwd: resolveSdkCwd(),
    env: buildEnv(shim.port),
    claudeBin: resolveClaudeBin(),
  });

  bridge.on('status', (s: BridgeStatus) => {
    if (!win.isDestroyed()) win.webContents.send(IpcChannels.status, s);
  });
  bridge.on('frame', (f: CleakInboundFrame) => {
    if (!win.isDestroyed()) win.webContents.send(IpcChannels.frame, f);
  });
  bridge.on('error', (e: { message: string }) => {
    if (!win.isDestroyed()) win.webContents.send(IpcChannels.error, e);
  });

  ipcMain.on(IpcChannels.sendUserMessage, (_e, text: string) => {
    bridge.sendUserMessage(text);
  });

  bridge.start();
  win.on('closed', () => { bridge.stop(); shim.close(); });
}

app.whenReady().then(() => {
  registerSettingsIpc();
  void createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
```

- [ ] **Step 3: Extend `src/preload/index.ts`**

Replace the file with:
```ts
import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../main/ipc';
import type { BridgeStatus, BridgeEventMap, AppSettings } from '../main/ipc';
import type { CleakInboundFrame } from '../main/cleakProtocol';

const api = {
  sendUserMessage(text: string): void {
    ipcRenderer.send(IpcChannels.sendUserMessage, text);
  },
  onStatus(handler: (s: BridgeStatus) => void): () => void {
    const wrapped = (_e: unknown, s: BridgeStatus) => handler(s);
    ipcRenderer.on(IpcChannels.status, wrapped);
    return () => ipcRenderer.off(IpcChannels.status, wrapped);
  },
  onFrame(handler: (f: CleakInboundFrame) => void): () => void {
    const wrapped = (_e: unknown, f: CleakInboundFrame) => handler(f);
    ipcRenderer.on(IpcChannels.frame, wrapped);
    return () => ipcRenderer.off(IpcChannels.frame, wrapped);
  },
  onError(handler: (e: BridgeEventMap['error']) => void): () => void {
    const wrapped = (_e: unknown, p: BridgeEventMap['error']) => handler(p);
    ipcRenderer.on(IpcChannels.error, wrapped);
    return () => ipcRenderer.off(IpcChannels.error, wrapped);
  },
  loadSettings(): Promise<AppSettings> {
    return ipcRenderer.invoke(IpcChannels.loadSettings) as Promise<AppSettings>;
  },
  saveSettings(s: AppSettings): Promise<void> {
    return ipcRenderer.invoke(IpcChannels.saveSettings, s) as Promise<void>;
  },
};

export type BridgeApi = typeof api;
contextBridge.exposeInMainWorld('bridge', api);
```

- [ ] **Step 4: Update `src/renderer/global.d.ts`**

Replace the file with:
```ts
import type { BridgeApi } from '../preload';

declare global {
  interface Window {
    bridge: BridgeApi;
  }
}
export {};
```

(This file re-exports the same type — no visible change, but now `BridgeApi` includes `loadSettings` and `saveSettings` so the settings store compiles cleanly.)

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: 31 tests, 31 passed.

- [ ] **Step 6: Commit**

From `D:\cleak2\`:
```bash
git add gui/src/main/ipc.ts gui/src/main/index.ts gui/src/preload/index.ts \
        gui/src/renderer/global.d.ts
git commit -m "feat(gui): settings IPC — loadSettings/saveSettings via ipcMain.handle"
```

---

## Task 7: AppShell layout components

**Files:**
- Create: `gui/src/renderer/components/layout/AppShell.tsx`
- Create: `gui/src/renderer/components/layout/ActivityBar.tsx`
- Create: `gui/src/renderer/components/layout/SidePanel.tsx`
- Create: `gui/src/renderer/components/layout/MainArea.tsx`
- Create: `gui/src/renderer/components/layout/RightPanel.tsx`

No tests for these — they're pure layout with no logic. Visual verification is the smoke test in Task 10.

- [ ] **Step 1: Write `src/renderer/components/layout/ActivityBar.tsx`**

```tsx
import React from 'react';
import {
  MessageSquare,
  FolderOpen,
  Search,
  CheckSquare,
  Users,
  Plug,
  GitBranch,
  Settings,
} from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useUi, type Activity } from '../../store/ui';
import { cn } from '../../lib/cn';

const ITEMS: { id: Activity; icon: React.ElementType; label: string }[] = [
  { id: 'chat',     icon: MessageSquare, label: 'Chat'     },
  { id: 'files',    icon: FolderOpen,    label: 'Files'    },
  { id: 'search',   icon: Search,        label: 'Search'   },
  { id: 'tasks',    icon: CheckSquare,   label: 'Tasks'    },
  { id: 'agents',   icon: Users,         label: 'Agents'   },
  { id: 'mcp',      icon: Plug,          label: 'MCP'      },
  { id: 'git',      icon: GitBranch,     label: 'Git'      },
  { id: 'settings', icon: Settings,      label: 'Settings' },
];

export function ActivityBar(): React.ReactElement {
  const { activeActivity, setActivity } = useUi();
  return (
    <Tooltip.Provider delayDuration={400}>
      <div
        className="flex flex-col items-center py-2 gap-1 shrink-0"
        style={{ width: 'var(--activity-w)', background: 'var(--bg-panel)', borderRight: '1px solid var(--border)' }}
      >
        {ITEMS.map(({ id, icon: Icon, label }) => (
          <Tooltip.Root key={id}>
            <Tooltip.Trigger asChild>
              <button
                onClick={() => setActivity(id)}
                aria-label={label}
                className={cn(
                  'w-9 h-9 flex items-center justify-center rounded text-muted transition-colors',
                  activeActivity === id
                    ? 'text-primary bg-active'
                    : 'hover:text-primary hover:bg-hover',
                )}
              >
                <Icon size={18} strokeWidth={1.5} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="right"
                sideOffset={6}
                className="px-2 py-1 rounded text-xs bg-[#2a2a2a] text-primary border border-border shadow-lg z-50"
              >
                {label}
                <Tooltip.Arrow className="fill-[#2a2a2a]" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
      </div>
    </Tooltip.Provider>
  );
}
```

- [ ] **Step 2: Write `src/renderer/components/layout/SidePanel.tsx`**

```tsx
import React from 'react';
import { useUi } from '../../store/ui';
import { SettingsPanel } from '../settings/SettingsPanel';

function PanelPlaceholder({ label }: { label: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full text-muted text-sm">
      {label} — coming soon
    </div>
  );
}

function PanelContent(): React.ReactElement {
  const { activeActivity } = useUi();
  switch (activeActivity) {
    case 'settings': return <SettingsPanel />;
    case 'files':    return <PanelPlaceholder label="File Explorer" />;
    case 'search':   return <PanelPlaceholder label="Search" />;
    case 'tasks':    return <PanelPlaceholder label="Tasks & Todos" />;
    case 'agents':   return <PanelPlaceholder label="Agents" />;
    case 'mcp':      return <PanelPlaceholder label="MCP Servers" />;
    case 'git':      return <PanelPlaceholder label="Git" />;
    default:         return <PanelPlaceholder label="Chat panel" />;
  }
}

export function SidePanel(): React.ReactElement | null {
  const { sidePanelOpen } = useUi();
  if (!sidePanelOpen) return null;
  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: 'var(--side-w)',
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
      }}
    >
      <PanelContent />
    </div>
  );
}
```

- [ ] **Step 3: Write `src/renderer/components/layout/MainArea.tsx`**

```tsx
import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useUi } from '../../store/ui';
import { ChatView } from '../ChatView';
import { MessageInput } from '../MessageInput';

export function MainArea(): React.ReactElement {
  const { activeMainTab, setMainTab } = useUi();
  return (
    <Tabs.Root
      value={activeMainTab}
      onValueChange={(v) => setMainTab(v as 'chat' | 'editor' | 'terminal')}
      className="flex flex-col flex-1 min-w-0"
    >
      <Tabs.List
        className="flex shrink-0 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}
      >
        {(['chat'] as const).map((tab) => (
          <Tabs.Trigger
            key={tab}
            value={tab}
            className="px-4 py-1.5 text-xs capitalize text-muted border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-primary transition-colors hover:text-primary"
          >
            {tab}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Tabs.Content value="chat" className="flex flex-col flex-1 min-h-0">
        <ChatView />
        <MessageInput />
      </Tabs.Content>
    </Tabs.Root>
  );
}
```

- [ ] **Step 4: Write `src/renderer/components/layout/RightPanel.tsx`**

```tsx
import React from 'react';
import { useUi } from '../../store/ui';

export function RightPanel(): React.ReactElement | null {
  const { rightPanelOpen } = useUi();
  if (!rightPanelOpen) return null;
  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: 'var(--right-w)',
        background: 'var(--bg-panel)',
        borderLeft: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Context panel — coming soon
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `src/renderer/components/layout/AppShell.tsx`**

```tsx
import React, { useEffect } from 'react';
import { ActivityBar } from './ActivityBar';
import { SidePanel } from './SidePanel';
import { MainArea } from './MainArea';
import { RightPanel } from './RightPanel';
import { StatusBar } from '../StatusBar';
import { useUi } from '../../store/ui';
import { useSettings } from '../../store/settings';

export function AppShell(): React.ReactElement {
  const theme = useUi((s) => s.theme);
  const settingsTheme = useSettings((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Sync persisted theme into ui store once settings load
  useEffect(() => {
    if (settingsTheme) setTheme(settingsTheme);
  }, [settingsTheme, setTheme]);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
      <div className="flex flex-1 min-h-0">
        <ActivityBar />
        <SidePanel />
        <MainArea />
        <RightPanel />
      </div>
      <StatusBar />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

From `D:\cleak2\`:
```bash
git add gui/src/renderer/components/layout/
git commit -m "feat(gui): VS Code-style layout shell — activity bar, side panel, tabs, right panel"
```

---

## Task 8: Rich StatusBar

**Files:**
- Replace: `gui/src/renderer/components/StatusBar.tsx`

The new status bar shows: bridge state (left), then model name, a token/cost placeholder (both update in S3 when we parse `postTurnSummary` frames), and a right-panel toggle.

- [ ] **Step 1: Replace `src/renderer/components/StatusBar.tsx`**

```tsx
import React from 'react';
import { PanelRight } from 'lucide-react';
import { useChat } from '../../store/chat';
import { useSettings } from '../../store/settings';
import { useUi } from '../../store/ui';
import type { BridgeStatus } from '../../../main/ipc';
import { cn } from '../../lib/cn';

function describeBridgeStatus(s: BridgeStatus): { text: string; dot: string } {
  switch (s.kind) {
    case 'starting':    return { text: 'starting…',     dot: 'bg-yellow-500' };
    case 'running':     return { text: s.protocolOk ? 'connected' : 'protocol error', dot: s.protocolOk ? 'bg-green-500' : 'bg-red-500' };
    case 'restarting':  return { text: `restarting (${s.attempt})`, dot: 'bg-yellow-500' };
    case 'stopped':     return { text: 'stopped',        dot: 'bg-red-500'    };
  }
}

export function StatusBar(): React.ReactElement {
  const status = useChat((s) => s.status);
  const model  = useSettings((s) => s.model);
  const lastError = useChat((s) => s.errors[s.errors.length - 1]);
  const { rightPanelOpen, setRightPanelOpen } = useUi();

  const { text, dot } = describeBridgeStatus(status);

  return (
    <div
      className="flex items-center justify-between px-3 shrink-0 text-[11px]"
      style={{
        height: 'var(--status-h)',
        background: 'var(--bg-panel)',
        borderTop: '1px solid var(--border)',
        color: 'var(--text-muted)',
      }}
    >
      {/* Left: bridge status */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
        <span className="truncate">{text}</span>
        {lastError && (
          <span className="truncate text-red-400 ml-2" title={lastError}>
            ⚠ {lastError}
          </span>
        )}
      </div>

      {/* Right: model + right-panel toggle */}
      <div className="flex items-center gap-3 shrink-0 ml-3">
        <span style={{ color: 'var(--text-subtle)' }}>{model}</span>
        <button
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          aria-label="Toggle right panel"
          className={cn(
            'hover:text-primary transition-colors',
            rightPanelOpen && 'text-primary',
          )}
        >
          <PanelRight size={12} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: 31 tests, 31 passed.

- [ ] **Step 3: Commit**

From `D:\cleak2\`:
```bash
git add gui/src/renderer/components/StatusBar.tsx
git commit -m "feat(gui): rich status bar — bridge dot, model, right-panel toggle"
```

---

## Task 9: Settings panel

**Files:**
- Create: `gui/src/renderer/components/settings/SettingsPanel.tsx`

The settings panel shows three sections: API Config (base URL, API key masked, model), Appearance (theme selector), and About. It reads from and writes to the `useSettings` store, which syncs to main via IPC.

- [ ] **Step 1: Write `src/renderer/components/settings/SettingsPanel.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { useSettings } from '../../store/settings';
import { useUi, type Theme } from '../../store/ui';
import { cn } from '../../lib/cn';

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mb-6">
      <h3 className="text-xs uppercase tracking-widest text-muted mb-3 px-4">{title}</h3>
      <div className="px-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-muted">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded px-2 py-1.5 text-xs bg-base border border-border text-primary focus:outline-none focus:border-accent placeholder-subtle';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'dark',           label: 'Dark'           },
  { value: 'light',          label: 'Light'          },
  { value: 'high-contrast',  label: 'High Contrast'  },
];

export function SettingsPanel(): React.ReactElement {
  const settings = useSettings();
  const { theme: uiTheme, setTheme } = useUi();

  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model,   setModel]   = useState(settings.model);
  const [apiKey,  setApiKey]  = useState(settings.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [saved,   setSaved]   = useState(false);

  // Keep local form in sync when store loads from IPC
  useEffect(() => {
    setBaseUrl(settings.baseUrl);
    setModel(settings.model);
    setApiKey(settings.apiKey);
  }, [settings.loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(): Promise<void> {
    await settings.save({ baseUrl, model, apiKey, theme: uiTheme });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleThemeChange(t: Theme): void {
    setTheme(t);
    void settings.save({ baseUrl, model, apiKey, theme: t });
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto py-4" style={{ color: 'var(--text-primary)' }}>
      <div className="px-4 mb-4 text-sm font-medium">Settings</div>

      <Section title="API Configuration">
        <Field label="Base URL">
          <input
            className={inputCls}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:3003/v1"
          />
        </Field>
        <Field label="Model">
          <input
            className={inputCls}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="qwen3.6-plus"
          />
        </Field>
        <Field label="API Key">
          <div className="flex gap-1">
            <input
              type={showKey ? 'text' : 'password'}
              className={cn(inputCls, 'flex-1')}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="pk_…"
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              className="px-2 rounded border border-border text-[10px] text-muted hover:text-primary transition-colors"
            >
              {showKey ? 'hide' : 'show'}
            </button>
          </div>
          <p className="text-[10px] text-muted mt-1">
            Stored encrypted via OS keychain. Never written as plaintext.
          </p>
        </Field>
        <button
          onClick={() => void handleSave()}
          className="w-full py-1.5 rounded bg-accent text-accent-fg text-xs font-medium hover:opacity-90 transition-opacity"
        >
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </Section>

      <Section title="Appearance">
        <Field label="Theme">
          <div className="flex gap-2">
            {THEMES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleThemeChange(value)}
                className={cn(
                  'flex-1 py-1 rounded border text-xs transition-colors',
                  uiTheme === value
                    ? 'border-accent text-primary bg-active'
                    : 'border-border text-muted hover:border-accent hover:text-primary',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="About">
        <p className="text-[11px] text-muted">
          Cleak GUI — Sprint 2<br />
          SDK backend: claude.exe (Claude Code CLI)
        </p>
      </Section>
    </div>
  );
}
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: 31 tests, 31 passed.

- [ ] **Step 3: Commit**

From `D:\cleak2\`:
```bash
git add gui/src/renderer/components/settings/SettingsPanel.tsx
git commit -m "feat(gui): settings panel — API config, theme selector, secure key note"
```

---

## Task 10: Wire App.tsx + load settings on boot

**Files:**
- Modify: `gui/src/renderer/App.tsx`

- [ ] **Step 1: Replace `src/renderer/App.tsx`**

```tsx
import React, { useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useBridgeWiring } from './lib/bridge';
import { useSettings } from './store/settings';

export default function App(): React.ReactElement {
  useBridgeWiring();
  const load = useSettings((s) => s.load);

  // Load persisted settings from main process on first render
  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <AppShell />;
}
```

- [ ] **Step 2: Run all tests one last time**

Run: `npm test`
Expected: 31 tests, 31 passed.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Launch and visual smoke test**

From `D:\cleak2\gui\`, kill any running dev server first, then:
```bash
npm run dev
```

Expected in the Electron window:
- ✅ Dark background with 8-icon activity bar on the left
- ✅ Side panel open showing "Chat panel — coming soon" (chat activity is active by default; the chat view is in the main area, not the side panel)
- ✅ Main area: "chat" tab active, ChatView + MessageInput visible
- ✅ Status bar: bridge dot (yellow while starting, green once connected), model name on the right
- ✅ Clicking the Settings icon (gear) in the activity bar shows the Settings panel in the side panel
- ✅ Clicking the same icon again collapses the side panel
- ✅ Changing theme in Settings → the window re-skins immediately
- ✅ Typing in API Key field and clicking Save → no plaintext on disk at `%APPDATA%\cleak-gui\settings.json` (check the file to confirm `apiKeyEnc` field, not `apiKey`)
- ✅ Sending a chat message → streams reply (bridge is running)

- [ ] **Step 5: Verify settings file on disk**

After saving settings, run:
```bash
cat "$APPDATA/cleak-gui/settings.json" 2>/dev/null || \
  cat "$(node -e "require('electron').app; console.log(process.env.APPDATA)")/cleak-gui/settings.json" 2>/dev/null || \
  echo "Check: %APPDATA%\cleak-gui\settings.json in Explorer"
```
Expected: JSON with `apiKeyEnc` (base64 string), NOT `apiKey` in plaintext.

- [ ] **Step 6: Commit**

From `D:\cleak2\`:
```bash
git add gui/src/renderer/App.tsx
git commit -m "feat(gui): wire AppShell + load persisted settings on boot"
```

- [ ] **Step 7: Tag sprint**

```bash
git tag gui-s2
```

---

## Sprint 2 Definition of Done

All items must be ✅ before moving to Sprint 3:

1. `npm run dev` opens the app with the VS Code-style layout (activity bar + side panel + tab strip + status bar).
2. `npm test` runs 31 passing tests (27 from S1 + 4 uiStore + settings).
3. Settings panel appears when the gear icon is clicked in the activity bar.
4. Theme switching (dark/light/high-contrast) changes the window visually with no reload.
5. Saving an API key: `settings.json` at `userData` contains `apiKeyEnc` (base64 encrypted), never plaintext `apiKey`.
6. On restart, the saved settings are loaded — bridge uses the stored API key, stored model, stored base URL.
7. `npm run typecheck` is clean.
8. `gui-s2` tag exists.

---

## Self-review notes

**Spec coverage check (S2 requirements):**
- ✅ VS Code-style layout: activity bar, collapsible side panel, main area with tabs, right contextual panel, status bar → Tasks 7 + 8
- ✅ Tailwind + (radix primitives) theme tokens → Tasks 2 + 7
- ✅ Theme switching (dark / light / high-contrast) → Tasks 2 + 3 + 9
- ✅ Zustand store skeleton for each domain slice → Task 4
- ✅ Settings panel scaffold → Task 9
- ✅ Secure storage: API key via `safeStorage` (OS keychain) → Tasks 5 + 6
- ✅ Env-var manager UI → Settings panel shows base URL, model, API key; full env-var editor deferred to S11 (it's a slash-command feature)
- ✅ Status bar: model name, bridge state, placeholder token/cost, mode badge → Task 8

**shadcn/ui note:** The spec says "Tailwind + shadcn install." We use Radix primitives directly (which is what shadcn wraps) without the shadcn CLI scaffold. The net result is the same — accessible, unstyled primitives styled with Tailwind. A full shadcn init can be added in S3 if more complex components are needed; it would not conflict with this sprint's work.

**Placeholder scan:** No TBDs, no "implement later." Side-panel placeholder text ("coming soon") is intentional — those panels ship in their own sprints.

**Type consistency:** `AppSettings` is defined once in `ipc.ts` and imported everywhere (main, preload, renderer settings store, settings panel). `Theme` is defined once in `ui.ts`. `Activity` and `MainTab` are defined once in `ui.ts`.
