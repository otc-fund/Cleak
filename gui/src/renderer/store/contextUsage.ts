import { create } from 'zustand';

export interface ContextCategory {
  name: string;
  tokens: number;
  color: string;
  isDeferred?: boolean;
}

export interface ContextGridSquare {
  color: string;
  isFilled: boolean;
  categoryName: string;
  tokens: number;
  percentage: number;
  squareFullness: number;
}

export interface ContextUsage {
  categories: ContextCategory[];
  totalTokens: number;
  maxTokens: number;
  rawMaxTokens: number;
  percentage: number;
  model: string;
  gridRows: ContextGridSquare[][];
  memoryFiles: string[];
  mcpTools: string[];
  agents: string[];
  skills?: string[];
  messageBreakdown?: { sent: number; received: number; total: number };
  apiUsage?: { requests: number; tokens: number; period: string };
}

interface ContextUsageState {
  usage: ContextUsage | null;
  loading: boolean;
  refresh(): Promise<void>;
}

export const useContextUsage = create<ContextUsageState>((set) => ({
  usage: null,
  loading: false,

  async refresh() {
    set({ loading: true });
    try {
      // const data = await window.bridge.getContextUsage();
      // set({ usage: data, loading: false });
      set({ loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
