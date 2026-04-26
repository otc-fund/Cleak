// tests/cleakProtocol.test.ts
import { describe, expect, it } from 'vitest';
import {
  CleakInboundFrame,
  buildUserFrame,
} from '../src/main/cleakProtocol';

describe('cleakProtocol — inbound', () => {
  it('parses a system init frame', () => {
    const ok = CleakInboundFrame.safeParse({
      type: 'system',
      subtype: 'init',
      session_id: 's-1',
      tools: [],
      mcp_servers: [],
    });
    expect(ok.success).toBe(true);
  });

  it('parses an assistant text frame', () => {
    const ok = CleakInboundFrame.safeParse({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'hi' }] },
      session_id: 's-1',
    });
    expect(ok.success).toBe(true);
  });

  it('parses a result frame', () => {
    const ok = CleakInboundFrame.safeParse({
      type: 'result',
      subtype: 'success',
      is_error: false,
      session_id: 's-1',
      duration_ms: 12,
      total_cost_usd: 0.0,
    });
    expect(ok.success).toBe(true);
  });

  it('rejects unknown top-level type', () => {
    const ok = CleakInboundFrame.safeParse({ type: 'mystery' });
    expect(ok.success).toBe(false);
  });
});

describe('cleakProtocol — outbound', () => {
  it('builds a user message frame', () => {
    expect(buildUserFrame('hello')).toEqual({
      type: 'user',
      message: { role: 'user', content: 'hello' },
    });
  });
});
