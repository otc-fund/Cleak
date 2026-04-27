// tests/chatStore.test.ts
import { describe, expect, it, beforeEach } from 'vitest';
import { useChat } from '../src/renderer/store/chat';

describe('useChat', () => {
  beforeEach(() => {
    useChat.setState({ messages: [], errors: [], status: { kind: 'starting' } });
  });

  it('appends user message and a pending assistant slot', () => {
    useChat.getState().appendUser('hi');
    const { messages } = useChat.getState();
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(messages[1]!.pending).toBe(true);
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
    expect(useChat.getState().messages[1]!.text).toBe('hello');
  });

  it('marks the pending slot complete on result frame', () => {
    useChat.getState().appendUser('hi');
    useChat.getState().ingestFrame({
      type: 'result',
      subtype: 'success',
      is_error: false,
      session_id: 's',
    } as never);
    expect(useChat.getState().messages[1]!.pending).toBe(false);
  });
});
