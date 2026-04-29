export interface MemoryHookConfig {
  type: 'onTurnEnd' | 'onUserMessage' | 'onSessionResume';
  enabled: boolean;
  settings: Record<string, unknown>;
}

export const DEFAULT_MEMORY_HOOKS: MemoryHookConfig[] = [
  {
    type: 'onTurnEnd',
    enabled: true,
    settings: { minContentLength: 100, excludeCommands: ['/clear', '/compact'] },
  },
  {
    type: 'onUserMessage',
    enabled: true,
    settings: { commandPattern: /^\/remember\s+/i },
  },
  {
    type: 'onSessionResume',
    enabled: true,
    settings: { loadMemoryIndex: true, loadRecentMemories: 5 },
  },
];
