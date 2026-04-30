import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn as nodeSpawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import chokidar from 'chokidar';
import { CleakBridge } from './bridge';
import { IpcChannels, FileIpcChannels, SearchIpcChannels } from './ipc';
import type { BridgeStatus, AppSettings } from './ipc';
import type { CleakInboundFrame } from './cleakProtocol';
import { registerPtyIpc, killAllPtys } from './ptyManager';
import { loadSettings, saveSettings } from './settings';
import { getFileTree } from './fileTree';
import { runGrep, runGlob } from './grepEngine';
import * as fs from 'fs';
import { loadSessions, saveSessions, type PersistedSession } from './sessionsStore';
import { SessionIpcChannels } from './ipc';
import { saveSessionMessages, loadSessionMessages } from './sessionMessages';
import { registerActiveSession, unregisterActiveSession, loadActiveSessions } from './activeSessions';
import { recordSessionHistory } from './historyIndex';
import { loadSessionMemory, saveSession, writeHandoffNote } from './rememberManager';

const isDev = !app.isPackaged;

/** One managed bridge instance — our UUID is the stable session key. */
interface ManagedBridge {
  bridge: CleakBridge;
  /** Our stable UUID for this session (used in all renderer frames). */
  sessionId: string;
  /** Claude's actual session_id (captured from status when bridge connects). */
  claudeSessionId?: string;
  /** Handler references for cleanup — stored so we can call .off(). */
  handlers: {
    status: ((s: BridgeStatus) => void) | null;
    frame: ((f: CleakInboundFrame) => void) | null;
    error: ((e: { message: string }) => void) | null;
  };
  /** Message counter for this session — tracks how many messages have been persisted. */
  messageCount: number;
}

