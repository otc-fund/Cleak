import { create } from 'zustand';

export type Activity =
  | 'chat'
  | 'files'
  | 'search'
  | 'processes'
  | 'tasks'
  | 'agents'
  | 'mcp'
  | 'git'
  | 'settings'
  | 'todos';

export type MainTab = 'chat' | 'editor' | 'terminal';
export type Theme = 'dark' | 'light' | 'high-contrast';

export interface ToolCallDetail {
  toolName: string;
  input: unknown;
  result: unknown;
  isError?: boolean;
}

interface UiState {
  activeActivity: Activity;
  sidePanelOpen: boolean;
  rightPanelOpen: boolean;
  activeMainTab: MainTab;
  theme: Theme;
  selectedToolCall: ToolCallDetail | null;
  planMode: boolean;
  setActivity(a: Activity): void;
  setSidePanelOpen(open: boolean): void;
  setRightPanelOpen(open: boolean): void;
  setMainTab(tab: MainTab): void;
  setTheme(t: Theme): void;
  setSelectedToolCall(detail: ToolCallDetail | null): void;
  setPlanMode(v: boolean): void;
}

export const useUi = create<UiState>((set, get) => ({
  activeActivity: 'chat',
  sidePanelOpen: true,
  rightPanelOpen: false,
  activeMainTab: 'chat',
  theme: 'dark',
  selectedToolCall: null,
  planMode: false,

  setActivity(a) {
    const { activeActivity, sidePanelOpen } = get();
    if (a === activeActivity) {
      set({ sidePanelOpen: !sidePanelOpen });
    } else {
      // Activities that require the right panel to be visible
      const opensRight: Activity[] = ['tasks', 'todos'];
      set({ activeActivity: a, sidePanelOpen: true, rightPanelOpen: opensRight.includes(a) });
    }
  },
  setSidePanelOpen: (open) => set({ sidePanelOpen: open }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setMainTab: (tab) => set({ activeMainTab: tab }),
  setTheme: (theme) => set({ theme }),
  setSelectedToolCall: (detail) => set({ selectedToolCall: detail, rightPanelOpen: detail != null }),
  setPlanMode: (v) => set({ planMode: v }),
}));
