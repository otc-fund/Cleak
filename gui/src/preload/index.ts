import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../main/ipc';
import type { BridgeStatus, BridgeEventMap } from '../main/ipc';
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
};

export type BridgeApi = typeof api;
contextBridge.exposeInMainWorld('bridge', api);
