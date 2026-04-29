import { create } from 'zustand';
import type { BridgeStatus } from '../../main/ipc';
import type { CleakInboundFrame } from '../../main/cleakProtocol';

export type TextBlock = { type: 'text'; text: string };
export type ThinkingBlock = { type: 'thinking'; thinking: string };
export type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown };
export type ToolResultBlock = { type: 'tool_result'; tool_use_id: string; tool_name?: string; content: unknown; is_error?: boolean };
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
        case 'tool_result': return { type: 'tool_result' as const, tool_use_id: block.tool_use_id, tool_name: block.tool_name, content: block.content, is_error: block.is_error };
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
  agentTerminalMap: Map<string, string>;
  agentToolNameMap: Map<string, string>;
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

  // Map tool_use id → terminal id for agent BashTool/PowerShellTool routing
  agentTerminalMap: new Map<string, string>(),
  // Map tool_use id → tool name for result routing (GlobTool, TodoWriteTool, etc.)
  agentToolNameMap: new Map<string, string>(),

  ingestFrame(frame) {
    const rlog = (...args: unknown[]) => { if (typeof window !== 'undefined' && window.bridge?.rendererLog) window.bridge.rendererLog('[chat]', ...args.map(a => typeof a === 'string' ? a : JSON.stringify(a))); };
    const raw = frame as any;

    // Detect plan mode entry/exit
    if (raw.type === 'enter_plan_mode' || raw.type === 'EnterPlanMode') {
      import('../store/ui').then(({ useUi }) => useUi.getState().setPlanMode(true));
      return;
    }
    if (raw.type === 'exit_plan_mode' || raw.type === 'ExitPlanMode' || raw.type === 'ExitPlanModeV2') {
      import('../store/ui').then(({ useUi }) => useUi.getState().setPlanMode(false));
      return;
    }

    if (frame.type === 'result') {
      rlog('result frame, top-level keys:', Object.keys(raw).join(','), 'result:', raw.result);
    }
    if (frame.type === 'assistant') {
      const raw2 = frame as any;
      rlog('assistant frame, content type:', typeof raw2.message?.content, 'preview:', JSON.stringify(raw2.message?.content)?.slice(0, 200));
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
          // Track tool name for result routing
          const state = useChat.getState();
          state.agentToolNameMap.set(block.id, block.name);

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

          // Route BashTool/PowerShellTool to a named terminal tab
          if (block.name === 'BashTool' || block.name === 'PowerShellTool') {
            const input = block.input as Record<string, unknown>;
            const cmd = (input['command'] ?? '') as string;
            const title = block.name === 'PowerShellTool' ? 'PS' : 'bash';
            import('../store/terminals').then(({ useTerminals }) => {
              const termId = useTerminals.getState().createTab(`${title}: ${cmd.slice(0, 30)}`, true);
              // Store mapping for when result arrives
              const state = useChat.getState();
              state.agentTerminalMap.set(block.id, termId);
            });
          }

          // Track GlobTool/GrepTool names for result routing
          if (block.name.includes('Glob') || block.name.includes('Grep')) {
            const state = useChat.getState();
            state.agentToolNameMap.set(block.id, block.name);
          }
        }

        // When tool_result arrives, route output to the terminal
        if (block.type === 'tool_result') {
          const state = useChat.getState();
          // Look up tool name from the tool_use that was sent earlier
          const toolName = state.agentToolNameMap.get(block.tool_use_id) ?? block.tool_name;
          const termId = state.agentTerminalMap.get(block.tool_use_id);
          if (termId) {
            const output = typeof block.content === 'string'
              ? block.content
              : JSON.stringify(block.content);
            import('../store/terminals').then(({ useTerminals }) => {
              useTerminals.getState().writeOutput(termId, output);
              // Also clear the badge when result arrives
              useTerminals.getState().setActive(termId);
            });
            state.agentTerminalMap.delete(block.tool_use_id);
          }

          // Route GlobTool/GrepTool results to the search store
          const toolName2 = state.agentToolNameMap.get(block.tool_use_id);
          if (toolName2 && (toolName2.includes('Glob') || toolName2.includes('Grep'))) {
            const results = typeof block.content === 'string'
              ? block.content.split('\n').filter(Boolean)
              : Array.isArray(block.content)
                ? block.content.map((x: unknown) => String(x))
                : [];
            Promise.all([
              import('../store/search').then(({ useSearch }) => {
                useSearch.setState({ globResults: results });
              }),
              import('../store/ui').then(({ useUi }) => {
                useUi.getState().setActivity('search');
              }),
            ]);
          }

          // Sync TodoWriteTool results to todos store
          if (toolName === 'TodoWriteTool') {
            try {
              const todos = typeof block.content === 'string'
                ? JSON.parse(block.content)
                : block.content;
              if (Array.isArray(todos)) {
                import('../store/todos').then(({ useTodos }) => {
                  useTodos.getState().setTodos(todos);
                });
              }
            } catch { /* ignore parse errors */ }
          }

          // Handle TaskTool / TaskOutputTool / TaskStopTool results
          if (toolName === 'TaskTool') {
            try {
              const data = typeof block.content === 'string'
                ? JSON.parse(block.content)
                : block.content;
              if (data && typeof data === 'object') {
                import('../store/tasks').then(({ useTasks }) => {
                  if (data.action === 'register' && data.id && data.name) {
                    useTasks.getState().registerTask(data.id, data.name, data.parentId);
                  } else if (data.action === 'update' && data.id && data.status) {
                    useTasks.getState().updateStatus(data.id, data.status, data.error);
                  }
                });
              }
            } catch { /* ignore parse errors */ }
          }

          if (toolName === 'TaskOutputTool') {
            try {
              const data = typeof block.content === 'string'
                ? JSON.parse(block.content)
                : block.content;
              if (data && typeof data === 'object' && data.taskId && data.text) {
                import('../store/tasks').then(({ useTasks }) => {
                  useTasks.getState().appendOutput(data.taskId, data.text);
                });
              }
            } catch { /* ignore parse errors */ }
          }

          if (toolName === 'TaskStopTool') {
            try {
              const data = typeof block.content === 'string'
                ? JSON.parse(block.content)
                : block.content;
              if (data && typeof data === 'object' && data.taskId && data.status) {
                import('../store/tasks').then(({ useTasks }) => {
                  useTasks.getState().updateStatus(data.taskId, data.status, data.error);
                });
              }
            } catch { /* ignore parse errors */ }
          }

          // Clean up the tool name mapping
          state.agentToolNameMap.delete(block.tool_use_id);
        }
      }

      set((s) => {
        const msgs = [...s.messages];
        const tail = msgs[msgs.length - 1];
        if (tail && tail.role === 'assistant' && tail.pending) {
          const newBlocks = appendBlocks(tail.blocks, blocks);
          rlog('after append, blocks:', JSON.stringify(newBlocks));
          msgs[msgs.length - 1] = { ...tail, blocks: newBlocks };
        } else {
          msgs.push({ id: nextId(), role: 'assistant', blocks, pending: true, ts: Date.now(), sessionId: frame.session_id });
          rlog('new assistant msg, blocks:', JSON.stringify(blocks));
        }
        return { messages: msgs };
      });
    } else if (frame.type === 'result') {
      rlog('processing result frame');
      set((s) => {
        const msgs = [...s.messages];
        const tail = msgs[msgs.length - 1];
        const cost = extractCost(frame as any);

        const resultText = (frame as any).result as string | undefined;
        rlog('result tail:', tail?.role, 'pending:', tail?.pending,
          'blocks:', tail?.blocks?.length, 'resultText:', resultText);

        // If there's a pending assistant message, finalize it
        if (tail && tail.role === 'assistant' && tail.pending) {
          const hasText = tail.blocks.some(b => b.type === 'text' && (b as TextBlock).text.length > 0);
          if (resultText && !hasText) {
            rlog('appending resultText as text block');
            msgs[msgs.length - 1] = {
              ...tail,
              blocks: [...tail.blocks, { type: 'text', text: resultText }],
              pending: false,
            };
          } else if (hasText) {
            rlog('assistant already has text blocks, just finalizing');
            msgs[msgs.length - 1] = { ...tail, pending: false };
          } else {
            rlog('no resultText, finalizing empty');
            msgs[msgs.length - 1] = { ...tail, pending: false };
          }
        } else {
          rlog('no pending assistant message at tail');
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
