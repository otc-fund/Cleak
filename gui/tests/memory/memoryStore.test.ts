import { describe, it, expect } from 'vitest';
import { useMemory } from '../../src/renderer/store/memory';

describe('useMemory', () => {
  it('initializes with empty index and all filter', () => {
    const s = useMemory.getState();
    expect(s.index).toEqual([]);
    expect(s.filter).toBe('all');
    expect(s.rememberConfig.enabled).toBe(true);
    expect(s.rememberConfig.types).toEqual(['user', 'feedback', 'project', 'reference']);
  });

  it('setFilter changes the filter type', () => {
    useMemory.getState().setFilter('user');
    expect(useMemory.getState().filter).toBe('user');
    useMemory.getState().setFilter('all');
    expect(useMemory.getState().filter).toBe('all');
  });

  it('createMemory adds entry to index', () => {
    useMemory.setState({ index: [] });
    useMemory.getState().createMemory('test.md', {
      name: 'Test Memory',
      description: 'A test memory entry',
      type: 'project',
      body: 'Body content',
    });
    expect(useMemory.getState().index).toHaveLength(1);
    expect(useMemory.getState().index[0]).toEqual({
      title: 'Test Memory',
      file: 'test.md',
      summary: 'A test memory entry',
    });
  });

  it('createMemory truncates summary over 150 chars', () => {
    useMemory.setState({ index: [] });
    const longDesc = 'x'.repeat(200);
    useMemory.getState().createMemory('long.md', {
      name: 'Long',
      description: longDesc,
      type: 'user',
      body: 'x',
    });
    const entry = useMemory.getState().index[0]!;
    expect(entry.summary.length).toBeLessThanOrEqual(153);
    expect(entry.summary.endsWith('...')).toBe(true);
  });

  it('updateMemory updates index entry', () => {
    useMemory.setState({ index: [{ title: 'Old', file: 'f.md', summary: 'old' }] });
    useMemory.getState().updateMemory('f.md', { name: 'New', description: 'new desc' });
    expect(useMemory.getState().index[0]).toEqual({
      title: 'New',
      file: 'f.md',
      summary: 'new desc',
    });
  });

  it('deleteMemory removes entry and clears selected', () => {
    useMemory.setState({
      index: [{ title: 'X', file: 'x.md', summary: 'x' }],
      selected: { name: 'X', description: 'x', type: 'user', file: 'x.md', body: 'x' },
    });
    useMemory.getState().deleteMemory('x.md');
    expect(useMemory.getState().index).toEqual([]);
    expect(useMemory.getState().selected).toBeNull();
  });

  it('deleteMemory keeps selected if different file', () => {
    useMemory.setState({
      index: [{ title: 'X', file: 'x.md', summary: 'x' }],
      selected: { name: 'Y', description: 'y', type: 'user', file: 'y.md', body: 'y' },
    });
    useMemory.getState().deleteMemory('x.md');
    expect(useMemory.getState().selected?.file).toBe('y.md');
  });

  it('updateRememberConfig merges partial config', () => {
    useMemory.getState().updateRememberConfig({ enabled: false });
    const s = useMemory.getState();
    expect(s.rememberConfig.enabled).toBe(false);
    expect(s.rememberConfig.types).toEqual(['user', 'feedback', 'project', 'reference']);
  });

  it('loadMemories is async and does not throw', async () => {
    await expect(useMemory.getState().loadMemories()).resolves.toBeUndefined();
  });

  it('selectMemory is async and sets selected to null (stub)', async () => {
    await expect(useMemory.getState().selectMemory('nonexistent.md')).resolves.toBeUndefined();
  });
});
