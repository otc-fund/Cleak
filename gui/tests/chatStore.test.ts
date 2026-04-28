import { describe, expect, it, beforeEach } from 'vitest';
import { useChat } from '../src/renderer/store/chat';

describe('useChat', () => {
  beforeEach(() => {
    useChat.setState({ messages: [], errors: [], status: { kind: 'starting' }, cost: null });
  });

  it('appends user message and a pending assistant slot', () => {
    useChat.getState().appendUser('hi');
    const { messages } = useChat.getState();
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(messages[1]!.pending).toBe(true);
    expect(messages[0]!.blocks).toEqual([{ type: 'text', text: 'hi' }]);
  });

  it('ingests assistant text frames into the pending slot', () => {
    useChat.getState().appendUser('hi');
    useChat.getState().ingestFrame({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'he' }] },
    } as never);
    useChat.getState().ingestFrame({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'llo' }] },
    } as never);
    const msg = useChat.getState().messages[1]!;
    expect(msg.blocks).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('ingests assistant string content as text block', () => {
    useChat.getState().appendUser('hi');
    useChat.getState().ingestFrame({
      type: 'assistant',
      message: { role: 'assistant', content: 'hello' },
    } as never);
    const msg = useChat.getState().messages[1]!;
    expect(msg.blocks).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('ingests array content with mixed blocks', () => {
    useChat.getState().appendUser('hi');
    useChat.getState().ingestFrame({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'let me think' },
          { type: 'text', text: 'answer' },
        ],
      },
    } as never);
    const msg = useChat.getState().messages[1]!;
    expect(msg.blocks).toHaveLength(2);
    expect(msg.blocks[0]).toEqual({ type: 'thinking', thinking: 'let me think' });
    expect(msg.blocks[1]).toEqual({ type: 'text', text: 'answer' });
  });

  it('marks pending slot complete on result frame and sets cost', () => {
    useChat.getState().appendUser('hi');
    useChat.getState().ingestFrame({
      type: 'result',
      subtype: 'success',
      is_error: false,
      session_id: 's',
      total_cost_usd: 0.0042,
      modelUsage: {
        'model-1': { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 20 },
      },
    } as never);
    const { messages, cost } = useChat.getState();
    expect(messages[1]!.pending).toBe(false);
    expect(cost).not.toBeNull();
    expect(cost!.inputTokens).toBe(100);
    expect(cost!.outputTokens).toBe(50);
    expect(cost!.cacheReadTokens).toBe(20);
    expect(cost!.totalCostUsd).toBe(0.0042);
  });

  it('pushError caps at 20 errors', () => {
    for (let i = 0; i < 25; i++) {
      useChat.getState().pushError(`error ${i}`);
    }
    const errors = useChat.getState().errors;
    expect(errors.length).toBe(20);
    expect(errors[0]).toBe('error 5');
    expect(errors[19]).toBe('error 24');
  });
});
