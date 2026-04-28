import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:fs/promises
const mockReaddir = vi.fn();
vi.mock('node:fs/promises', () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  stat: vi.fn(),
}));

// Mock node:fs
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

// Mock ignore
const mockIgnores = vi.fn().mockReturnValue(false);
vi.mock('ignore', () => ({
  default: () => ({
    add: vi.fn(),
    ignores: mockIgnores,
  }),
}));

describe('getFileTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIgnores.mockReturnValue(false);
  });

  it('returns sorted dirs-first', async () => {
    vi.resetModules();
    mockExistsSync.mockReturnValue(false);

    mockReaddir
      .mockResolvedValueOnce([
        { name: 'alpha.ts', isDirectory: () => false },
        { name: 'src', isDirectory: () => true },
        { name: 'beta.ts', isDirectory: () => false },
        { name: 'docs', isDirectory: () => true },
      ])
      .mockResolvedValueOnce([]) // src
      .mockResolvedValueOnce([]); // docs

    const { getFileTree } = await import('../../src/main/fileTree');
    const tree = await getFileTree('/fake-root');

    expect(tree.map(n => n.name)).toEqual(['docs', 'src', 'alpha.ts', 'beta.ts']);
    expect(tree[0]!.kind).toBe('dir');
    expect(tree[1]!.kind).toBe('dir');
    expect(tree[2]!.kind).toBe('file');
    expect(tree[3]!.kind).toBe('file');
  });

  it('skips node_modules and .git', async () => {
    vi.resetModules();
    mockExistsSync.mockReturnValue(false);

    mockReaddir
      .mockResolvedValueOnce([
        { name: 'app.ts', isDirectory: () => false },
        { name: 'node_modules', isDirectory: () => true },
        { name: '.git', isDirectory: () => true },
        { name: 'lib', isDirectory: () => true },
      ])
      .mockResolvedValueOnce([]); // lib

    const { getFileTree } = await import('../../src/main/fileTree');
    const tree = await getFileTree('/fake-root');

    const names = tree.map(n => n.name);
    expect(names).not.toContain('node_modules');
    expect(names).not.toContain('.git');
    expect(names).toContain('app.ts');
    expect(names).toContain('lib');
  });

  it('respects simple .gitignore patterns', async () => {
    vi.resetModules();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('*.log\ntemp/\n');
    mockIgnores.mockImplementation((rel: string) => {
      return rel === 'debug.log' || rel === 'temp';
    });

    mockReaddir
      .mockResolvedValueOnce([
        { name: 'app.ts', isDirectory: () => false },
        { name: 'debug.log', isDirectory: () => false },
        { name: 'temp', isDirectory: () => true },
        { name: 'src', isDirectory: () => true },
      ])
      .mockResolvedValueOnce([]); // src

    const { getFileTree } = await import('../../src/main/fileTree');
    const tree = await getFileTree('/fake-root');

    const names = tree.map(n => n.name);
    expect(names).not.toContain('debug.log');
    expect(names).not.toContain('temp');
    expect(names).toContain('app.ts');
    expect(names).toContain('src');
  });

  it('respects path-scoped .gitignore patterns in subdirectories', async () => {
    vi.resetModules();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('src/config.json\nbuild/\n');
    mockIgnores.mockImplementation((rel: string) => {
      // Handle both forward and backslash path separators (Windows vs Unix)
      const normalized = rel.replace(/\\/g, '/');
      return normalized === 'src/config.json' || normalized === 'build';
    });

    mockReaddir
      .mockResolvedValueOnce([
        { name: 'app.ts', isDirectory: () => false },
        { name: 'src', isDirectory: () => true },
        { name: 'build', isDirectory: () => true },
      ])
      .mockResolvedValueOnce([
        { name: 'index.ts', isDirectory: () => false },
        { name: 'config.json', isDirectory: () => false },
      ]);

    const { getFileTree } = await import('../../src/main/fileTree');
    const tree = await getFileTree('/fake-root');

    const names = tree.map(n => n.name);
    expect(names).not.toContain('build');
    expect(names).toContain('src');
    const srcNode = tree.find(n => n.name === 'src');
    expect(srcNode?.children?.map(c => c.name)).toEqual(['index.ts']);
    expect(srcNode?.children?.some(c => c.name === 'config.json')).toBe(false);
  });
});
