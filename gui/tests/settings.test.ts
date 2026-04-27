import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock electron before importing the module under test
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/cleak-settings-test'),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    // Identity transform so tests stay readable
    encryptString: vi.fn((s: string) => Buffer.from(s)),
    decryptString: vi.fn((b: Buffer) => b.toString()),
  },
}));

// Mock the fs module
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockExistsSync = vi.fn(() => false);

vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  existsSync: mockExistsSync,
}));

// Import AFTER mocks are set up
const { loadSettings, saveSettings } = await import('../src/main/settings');

describe('settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  it('returns defaults when no settings file exists', () => {
    const s = loadSettings();
    expect(s.baseUrl).toBe('http://localhost:3003/v1');
    expect(s.model).toBe('qwen3.6-plus');
    expect(s.theme).toBe('dark');
    expect(s.apiKey).toBe('');
  });

  it('reads stored values from the settings file', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        baseUrl: 'http://other:3003/v1',
        model: 'gpt-4',
        theme: 'light',
        apiKeyEnc: Buffer.from('my-secret-key').toString('base64'),
      }),
    );
    const s = loadSettings();
    expect(s.baseUrl).toBe('http://other:3003/v1');
    expect(s.model).toBe('gpt-4');
    expect(s.theme).toBe('light');
    expect(s.apiKey).toBe('my-secret-key');
  });

  it('saves settings with the API key encrypted', () => {
    saveSettings({
      baseUrl: 'http://localhost:3003/v1',
      model: 'qwen3.6-plus',
      theme: 'dark',
      apiKey: 'my-key',
    });
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const [, content] = mockWriteFileSync.mock.calls[0] as [string, string, string];
    const stored = JSON.parse(content) as { apiKeyEnc?: string; apiKey?: string };
    // The plain apiKey must NOT appear in the stored JSON
    expect(stored.apiKey).toBeUndefined();
    // The encrypted version must appear
    expect(stored.apiKeyEnc).toBeDefined();
    // With our identity mock, the base64 of the key must equal its own base64
    expect(Buffer.from(stored.apiKeyEnc!, 'base64').toString()).toBe('my-key');
  });

  it('handles corrupt settings file gracefully', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not valid json!!!');
    const s = loadSettings();
    // Should fall back to defaults, not throw
    expect(s.baseUrl).toBe('http://localhost:3003/v1');
  });
});
