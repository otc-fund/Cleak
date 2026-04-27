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
