import { describe, expect, it } from 'vitest';
import http from 'node:http';
import { createAnthropicShim } from '../src/main/anthropicShim';

function startFakeOpenAI(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void) {
  const srv = http.createServer(handler);
  return new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
    srv.listen(0, '127.0.0.1', () => {
      const port = (srv.address() as { port: number }).port;
      resolve({
        port,
        close: () => new Promise<void>((r) => srv.close(() => r())),
      });
    });
  });
}

async function postJson(url: string, body: unknown): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(body);
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname, port: Number(u.port), path: u.pathname,
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(raw) },
      },
      (res) => {
        let buf = '';
        res.on('data', (c: Buffer) => (buf += c.toString()));
        res.on('end', () => {
          try { resolve({ status: res.statusCode ?? 0, json: JSON.parse(buf) }); }
          catch { resolve({ status: res.statusCode ?? 0, json: buf }); }
        });
      },
    );
    req.on('error', reject);
    req.write(raw);
    req.end();
  });
}

async function collectSse(url: string, body: unknown): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const raw = JSON.stringify(body);
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname, port: Number(u.port), path: u.pathname,
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(raw) },
      },
      (res) => {
        const lines: string[] = [];
        res.on('data', (c: Buffer) => lines.push(...c.toString().split('\n').filter(Boolean)));
        res.on('end', () => resolve(lines));
      },
    );
    req.on('error', reject);
    req.write(raw);
    req.end();
  });
}

describe('anthropicShim', () => {
  it('translates a non-streaming Anthropic request to OpenAI and back', async () => {
    let captured: unknown = null;
    const fake = await startFakeOpenAI((req, res) => {
      let buf = '';
      req.on('data', (c: Buffer) => (buf += c.toString()));
      req.on('end', () => {
        captured = JSON.parse(buf);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          id: 'chatcmpl-1',
          choices: [{ index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }));
      });
    });

    const shim = await createAnthropicShim({
      upstreamBaseUrl: `http://127.0.0.1:${fake.port}/v1`,
      upstreamApiKey: 'test-key',
      model: 'gpt-test',
    });

    try {
      const { json } = await postJson(`http://127.0.0.1:${shim.port}/v1/messages`, {
        model: 'claude-3-5-sonnet',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'ping' }],
      });
      expect((captured as { model: string }).model).toBe('gpt-test');
      expect((json as { type: string }).type).toBe('message');
      const content = (json as { content: { type: string; text: string }[] }).content;
      expect(content[0]!.text).toBe('pong');
    } finally {
      shim.close();
      await fake.close();
    }
  });

  it('streams Anthropic SSE events translated from OpenAI chunks', async () => {
    const fake = await startFakeOpenAI((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const chunks = [
        { choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] },
        { choices: [{ index: 0, delta: { content: 'he' }, finish_reason: null }] },
        { choices: [{ index: 0, delta: { content: 'llo' }, finish_reason: null }] },
        { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
      ];
      for (const c of chunks) res.write(`data: ${JSON.stringify(c)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    });

    const shim = await createAnthropicShim({
      upstreamBaseUrl: `http://127.0.0.1:${fake.port}/v1`,
      upstreamApiKey: 'test-key',
      model: 'gpt-test',
    });

    try {
      const lines = await collectSse(`http://127.0.0.1:${shim.port}/v1/messages`, {
        model: 'claude-3-5-sonnet',
        max_tokens: 100,
        stream: true,
        messages: [{ role: 'user', content: 'hi' }],
      });
      const eventLines = lines.filter((l) => l.startsWith('event:'));
      expect(eventLines).toContain('event: message_start');
      expect(eventLines).toContain('event: content_block_start');
      expect(eventLines).toContain('event: content_block_delta');
      expect(eventLines).toContain('event: content_block_stop');
      expect(eventLines).toContain('event: message_stop');
      const dataLines = lines.filter((l) => l.startsWith('data:'));
      const deltas = dataLines
        .map((l) => { try { return JSON.parse(l.slice(5)); } catch { return null; } })
        .filter((d) => d?.type === 'content_block_delta');
      const text = (deltas as { delta: { text: string } }[]).map((d) => d.delta.text).join('');
      expect(text).toBe('hello');
    } finally {
      shim.close();
      await fake.close();
    }
  });

  it('prepends system string as OpenAI system message', async () => {
    let capturedMessages: unknown[] = [];
    const fake = await startFakeOpenAI((req, res) => {
      let buf = '';
      req.on('data', (c: Buffer) => (buf += c.toString()));
      req.on('end', () => {
        capturedMessages = (JSON.parse(buf) as { messages: unknown[] }).messages;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }));
      });
    });

    const shim = await createAnthropicShim({
      upstreamBaseUrl: `http://127.0.0.1:${fake.port}/v1`,
      upstreamApiKey: 'k',
      model: 'm',
    });
    try {
      await postJson(`http://127.0.0.1:${shim.port}/v1/messages`, {
        model: 'x',
        max_tokens: 10,
        system: 'You are a bot.',
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(capturedMessages[0]).toEqual({ role: 'system', content: 'You are a bot.' });
      expect(capturedMessages[1]).toEqual({ role: 'user', content: 'hi' });
    } finally {
      shim.close();
      await fake.close();
    }
  });
});
