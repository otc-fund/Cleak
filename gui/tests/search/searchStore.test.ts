import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { useSearch } from '../../src/renderer/store/search';

beforeEach(() => {
  useSearch.setState({
    grepQuery: '',
    grepGlob: '',
    grepRegex: false,
    grepResults: [],
    grepRunning: false,
    quickOpenEntries: [],
    quickOpenOpen: false,
    quickOpenQuery: '',
    quickOpenFuse: null,
    quickOpenMatches: [],
    globResults: [],
  });
  vi.stubGlobal('window', {
    bridge: {
      searchGrep: vi.fn().mockResolvedValue([]),
      searchGlob: vi.fn().mockResolvedValue([]),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSearch — grep', () => {
  it('setGrepQuery updates grepQuery', () => {
    useSearch.getState().setGrepQuery('hello');
    expect(useSearch.getState().grepQuery).toBe('hello');
  });

  it('setGrepGlob updates grepGlob', () => {
    useSearch.getState().setGrepGlob('*.ts');
    expect(useSearch.getState().grepGlob).toBe('*.ts');
  });

  it('toggleGrepRegex flips boolean', () => {
    expect(useSearch.getState().grepRegex).toBe(false);
    useSearch.getState().toggleGrepRegex();
    expect(useSearch.getState().grepRegex).toBe(true);
    useSearch.getState().toggleGrepRegex();
    expect(useSearch.getState().grepRegex).toBe(false);
  });

  it('runGrep groups results by file', async () => {
    (window as any).bridge.searchGrep = vi.fn().mockResolvedValue([
      { file: 'src/a.ts', line: 1, column: 5, matchText: 'hello' },
      { file: 'src/a.ts', line: 3, column: 10, matchText: 'world' },
      { file: 'src/b.ts', line: 7, column: 2, matchText: 'hello' },
    ]);
    useSearch.getState().setGrepQuery('hello');
    await useSearch.getState().runGrep('/project');

    const { grepResults } = useSearch.getState();
    expect(grepResults).toHaveLength(2);
    expect(grepResults[0]!.file).toBe('src/a.ts');
    expect(grepResults[0]!.matches).toHaveLength(2);
    expect(grepResults[1]!.file).toBe('src/b.ts');
    expect(grepResults[1]!.matches).toHaveLength(1);
  });

  it('runGrep does nothing when query is empty', async () => {
    await useSearch.getState().runGrep('/project');
    expect(useSearch.getState().grepRunning).toBe(false);
    expect((window as any).bridge.searchGrep).not.toHaveBeenCalled();
  });
});

describe('useSearch — quick open', () => {
  it('populateQuickOpen builds fuse index and sets matches', () => {
    const entries = [
      { path: 'src/a.ts', label: 'a.ts' },
      { path: 'src/b.ts', label: 'b.ts' },
      { path: 'lib/utils/helper.ts', label: 'helper.ts' },
    ];
    useSearch.getState().populateQuickOpen(entries);

    const state = useSearch.getState();
    expect(state.quickOpenEntries).toEqual(entries);
    expect(state.quickOpenFuse).not.toBeNull();
    expect(state.quickOpenMatches).toEqual(entries);
  });

  it('setQuickOpenQuery filters via fuse', () => {
    useSearch.getState().populateQuickOpen([
      { path: 'src/a.ts', label: 'a.ts' },
      { path: 'src/b.ts', label: 'b.ts' },
      { path: 'lib/utils/helper.ts', label: 'helper.ts' },
    ]);

    useSearch.getState().setQuickOpenQuery('help');
    const matches = useSearch.getState().quickOpenMatches;
    expect(matches.length).toBe(1);
    expect(matches[0]!.label).toBe('helper.ts');
  });

  it('setQuickOpenQuery returns top 30 when no query', () => {
    const entries = Array.from({ length: 50 }, (_, i) => ({
      path: `src/file${i}.ts`,
      label: `file${i}.ts`,
    }));
    useSearch.getState().populateQuickOpen(entries);

    useSearch.getState().setQuickOpenQuery('');
    expect(useSearch.getState().quickOpenMatches).toHaveLength(30);
  });

  it('setQuickOpen opens/closes panel and resets query', () => {
    useSearch.getState().setQuickOpen(true);
    expect(useSearch.getState().quickOpenOpen).toBe(true);
    expect(useSearch.getState().quickOpenQuery).toBe('');
    // When open with no entries, matches should be empty
    expect(useSearch.getState().quickOpenMatches).toEqual([]);
  });

  it('setQuickOpen populates matches when opening with entries', () => {
    useSearch.getState().populateQuickOpen([
      { path: 'src/a.ts', label: 'a.ts' },
    ]);
    useSearch.getState().setQuickOpen(true);
    expect(useSearch.getState().quickOpenMatches).toEqual([
      { path: 'src/a.ts', label: 'a.ts' },
    ]);
  });
});

describe('useSearch — glob', () => {
  it('runGlob sets globResults', async () => {
    (window as any).bridge.searchGlob = vi.fn().mockResolvedValue([
      'src/a.ts',
      'src/b.ts',
    ]);
    await useSearch.getState().runGlob('**/*.ts', '/project');
    expect(useSearch.getState().globResults).toEqual(['src/a.ts', 'src/b.ts']);
  });
});
