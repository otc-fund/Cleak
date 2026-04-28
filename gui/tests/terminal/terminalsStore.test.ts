import { describe, it, expect } from 'vitest';
import { useTerminals } from '../../src/renderer/store/terminals';

describe('terminals store', () => {
  beforeEach(() => {
    useTerminals.setState({ tabs: [], activeId: null });
  });

  it('createTab adds tab and sets it active', () => {
    const id = useTerminals.getState().createTab('Test');
    const s = useTerminals.getState();
    expect(s.tabs).toHaveLength(1);
    expect(s.tabs[0].id).toBe(id);
    expect(s.tabs[0].title).toBe('Test');
    expect(s.tabs[0].agentOwned).toBe(false);
    expect(s.tabs[0].alive).toBe(true);
    expect(s.activeId).toBe(id);
  });

  it('createTab with agentOwned sets badge', () => {
    const id = useTerminals.getState().createTab('bash: ls', true);
    const tab = useTerminals.getState().tabs.find(t => t.id === id)!;
    expect(tab.agentOwned).toBe(true);
    expect(tab.showBadge).toBe(true);
  });

  it('removeTab removes and updates activeId', () => {
    const id1 = useTerminals.getState().createTab('Term 1');
    const id2 = useTerminals.getState().createTab('Term 2');
    expect(useTerminals.getState().tabs).toHaveLength(2);
    expect(useTerminals.getState().activeId).toBe(id2);

    useTerminals.getState().removeTab(id1);
    expect(useTerminals.getState().tabs).toHaveLength(1);
    expect(useTerminals.getState().tabs[0].id).toBe(id2);
    expect(useTerminals.getState().activeId).toBe(id2);

    // Removing the active tab falls back to the last remaining
    useTerminals.getState().removeTab(id2);
    expect(useTerminals.getState().tabs).toHaveLength(0);
    expect(useTerminals.getState().activeId).toBe(null);
  });

  it('setActive clears showBadge', () => {
    const id = useTerminals.getState().createTab('Agent', true);
    expect(useTerminals.getState().tabs[0].showBadge).toBe(true);
    useTerminals.getState().setActive(id);
    expect(useTerminals.getState().tabs[0].showBadge).toBe(false);
  });

  it('markDead sets alive false', () => {
    const id = useTerminals.getState().createTab('Term');
    expect(useTerminals.getState().tabs[0].alive).toBe(true);
    useTerminals.getState().markDead(id);
    expect(useTerminals.getState().tabs[0].alive).toBe(false);
  });
});
