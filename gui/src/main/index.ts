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

const isDev = !app.isPackaged;

function resolveClaudeBin(): string {
  const fromEnv = process.env['CLAUDE_BIN'];
  if (fromEnv) { console.log('[cleak-gui] claude bin from CLAUDE_BIN:', fromEnv); return fromEnv; }
  const candidates = [
    // Windows installer
    join(homedir(), 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
    // npm global — prefer .cmd over bare .exe (.cmd reliably pipes via shell)
    join(homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
    // Linux/Mac npm global
    join(homedir(), '.local', 'bin', 'claude'),
    join(homedir(), '.local', 'bin', 'claude.exe'),
    // Last resort
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

// Wire settings IPC — must be called before any window is created.
function registerSettingsIpc(): void {
  ipcMain.handle(IpcChannels.loadSettings, (): AppSettings => loadSettings());
  ipcMain.handle(IpcChannels.saveSettings, (_e, s: AppSettings): void => {
    try {
      saveSettings(s);
    } catch (err) {
      console.error('[cleak-gui] Failed to save settings:', err);
      throw err; // re-throw so renderer promise rejects and can handle it
    }
  });
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

  // Suppress Electron's "no CSP" warning; dev allows unsafe-eval for Vite HMR.
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev
      ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*"
      : "default-src 'self'; script-src 'self'";
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } });
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    await win.loadURL(process.env['ELECTRON_RENDERER_URL']);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(resolve(__dirname, '../renderer/index.html'));
  }

  const claudeBin = resolveClaudeBin();
  const bridge = new CleakBridge({
    spawn: (cmd, args, opts) => nodeSpawn(cmd, [...args], { ...opts, shell: true }),
    cwd: resolveSdkCwd(),
    env: buildEnv(shim.port),
    claudeBin,
  });

  bridge.on('status', (s: BridgeStatus) => {
    if (!win.isDestroyed()) win.webContents.send(IpcChannels.status, s);
  });
  bridge.on('frame', (f: CleakInboundFrame) => {
    if (f.type === 'result') {
      console.log('[ipc] result frame, result:', (f as any).result);
      // Also log to renderer devtools for debugging
      if (!win.isDestroyed()) win.webContents.executeJavaScript(`console.log('[ipc→renderer] result frame, result:', ${(JSON.stringify((f as any).result))})`);
    }
    if (!win.isDestroyed()) win.webContents.send(IpcChannels.frame, f);
  });
  bridge.on('error', (e: { message: string }) => {
    if (!win.isDestroyed()) win.webContents.send(IpcChannels.error, e);
  });

  // Wire pty IPC
  registerPtyIpc(win);

  ipcMain.on(IpcChannels.sendUserMessage, (_e, text: string) => {
    bridge.sendUserMessage(text);
  });
  ipcMain.on(IpcChannels.rendererLog, (_e, ...args: unknown[]) => {
    console.log('[renderer→main]', ...args.map(a => typeof a === 'string' ? a : JSON.stringify(a)));
  });

  bridge.start();

  // File watcher — watch the SDK root for changes
  const watcher = chokidar.watch(resolveSdkCwd(), {
    ignored: /(^|[\/\\])(\.git|node_modules|out|dist)/,
    persistent: true,
    ignoreInitial: true,
    depth: 6,
  });
  (['add', 'change', 'unlink', 'addDir', 'unlinkDir'] as const).forEach(ev => {
    watcher.on(ev, (path: string) => {
      if (!win.isDestroyed()) win.webContents.send(FileIpcChannels.watchEvent, { event: ev, path });
    });
  });

  // File IPC handlers
  ipcMain.handle(FileIpcChannels.listTree, (_e, root: string) => getFileTree(root));
  ipcMain.handle(FileIpcChannels.readFile, (_e, path: string) => readFileSync(path, 'utf8'));
  ipcMain.handle(FileIpcChannels.writeFile, (_e, path: string, content: string) => {
    writeFileSync(path, content, 'utf8');
  });

  // Search IPC handlers
  ipcMain.handle(SearchIpcChannels.grep, async (_e, { pattern, path: cwd, glob, regex }) => {
    return runGrep(pattern, { cwd: cwd ?? resolveSdkCwd(), glob, regex });
  });
  ipcMain.handle(SearchIpcChannels.glob, async (_e, { pattern, path: cwd }) => {
    return runGlob(pattern, cwd ?? resolveSdkCwd());
  });
  ipcMain.handle(SearchIpcChannels.readFileLines, async (_e, { filePath, startLine, endLine }) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content.split(/\r?\n/).slice(startLine - 1, endLine);
    } catch (err) {
      console.error('[search:readFileLines] Error:', err);
      throw err;
    }
  });

  win.on('closed', () => { bridge.stop(); shim.close(); killAllPtys(); void watcher.close(); });
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
