import { create } from 'zustand';
import type { BridgeStatus } from '../../main/ipc';
import type { CleakInboundFrame } from '../../main/cleakProtocol';

export type TextBlock = { type: 'text'; text: string };
export type ThinkingBlock = { type: 'thinking'; thinking: string };
export type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown };
export type ToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: unknown; is_error?: boolean };
export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  blocks: ContentBlock[];
  pending: boolean;
  ts: number;
  sessionId?: string;
}

export interface CostData {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCostUsd: number;
}

function nextId(): string {
  return Math.random().toString(36).slice(2);
}

function extractBlocks(frame: CleakInboundFrame): ContentBlock[] {
  if (frame.type !== 'assistant') return [];
  const c = frame.message.content;
  if (typeof c === 'string') return [{ type: 'text', text: c }];
  if (Array.isArray(c)) {
    return c.map((block) => {
      switch (block.type) {
        case 'text':    return { type: 'text' as const, text: block.text };
        case 'thinking': return { type: 'thinking' as const, thinking: block.thinking };
        case 'tool_use': return { type: 'tool_use' as const, id: block.id, name: block.name, input: block.input };
        case 'tool_result': return { type: 'tool_result' as const, tool_use_id: block.tool_use_id, content: block.content, is_error: block.is_error };
        default: return { type: 'text' as const, text: JSON.stringify(block) };
      }
    });
  }
  return [];
}

function appendBlocks(existing: ContentBlock[], incoming: ContentBlock[]): ContentBlock[] {
  const result = [...existing];
  for (const block of incoming) {
    if (block.type === 'text') {
      const last = result[result.length - 1];
      if (last && last.type === 'text') {
        result[result.length - 1] = { type: 'text', text: last.text + block.text };
      } else {
        result.push(block);
      }
    } else {
      result.push(block);
    }
  }
  return result;
}

interface ChatState {
  messages: ChatMessage[];
  status: BridgeStatus;
  errors: string[];
  cost: CostData | null;
  appendUser(text: string): void;
  ingestFrame(frame: CleakInboundFrame): void;
  setStatus(s: BridgeStatus): void;
  pushError(message: string): void;
}

function extractCost(frame: Record<string, unknown>): CostData {
  const totalCostUsd = (frame['total_cost_usd'] as number | undefined) ?? 0;
  const modelUsage = frame['modelUsage'] as Record<string, {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  }> | undefined;
  const cost: CostData = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCostUsd };
  if (modelUsage) {
    for (const usage of Object.values(modelUsage)) {
      cost.inputTokens += usage.input_tokens ?? 0;
      cost.outputTokens += usage.output_tokens ?? 0;
      cost.cacheReadTokens += usage.cache_read_input_tokens ?? 0;
      cost.cacheWriteTokens += usage.cache_creation_input_tokens ?? 0;
    }
  }
  return cost;
}

export const useChat = create<ChatState>((set) => ({
  messages: [],
  status: { kind: 'starting' },
  errors: [],
  cost: null,

  appendUser(text) {
    set((s) => ({
      messages: [
        ...s.messages,
        { id: nextId(), role: 'user', blocks: [{ type: 'text', text }], pending: false, ts: Date.now() },
        { id: nextId(), role: 'assistant', blocks: [], pending: true, ts: Date.now() },
      ],
    }));
  },

  ingestFrame(frame) {
    console.log('[chat] ingestFrame called, frame type:', frame.type);
    if (frame.type === 'assistant') {
      const blocks = extractBlocks(frame);
      if (blocks.length === 0) return;

      // Emit highlights for file-related tool calls
      const FILE_TOOLS: Record<string, 'read' | 'edit'> = {
        FileReadTool: 'read',
        FileEditTool: 'edit',
        FileWriteTool: 'edit',
        PatchApplyTool: 'edit',
      };
      for (const block of blocks) {
        if (block.type === 'tool_use') {
          const kind = FILE_TOOLS[block.name];
          if (kind) {
            const input = block.input as Record<string, unknown>;
            const filePath = (input['file_path'] ?? input['path']) as string | undefined;
            const startLine = (input['start_line'] ?? 1) as number;
            const endLine = (input['end_line'] ?? startLine) as number;
            if (filePath) {
              import('../store/editor').then(({ useEditor }) => {
                useEditor.getState().addHighlight(filePath, startLine, endLine, kind);
              });
            }
          }
        }
      }

      set((s) => {
        const msgs = [...s.messages];
        const tail = msgs[msgs.length - 1];
        if (tail && tail.role === 'assistant' && tail.pending) {
          msgs[msgs.length - 1] = { ...tail, blocks: appendBlocks(tail.blocks, blocks) };
        } else {
          msgs.push({ id: nextId(), role: 'assistant', blocks, pending: true, ts: Date.now(), sessionId: frame.session_id });
        }
        return { messages: msgs };
      });
    } else if (frame.type === 'result') {
      set((s) => {
        const msgs = [...s.messages];
        const tail = msgs[msgs.length - 1];
        const cost = extractCost(frame as any);

        // If there's a pending assistant message, finalize it
        if (tail && tail.role === 'assistant' && tail.pending) {
          const hasText = tail.blocks.some(b => b.type === 'text');
          const resultText = (frame as any).result as string | undefined;

          if (resultText && !hasText) {
            msgs[msgs.length - 1] = {
              ...tail,
              blocks: [...tail.blocks, { type: 'text', text: resultText }],
              pending: false,
            };
          } else {
            msgs[msgs.length - 1] = { ...tail, pending: false };
          }
        }

        return { messages: msgs, cost };
      });
    }
  },

  setStatus(status) {
    set({ status });
  },

  pushError(message) {
    set((s) => ({ errors: [...s.errors.slice(-19), message] }));
  },
}));
