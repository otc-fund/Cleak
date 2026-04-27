import { create } from 'zustand';

export type Activity =
  | 'chat'
  | 'files'
  | 'search'
  | 'tasks'
  | 'agents'
  | 'mcp'
  | 'git'
  | 'settings';

export type MainTab = 'chat' | 'editor' | 'terminal';
export type Theme = 'dark' | 'light' | 'high-contrast';

interface UiState {
  activeActivity: Activity;
  sidePanelOpen: boolean;
  rightPanelOpen: boolean;
  activeMainTab: MainTab;
  theme: Theme;
  setActivity(a: Activity): void;
  setSidePanelOpen(open: boolean): void;
  setRightPanelOpen(open: boolean): void;
  setMainTab(tab: MainTab): void;
  setTheme(t: Theme): void;
}

export const useUi = create<UiState>((set, get) => ({
  activeActivity: 'chat',
  sidePanelOpen: true,
  rightPanelOpen: false,
  activeMainTab: 'chat',
  theme: 'dark',

  setActivity(a) {
    const { activeActivity, sidePanelOpen } = get();
    if (a === activeActivity) {
      set({ sidePanelOpen: !sidePanelOpen });
    } else {
      set({ activeActivity: a, sidePanelOpen: true });
    }
  },
  setSidePanelOpen: (open) => set({ sidePanelOpen: open }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setMainTab: (tab) => set({ activeMainTab: tab }),
  setTheme: (theme) => set({ theme }),
}));
