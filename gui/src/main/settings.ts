import { app, safeStorage } from 'electron';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export interface AppSettings {
  baseUrl: string;
  model: string;
  theme: 'dark' | 'light' | 'high-contrast';
  apiKey: string;
}

const DEFAULTS: AppSettings = {
  baseUrl: 'http://localhost:3003/v1',
  model: 'qwen3.6-plus',
  theme: 'dark',
  apiKey: '',
};

interface StoredFile {
  baseUrl?: string;
  model?: string;
  theme?: string;
  apiKeyEnc?: string; // base64(safeStorage.encryptString(apiKey))
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(): AppSettings {
  const path = settingsPath();
  let stored: StoredFile = {};
  if (existsSync(path)) {
    try {
      stored = JSON.parse(readFileSync(path, 'utf8')) as StoredFile;
    } catch {
      // Corrupt file — use defaults
    }
  }

  let apiKey = '';
  if (stored.apiKeyEnc && safeStorage.isEncryptionAvailable()) {
    try {
      apiKey = safeStorage.decryptString(Buffer.from(stored.apiKeyEnc, 'base64'));
    } catch {
      // Encrypted blob from a different machine or corrupt — reset
    }
  }

  const VALID_THEMES = ['dark', 'light', 'high-contrast'] as const;
  const rawTheme = stored.theme;
  const theme = VALID_THEMES.includes(rawTheme as AppSettings['theme'])
    ? (rawTheme as AppSettings['theme'])
    : DEFAULTS.theme;

  return {
    baseUrl: stored.baseUrl ?? DEFAULTS.baseUrl,
    model:   stored.model   ?? DEFAULTS.model,
    theme,
    apiKey,
  };
}

export function saveSettings(s: AppSettings): void {
  const path = settingsPath();
  const stored: StoredFile = {
    baseUrl: s.baseUrl,
    model:   s.model,
    theme:   s.theme,
  };
  if (s.apiKey && safeStorage.isEncryptionAvailable()) {
    stored.apiKeyEnc = safeStorage.encryptString(s.apiKey).toString('base64');
  }
  writeFileSync(path, JSON.stringify(stored, null, 2), 'utf8');
}
