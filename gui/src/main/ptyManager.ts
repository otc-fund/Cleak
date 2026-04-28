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
