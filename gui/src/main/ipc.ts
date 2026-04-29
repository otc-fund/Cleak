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
  rendererLog:      'renderer:log',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

export const FileIpcChannels = {
  listTree:      'files:listTree',
  readFile:      'files:readFile',
  writeFile:     'files:writeFile',
  watchStart:    'files:watchStart',
  watchStop:     'files:watchStop',
  watchEvent:    'files:watchEvent',
} as const;

export const PtyIpcChannels = {
  create:   'pty:create',
  input:    'pty:input',
  resize:   'pty:resize',
  kill:     'pty:kill',
  data:     'pty:data',
  exit:     'pty:exit',
} as const;

export const SessionIpcChannels = {
  list:    'sessions:list',
  save:    'sessions:save',
  delete:  'sessions:delete',
  update:  'sessions:update',
} as const;

export const SearchIpcChannels = {
  grep:          'search:grep',          // renderer → main: { pattern, path, glob?, regex? } → GrepMatch[]
  glob:          'search:glob',           // renderer → main: { pattern, path } → string[] (file paths)
  readFileLines: 'search:readFileLines',  // renderer → main: { filePath, startLine, endLine } → string[]
} as const;
