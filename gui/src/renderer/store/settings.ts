import { create } from 'zustand';

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

interface SettingsState extends AppSettings {
  loaded: boolean;
  load(): Promise<void>;
  save(partial: Partial<AppSettings>): Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  async load() {
    if (!window.bridge?.loadSettings) return;
    try {
      const s = await window.bridge.loadSettings();
      set({ ...s, loaded: true });
    } catch {
      set({ loaded: true }); // use defaults if IPC fails
    }
  },

  async save(partial) {
    const current = get();
    const next: AppSettings = {
      baseUrl: partial.baseUrl ?? current.baseUrl,
      model: partial.model ?? current.model,
      theme: partial.theme ?? current.theme,
      apiKey: partial.apiKey ?? current.apiKey,
    };
    set(next);
    if (!window.bridge?.saveSettings) return;
    try {
      await window.bridge.saveSettings(next);
    } catch {
      /* best effort */
    }
  },
}));
