import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { useEditor } from '../../src/renderer/store/editor';

beforeEach(() => {
  useEditor.setState({ tabs: [], activeTab: null });
  vi.stubGlobal('window', {
    bridge: {
      writeFile: vi.fn().mockResolvedValue(undefined),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useEditor', () => {
  it('starts with no tabs', () => {
    expect(useEditor.getState().tabs).toEqual([]);
    expect(useEditor.getState().activeTab).toBeNull();
  });

  it('opens a file and sets activeTab', () => {
    useEditor.getState().openFile('/src/app.ts', 'const x = 1;');
    const { tabs, activeTab } = useEditor.getState();
    expect(tabs.length).toBe(1);
    const tab = tabs[0]!;
    expect(tab.path).toBe('/src/app.ts');
    expect(tab.content).toBe('const x = 1;');
    expect(tab.savedContent).toBe('const x = 1;');
    expect(tab.language).toBe('typescript');
    expect(activeTab).toBe('/src/app.ts');
  });

  it('detects language from path', () => {
    useEditor.getState().openFile('/src/style.css', 'body {}');
    expect(useEditor.getState().tabs[0]!.language).toBe('css');

    useEditor.getState().openFile('/src/index.py', 'print("hi")');
    expect(useEditor.getState().tabs[1]!.language).toBe('python');

    useEditor.getState().openFile('/src/unknown.xyz', '???');
    expect(useEditor.getState().tabs[2]!.language).toBe('plaintext');
  });

  it('re-opens existing file by activating tab only', () => {
    useEditor.getState().openFile('/src/app.ts', 'const x = 1;');
    useEditor.getState().openFile('/src/app.ts', 'const x = 999;');
    expect(useEditor.getState().tabs.length).toBe(1);
    expect(useEditor.getState().tabs[0]!.content).toBe('const x = 1;');
  });

  it('sets content (dirty state)', () => {
    useEditor.getState().openFile('/src/app.ts', 'const x = 1;');
    useEditor.getState().setContent('/src/app.ts', 'const x = 2;');
    const tab = useEditor.getState().tabs[0]!;
    expect(tab.content).toBe('const x = 2;');
    expect(tab.savedContent).toBe('const x = 1;');
  });

  it('saveTab updates savedContent', async () => {
    useEditor.getState().openFile('/src/app.ts', 'const x = 1;');
    useEditor.getState().setContent('/src/app.ts', 'const x = 2;');
    await useEditor.getState().saveTab('/src/app.ts');
    const tab = useEditor.getState().tabs[0]!;
    expect(tab.savedContent).toBe('const x = 2;');
    expect((window as any).bridge.writeFile).toHaveBeenCalledWith('/src/app.ts', 'const x = 2;');
  });

  it('discardTab reverts content to savedContent', () => {
    useEditor.getState().openFile('/src/app.ts', 'const x = 1;');
    useEditor.getState().setContent('/src/app.ts', 'const x = 2;');
    useEditor.getState().discardTab('/src/app.ts');
    expect(useEditor.getState().tabs[0]!.content).toBe('const x = 1;');
  });

  it('closeTab removes tab and activates previous', () => {
    useEditor.getState().openFile('/src/a.ts', 'a');
    useEditor.getState().openFile('/src/b.ts', 'b');
    useEditor.getState().closeTab('/src/b.ts');
    expect(useEditor.getState().tabs.length).toBe(1);
    expect(useEditor.getState().activeTab).toBe('/src/a.ts');
  });

  it('closeTab last tab sets activeTab to null', () => {
    useEditor.getState().openFile('/src/a.ts', 'a');
    useEditor.getState().closeTab('/src/a.ts');
    expect(useEditor.getState().tabs.length).toBe(0);
    expect(useEditor.getState().activeTab).toBeNull();
  });

  it('addHighlight and clearHighlights', () => {
    useEditor.getState().openFile('/src/app.ts', 'const x = 1;');
    useEditor.getState().addHighlight('/src/app.ts', 1, 3, 'read');
    useEditor.getState().addHighlight('/src/app.ts', 5, 8, 'edit');
    const tab = useEditor.getState().tabs[0]!;
    expect(tab.highlights.length).toBe(2);
    expect(tab.highlights[0]!.kind).toBe('read');

    useEditor.getState().clearHighlights('/src/app.ts');
    expect(useEditor.getState().tabs[0]!.highlights.length).toBe(0);
  });
});
