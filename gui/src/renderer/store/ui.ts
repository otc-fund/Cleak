import { create } from 'zustand';

export type Activity =
  | 'chat'
  | 'files'
  | 'processes'
  | 'tasks'
  | 'todos'
  | 'agents'
  | 'scheduling'
  | 'memory'
  | 'mcp'
  | 'git'
  | 'settings';

export type ChatSideTab = 'sessions' | 'context' | 'search';

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
  /** Sub-tab within the chat side panel. */
  chatSideTab: ChatSideTab;
  sidePanelOpen: boolean;
  rightPanelOpen: boolean;
  activeMainTab: MainTab;
  theme: Theme;
  selectedToolCall: ToolCallDetail | null;
  planMode: boolean;
  /** Whether the chapters/TOC panel is open */
  chaptersPanelOpen: boolean;
  /** The currently active chapter (turn ID) based on scroll position */
  activeChapter: string | null;
  setActivity(a: Activity): void;
  setChatSideTab(t: ChatSideTab): void;
  setSidePanelOpen(open: boolean): void;
  setRightPanelOpen(open: boolean): void;
  setMainTab(tab: MainTab): void;
  setTheme(t: Theme): void;
  setSelectedToolCall(detail: ToolCallDetail | null): void;
  setPlanMode(v: boolean): void;
  setChaptersPanelOpen(open: boolean): void;
  setActiveChapter(id: string | null): void;
}

export const useUi = create<UiState>((set, get) => ({
  activeActivity: 'chat',
  chatSideTab: 'sessions',
  sidePanelOpen: true,
  rightPanelOpen: false,
  activeMainTab: 'chat',
  theme: 'dark',
  selectedToolCall: null,
  planMode: false,
  chaptersPanelOpen: false,
  activeChapter: null,

  setActivity(a) {
    const { activeActivity, sidePanelOpen } = get();
    if (a === activeActivity) {
      set({ sidePanelOpen: !sidePanelOpen });
    } else {
      const opensRight: Activity[] = ['tasks', 'todos'];
      set({ activeActivity: a, chatSideTab: 'sessions', sidePanelOpen: true, rightPanelOpen: opensRight.includes(a) });
    }
  },
  setChatSideTab: (t) => set({ chatSideTab: t, sidePanelOpen: true }),
  setSidePanelOpen: (open) => set({ sidePanelOpen: open }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setMainTab: (tab) => set({ activeMainTab: tab }),
  setTheme: (theme) => set({ theme }),
  setSelectedToolCall: (detail) => set({ selectedToolCall: detail, rightPanelOpen: detail != null }),
  setPlanMode: (v) => set({ planMode: v }),
  setChaptersPanelOpen: (open) => set({ chaptersPanelOpen: open }),
  setActiveChapter: (id) => set({ activeChapter: id }),
}));
