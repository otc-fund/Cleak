/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('useFiles', () => {
  beforeEach(() => {
    vi.resetModules();
    (window as any).bridge = { listTree: vi.fn() };
  });

  afterEach(() => {
    delete (window as any).bridge;
  });

  it('toggleExpand adds then removes path', async () => {
    const { useFiles } = await import('../../src/renderer/store/files');

    useFiles.getState().toggleExpand('/src');
    expect(useFiles.getState().expanded.has('/src')).toBe(true);

    useFiles.getState().toggleExpand('/src');
    expect(useFiles.getState().expanded.has('/src')).toBe(false);
  });

  it('setFilter updates filter', async () => {
    const { useFiles } = await import('../../src/renderer/store/files');

    useFiles.getState().setFilter('*.ts');
    expect(useFiles.getState().filter).toBe('*.ts');

    useFiles.getState().setFilter('');
    expect(useFiles.getState().filter).toBe('');
  });

  it('loadTree on success sets tree', async () => {
    const mockTree = [
      { name: 'src', path: '/proj/src', kind: 'dir' as const, children: [] },
      { name: 'index.ts', path: '/proj/index.ts', kind: 'file' as const },
    ];
    (window as any).bridge.listTree.mockResolvedValue(mockTree);

    const { useFiles } = await import('../../src/renderer/store/files');

    await useFiles.getState().loadTree('/proj');

    expect(useFiles.getState().loading).toBe(false);
    expect(useFiles.getState().error).toBe(null);
    expect(useFiles.getState().root).toBe('/proj');
    expect(useFiles.getState().tree).toEqual(mockTree);
  });

  it('loadTree on error sets error', async () => {
    (window as any).bridge.listTree.mockRejectedValue(new Error('ENOENT'));

    const { useFiles } = await import('../../src/renderer/store/files');

    await useFiles.getState().loadTree('/nope');

    expect(useFiles.getState().loading).toBe(false);
    expect(useFiles.getState().error).toContain('ENOENT');
  });
});
