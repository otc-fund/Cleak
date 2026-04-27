import { describe, expect, it, beforeEach } from 'vitest';
import { useUi } from '../src/renderer/store/ui';

describe('useUi', () => {
  beforeEach(() => {
    useUi.setState({
      activeActivity: 'chat',
      sidePanelOpen: true,
      rightPanelOpen: false,
      activeMainTab: 'chat',
      theme: 'dark',
    });
  });

  it('toggles side panel when same activity re-clicked', () => {
    useUi.getState().setActivity('chat');
    expect(useUi.getState().sidePanelOpen).toBe(false);
    useUi.getState().setActivity('chat');
    expect(useUi.getState().sidePanelOpen).toBe(true);
  });

  it('opens side panel when switching to a new activity', () => {
    useUi.setState({ activeActivity: 'files', sidePanelOpen: false });
    useUi.getState().setActivity('settings');
    expect(useUi.getState().activeActivity).toBe('settings');
    expect(useUi.getState().sidePanelOpen).toBe(true);
  });

  it('sets active main tab', () => {
    useUi.getState().setMainTab('chat');
    expect(useUi.getState().activeMainTab).toBe('chat');
  });

  it('cycles theme', () => {
    useUi.getState().setTheme('light');
    expect(useUi.getState().theme).toBe('light');
    useUi.getState().setTheme('high-contrast');
    expect(useUi.getState().theme).toBe('high-contrast');
  });
});
