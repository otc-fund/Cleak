import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels, FileIpcChannels } from '../main/ipc';
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
};

export type BridgeApi = typeof api;
contextBridge.exposeInMainWorld('bridge', api);
