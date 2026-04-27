import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn as nodeSpawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { CleakBridge } from './bridge';
import { IpcChannels } from './ipc';
import type { BridgeStatus } from './ipc';
import type { CleakInboundFrame } from './cleakProtocol';
// Note: anthropicShim is imported dynamically inside createWindow to avoid
// loading the http server before app.whenReady resolves.

const isDev = !app.isPackaged;

function resolveClaudeBin(): string {
  const fromEnv = process.env['CLAUDE_BIN'];
  if (fromEnv) return fromEnv;
  // Try common install locations for the Claude Code CLI
  const candidates = [
    join(homedir(), '.local', 'bin', 'claude.exe'),
    join(homedir(), 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
    'claude', // bare name as last resort (may not work via pipe on Windows)
  ];
  for (const c of candidates) {
    if (!c.includes('*') && (c === 'claude' || existsSync(c))) return c;
  }
  console.warn('[cleak-gui] WARNING: claude.exe not found; set CLAUDE_BIN env var. Bridge will fail to start.');
  return candidates[0]!; // return best guess so bridge can report the error naturally
}

function resolveSdkCwd(): string {
  return resolve(app.getAppPath(), '..');
}

function buildEnv(shimPort: number): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  // Point claude.exe at the local translation shim, not the OpenAI server directly.
  // The shim accepts Anthropic Messages API and forwards as OpenAI chat completions.
  env['ANTHROPIC_BASE_URL'] = `http://127.0.0.1:${shimPort}`;
  env['ANTHROPIC_API_KEY'] = 'shim-passthrough';
  if (process.env['ANTHROPIC_MODEL']) env['ANTHROPIC_MODEL'] = process.env['ANTHROPIC_MODEL'];
  return env;
}

async function createWindow(): Promise<void> {
  // Start the Anthropic→OpenAI shim before creating the window so the bridge
  // can point claude.exe at the shim port on startup.
  const { createAnthropicShim } = await import('./anthropicShim');
  const shim = await createAnthropicShim({
    upstreamBaseUrl: process.env['ANTHROPIC_BASE_URL'] ?? 'http://localhost:3003/v1',
    upstreamApiKey: process.env['ANTHROPIC_API_KEY'] ?? '',
    model: process.env['ANTHROPIC_MODEL'] ?? 'qwen3.6-plus',
  });

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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});
