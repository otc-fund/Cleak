import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels, FileIpcChannels, PtyIpcChannels, SearchIpcChannels, SessionIpcChannels } from '../main/ipc';
import type { BridgeStatus, BridgeEventMap, AppSettings } from '../main/ipc';
import type { CleakInboundFrame } from '../main/cleakProtocol';
import type { PersistedSession } from '../main/sessionsStore';

const api = {
  sendUserMessage(text: string): void {
    ipcRenderer.send(IpcChannels.sendUserMessage, text);
  },
  rendererLog(...args: unknown[]): void {
    ipcRenderer.send(IpcChannels.rendererLog, ...args);
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
  listTree(root: string): Promise<unknown> {
    return ipcRenderer.invoke(FileIpcChannels.listTree, root);
  },
  readFile(path: string): Promise<string> {
    return ipcRenderer.invoke(FileIpcChannels.readFile, path);
  },
  writeFile(path: string, content: string): Promise<void> {
    return ipcRenderer.invoke(FileIpcChannels.writeFile, path, content);
  },
  onWatchEvent(cb: (e: { event: string; path: string }) => void): () => void {
    const handler = (_e: unknown, event: { event: string; path: string }) => cb(event);
    ipcRenderer.on(FileIpcChannels.watchEvent, handler);
    return () => ipcRenderer.off(FileIpcChannels.watchEvent, handler);
  },
  // PTY IPC
  ptyCreate(id: string, shell: string | undefined, cwd: string): Promise<{ pid: number }> {
    return ipcRenderer.invoke(PtyIpcChannels.create, { id, shell, cwd });
  },
  ptyInput(id: string, data: string): void {
    ipcRenderer.send(PtyIpcChannels.input, { id, data });
  },
  ptyResize(id: string, cols: number, rows: number): void {
    ipcRenderer.send(PtyIpcChannels.resize, { id, cols, rows });
  },
  ptyKill(id: string): void {
    ipcRenderer.send(PtyIpcChannels.kill, { id });
  },
  onPtyData(cb: (id: string, data: string) => void): () => void {
    const handler = (_e: unknown, p: { id: string; data: string }) => cb(p.id, p.data);
    ipcRenderer.on(PtyIpcChannels.data, handler);
    return () => ipcRenderer.off(PtyIpcChannels.data, handler);
  },
  onPtyExit(cb: (id: string, code: number) => void): () => void {
    const handler = (_e: unknown, p: { id: string; code: number }) => cb(p.id, p.code);
    ipcRenderer.on(PtyIpcChannels.exit, handler);
    return () => ipcRenderer.off(PtyIpcChannels.exit, handler);
  },
  // Search IPC
  searchGrep: (pattern: string, path: string, opts?: { glob?: string; regex?: boolean }) =>
    ipcRenderer.invoke(SearchIpcChannels.grep, { pattern, path, ...opts }),
  searchGlob: (pattern: string, path: string) =>
    ipcRenderer.invoke(SearchIpcChannels.glob, { pattern, path }),
  searchReadLines: (filePath: string, startLine: number, endLine: number) =>
    ipcRenderer.invoke(SearchIpcChannels.readFileLines, { filePath, startLine, endLine }),
  // Session IPC
  listSessions(): Promise<PersistedSession[]> {
    return ipcRenderer.invoke(SessionIpcChannels.list) as Promise<PersistedSession[]>;
  },
  saveSession(session: PersistedSession): Promise<void> {
    return ipcRenderer.invoke(SessionIpcChannels.save, session) as Promise<void>;
  },
  deleteSession(id: string): Promise<void> {
    return ipcRenderer.invoke(SessionIpcChannels.delete, id) as Promise<void>;
  },
  updateSession(id: string, patch: Record<string, unknown>): Promise<void> {
    return ipcRenderer.invoke(SessionIpcChannels.update, id, patch) as Promise<void>;
  },
};

export type BridgeApi = typeof api;
contextBridge.exposeInMainWorld('bridge', api);