function resolveClaudeBin(): string {
  const fromEnv = process.env['CLAUDE_BIN'];
  if (fromEnv) { console.log('[cleak-gui] claude bin from CLAUDE_BIN:', fromEnv); return fromEnv; }
  const candidates = [
    join(homedir(), 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
    join(homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
    join(homedir(), '.local', 'bin', 'claude'),
    join(homedir(), '.local', 'bin', 'claude.exe'),
    'claude',
  ];
  for (const c of candidates) {
    if (c === 'claude' || existsSync(c)) {
      console.log('[cleak-gui] claude bin resolved to:', c);
      return c;
    }
  }
  console.warn('[cleak-gui] WARNING: claude not found; set CLAUDE_BIN env var to the full path.');
  return 'claude';
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

function registerSettingsIpc(): void {
  ipcMain.handle(IpcChannels.loadSettings, (): AppSettings => loadSettings());
  ipcMain.handle(IpcChannels.saveSettings, (_e, s: AppSettings): void => {
    try { saveSettings(s); } catch (err) { console.error('[cleak-gui] Failed to save settings:', err); throw err; }
  });
}

async function createWindow(): Promise<void> {
  const stored = loadSettings();
  const baseUrl = process.env['ANTHROPIC_BASE_URL'] ?? stored.baseUrl;
  const apiKey  = process.env['ANTHROPIC_API_KEY']  ?? stored.apiKey;
  const model   = process.env['ANTHROPIC_MODEL']    ?? stored.model;

  const { createAnthropicShim } = await import('./anthropicShim');
  const shim = await createAnthropicShim({ upstreamBaseUrl: baseUrl, upstreamApiKey: apiKey, model });

  const win = new BrowserWindow({
    width: 1280, height: 800, backgroundColor: '#0b0b0b',
    webPreferences: {
      preload: resolve(__dirname, '../preload/index.js'),
      contextIsolation: true, sandbox: false, nodeIntegration: false,
    },
  });

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev
      ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://cdn.jsdelivr.net; font-src 'self' data: blob:; worker-src 'self' blob:;"
      : "default-src 'self'; script-src 'self'";
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } });
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    await win.loadURL(process.env['ELECTRON_RENDERER_URL']);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(resolve(__dirname, '../renderer/index.html'));
  }

  // ── Multi-bridge management (one Claude process per session) ──
  const claudeBin = resolveClaudeBin();
  const bridgeOpts = {
    spawn: (cmd: string, args: readonly string[], opts: any) => nodeSpawn(cmd, [...args], { ...opts, shell: true }),
    cwd: resolveSdkCwd(),
    env: buildEnv(shim.port),
    claudeBin,
  };

  const managedBridges = new Map<string, ManagedBridge>();
  let activeManaged: ManagedBridge | null = null;

  /**
   * Persist a single frame to JSONL.
   * This is called for EVERY frame from EVERY bridge — JSONL is the source of truth.
   * Only assistant frames with message content create entries.
   */
  function persistFrameToJsonl(managed: ManagedBridge, frame: CleakInboundFrame): void {
    const msg = (frame as any).message;
    if (!msg || !Array.isArray(msg.content) || msg.content.length === 0) return;

    // Load existing entries to check for duplicates
    const existing = loadSessionMessages(managed.sessionId);
    const existingUuids = new Set(existing.map((m: any) => m.id));

    // Extract the uuid from the frame (Claude sends it in the frame)
    const frameUuid = (frame as any).uuid || crypto.randomUUID();
    if (existingUuids.has(frameUuid)) return; // already persisted

    const entry = {
      id: frameUuid,
      role: 'assistant' as const,
      blocks: msg.content,
      pending: false,
      ts: Date.now(),
      sessionId: managed.sessionId,
      parentUuid: existing.length > 0 ? existing[existing.length - 1]?.parentUuid || existing[existing.length - 1]?.id : null,
    };

    // Find the last user message for parentUuid
    for (let i = existing.length - 1; i >= 0; i--) {
      const msg = existing[i];
      if (msg && msg.role === 'user') {
        entry.parentUuid = msg.id;
        break;
      }
    }

    const messages = [...existing, entry];
    saveSessionMessages(managed.sessionId, messages);
    managed.messageCount = messages.length;
  }

  /** Wire a bridge's event listeners. ALL bridges stay wired permanently. */
  function wireBridge(managed: ManagedBridge): void {
    managed.handlers.status = (s: BridgeStatus) => {
      if (s.kind === 'running' && s.sessionId) {
        managed.claudeSessionId = s.sessionId;
        registerActiveSession(s.sessionId, resolveSdkCwd());
      }
      if (s.kind === 'stopped') unregisterActiveSession();
      // Forward status to renderer ONLY for the active bridge
      if (activeManaged === managed && !win.isDestroyed()) {
        win.webContents.send(IpcChannels.status, { ...s, sessionId: managed.sessionId });
      }
    };

    managed.handlers.frame = (f: CleakInboundFrame) => {
      // ALWAYS persist to JSONL — source of truth
      persistFrameToJsonl(managed, f);

      // Also save to remember system (debounced — saves on result frames only)
      if (f.type === 'result') {
        const messages = loadSessionMessages(managed.sessionId);
        saveSession(managed.sessionId, messages);
      }

      // Forward to renderer ONLY for the active bridge
      if (activeManaged === managed && !win.isDestroyed()) {
        if (f.type === 'result') {
          console.log('[ipc] result frame, result:', (f as any).result);
        }
        win.webContents.send(IpcChannels.frame, { ...f, session_id: managed.sessionId });
      }
    };

    managed.handlers.error = (e: { message: string }) => {
      if (activeManaged === managed && !win.isDestroyed()) {
        win.webContents.send(IpcChannels.error, e);
      }
    };

    managed.bridge.on('status', managed.handlers.status);
    managed.bridge.on('frame', managed.handlers.frame);
    managed.bridge.on('error', managed.handlers.error);
  }

  /**
   * Build a compacted context summary from the session's JSONL history
   * plus the remember system's persisted memory files.
   * Fresh process = clean context window, but with enough context to continue.
   */
  function buildContextPriming(sessionId: string): string | undefined {
    const entries = loadSessionMessages(sessionId);
    const rememberMemory = loadSessionMemory();

    const parts: string[] = [];

    // Remember context (from cross-session memory)
    if (rememberMemory) {
      parts.push(rememberMemory);
    }

    // Recent exchanges from this session's JSONL (last 5 pairs = 10 messages max)
    if (entries.length > 0) {
      const recent = entries.slice(-10);
      const lines: string[] = ['[Session context — condensed from previous exchanges]'];

      for (const msg of recent) {
        const textBlocks = (msg.blocks || [])
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('\n');
        if (!textBlocks) continue;

        const prefix = msg.role === 'user' ? 'User' : 'Assistant';
        // Truncate long blocks to keep context small
        const truncated = textBlocks.length > 2000 ? textBlocks.slice(0, 2000) + '...(truncated)' : textBlocks;
        lines.push(`${prefix}: ${truncated}`);
      }

      lines.push('[End of context. Continue from here.]');
      parts.push(lines.join('\n\n'));
    }

    return parts.length > 0 ? parts.join('\n\n') : undefined;
  }

  /** Make a bridge the active one — trigger renderer to reload from JSONL. */
  function setActiveBridge(managed: ManagedBridge): void {
    activeManaged = managed;

    // Tell renderer to reload messages from JSONL for this session
    if (!win.isDestroyed()) {
      win.webContents.send(IpcChannels.status, {
        kind: 'running',
        sessionId: managed.sessionId,
        protocolOk: true,
        reloadMessages: true, // signal to reload from disk
      });
    }
  }

  /** Create a new managed bridge with a given session ID and make it active. */
  function spawnManagedBridge(sessionId: string): ManagedBridge {
    // Persist the session entry immediately so it appears in the list
    // even before the renderer has processed any frames from this session.
    const sessions = loadSessions();
    if (!sessions.some(s => s.id === sessionId)) {
      sessions.push({
        id: sessionId, name: `Session ${sessions.length + 1}`,
        createdAt: Date.now(), lastActive: Date.now(),
        messageCount: 0, tokenCount: 0, cost: 0, pinned: false,
      });
      saveSessions(sessions);
    }

    const contextPriming = buildContextPriming(sessionId);
    const bridge = new CleakBridge({ ...bridgeOpts, contextPriming });
    const managed: ManagedBridge = {
      bridge, sessionId, claudeSessionId: undefined,
      messageCount: 0,
      handlers: { status: null, frame: null, error: null },
    };
    managedBridges.set(sessionId, managed);
    wireBridge(managed);
    setActiveBridge(managed);
    bridge.start();
    return managed;
  }

  // Create initial bridge for app startup
  const initialSessionId = crypto.randomUUID();
  spawnManagedBridge(initialSessionId);

  // ── Wire pty IPC ──
  registerPtyIpc(win);

  // ── IPC: send user message → active bridge ──
  ipcMain.on(IpcChannels.sendUserMessage, (_e, text: string) => {
    activeManaged?.bridge.sendUserMessage(text);
  });

  // ── IPC: restart the active bridge ──
  ipcMain.handle(IpcChannels.restartBridge, (): void => {
    if (activeManaged) { activeManaged.bridge.stop(); activeManaged.bridge.start(); }
  });

  // ── IPC: create a brand-new session ──
  ipcMain.handle(IpcChannels.createNewSession, (): string => {
    return spawnManagedBridge(crypto.randomUUID()).sessionId;
  });

  // ── IPC: switch to a session ──
  ipcMain.handle(IpcChannels.activateSession, (_e, sessionId: string): void => {
    const existing = managedBridges.get(sessionId);
    if (existing) {
      setActiveBridge(existing);
    } else {
      spawnManagedBridge(sessionId);
    }
  });

  ipcMain.on(IpcChannels.rendererLog, (_e, ...args: unknown[]) => {
    console.log('[renderer→main]', ...args.map(a => typeof a === 'string' ? a : JSON.stringify(a)));
  });

  // ── File watcher ──
  const watcher = chokidar.watch(resolveSdkCwd(), {
    ignored: /(^|[\/\\])(\.git|node_modules|out|dist)/,
    persistent: true, ignoreInitial: true, depth: 6,
  });
  (['add', 'change', 'unlink', 'addDir', 'unlinkDir'] as const).forEach(ev => {
    watcher.on(ev, (path: string) => {
      if (!win.isDestroyed()) win.webContents.send(FileIpcChannels.watchEvent, { event: ev, path });
    });
  });

  // ── File IPC ──
  ipcMain.handle(FileIpcChannels.listTree, (_e, root: string) => getFileTree(root));
  ipcMain.handle(FileIpcChannels.readFile, (_e, path: string) => readFileSync(path, 'utf8'));
  ipcMain.handle(FileIpcChannels.writeFile, (_e, path: string, content: string) => { writeFileSync(path, content, 'utf8'); });

  // ── Search IPC ──
  ipcMain.handle(SearchIpcChannels.grep, async (_e, { pattern, path: cwd, glob, regex }) =>
    runGrep(pattern, { cwd: cwd ?? resolveSdkCwd(), glob, regex }));
  ipcMain.handle(SearchIpcChannels.glob, async (_e, { pattern, path: cwd }) =>
    runGlob(pattern, cwd ?? resolveSdkCwd()));
  ipcMain.handle(SearchIpcChannels.readFileLines, async (_e, { filePath, startLine, endLine }) => {
    try { return fs.readFileSync(filePath, 'utf-8').split(/\r?\n/).slice(startLine - 1, endLine); }
    catch (err) { console.error('[search:readFileLines] Error:', err); throw err; }
  });

  // ── Session IPC ──
  ipcMain.handle(SessionIpcChannels.list, (): PersistedSession[] => loadSessions());

  ipcMain.handle(SessionIpcChannels.save, (_e, session: PersistedSession): void => {
    const sessions = loadSessions();
    const idx = sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) sessions[idx] = session; else sessions.push(session);
    saveSessions(sessions);
    recordSessionHistory(session);
  });

  ipcMain.handle(SessionIpcChannels.delete, (_e, id: string): void => {
    const sessions = loadSessions().filter(s => s.id !== id);
    saveSessions(sessions);
    const managed = managedBridges.get(id);
    if (managed) { managed.bridge.stop(); managedBridges.delete(id); if (activeManaged === managed) activeManaged = null; }
  });

  ipcMain.handle(SessionIpcChannels.update, (_e, id: string, patch: Record<string, unknown>): void => {
    const sessions = loadSessions();
    const session = sessions.find(s => s.id === id);
    if (session) { Object.assign(session, patch); saveSessions(sessions); }
  });

  ipcMain.handle(SessionIpcChannels.saveMessages, (_e, sessionId: string, messages: unknown[]): void => {
    saveSessionMessages(sessionId, messages as any);
  });

  ipcMain.handle(SessionIpcChannels.loadMessages, (_e, sessionId: string): unknown[] => {
    return loadSessionMessages(sessionId);
  });

  ipcMain.handle(SessionIpcChannels.deleteMessages, (_e, id: string): void => {
    import('./sessionMessages').then(({ deleteSessionMessages }) => { deleteSessionMessages(id); });
  });

  ipcMain.handle(SessionIpcChannels.listSessionIds, (): string[] => {
    return loadActiveSessions().map(s => s.sessionId);
  });

  // ── Remember IPC ──
  ipcMain.handle(IpcChannels.remember, (_e, content: string): void => {
    writeHandoffNote(content);
  });

  ipcMain.handle(IpcChannels.getMemory, (): string | null => {
    return loadSessionMemory();
  });

  win.on('closed', () => {
    for (const managed of managedBridges.values()) managed.bridge.stop();
    managedBridges.clear();
    activeManaged = null;
    unregisterActiveSession();
    shim.close();
    killAllPtys();
    void watcher.close();
  });

  if (!isDev) {
    import('./updater').then(({ setupUpdater }) => setupUpdater(win)).catch(() => {});
  }
}

app.whenReady().then(() => { registerSettingsIpc(); void createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
