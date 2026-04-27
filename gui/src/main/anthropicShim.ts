import http from 'node:http';

export interface ShimConfig {
  upstreamBaseUrl: string;
  upstreamApiKey: string;
  model: string;
}

export interface ShimHandle {
  port: number;
  close: () => void;
}

interface AnthropicMessage {
  role: string;
  content: string | { type: string; text?: string }[];
}

interface AnthropicRequest {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  system?: string;
  messages: AnthropicMessage[];
}

function buildOpenAIBody(req: AnthropicRequest, model: string): Record<string, unknown> {
  const messages: { role: string; content: unknown }[] = [];
  if (req.system) messages.push({ role: 'system', content: req.system });
  for (const m of req.messages) messages.push({ role: m.role, content: m.content });
  const body: Record<string, unknown> = { model, messages };
  if (req.max_tokens != null) body['max_tokens'] = req.max_tokens;
  if (req.temperature != null) body['temperature'] = req.temperature;
  if (req.stream) body['stream'] = true;
  return body;
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function makeRequest(
  upstreamBaseUrl: string,
  upstreamApiKey: string,
  body: Record<string, unknown>,
): Promise<http.IncomingMessage> {
  const raw = JSON.stringify(body);
  const u = new URL(`${upstreamBaseUrl}/chat/completions`);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: u.hostname,
        port: Number(u.port),
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(raw),
          authorization: `Bearer ${upstreamApiKey}`,
        },
      },
      resolve,
    );
    req.on('error', reject);
    req.write(raw);
    req.end();
  });
}

async function proxyNonStreaming(
  body: Record<string, unknown>,
  cfg: ShimConfig,
  res: http.ServerResponse,
): Promise<void> {
  const oaiRes = await makeRequest(cfg.upstreamBaseUrl, cfg.upstreamApiKey, body);
  let buf = '';
  await new Promise<void>((resolve, reject) => {
    oaiRes.on('data', (c: Buffer) => (buf += c.toString()));
    oaiRes.on('end', resolve);
    oaiRes.on('error', reject);
  });
  const oai = JSON.parse(buf) as {
    id?: string;
    choices?: { message?: { content?: string }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = oai.choices?.[0]?.message?.content ?? '';
  const anthropicResp = {
    id: oai.id ?? `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model: cfg.model,
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: oai.usage?.prompt_tokens ?? 0,
      output_tokens: oai.usage?.completion_tokens ?? 0,
    },
  };
  const out = JSON.stringify(anthropicResp);
  res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(out) });
  res.end(out);
}

async function proxyStreaming(
  body: Record<string, unknown>,
  cfg: ShimConfig,
  res: http.ServerResponse,
): Promise<void> {
  const oaiRes = await makeRequest(cfg.upstreamBaseUrl, cfg.upstreamApiKey, body);
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });

  const msgId = `msg_${Date.now()}`;
  let headerSent = false;
  let lineBuf = '';

  await new Promise<void>((resolve, reject) => {
    oaiRes.on('data', (chunk: Buffer) => {
      lineBuf += chunk.toString();
      const lines = lineBuf.split('\n');
      lineBuf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          res.write(sseEvent('content_block_stop', { type: 'content_block_stop', index: 0 }));
          res.write(sseEvent('message_delta', {
            type: 'message_delta',
            delta: { stop_reason: 'end_turn', stop_sequence: null },
            usage: { output_tokens: 0 },
          }));
          res.write(sseEvent('message_stop', { type: 'message_stop' }));
          return;
        }
        try {
          const parsed = JSON.parse(payload) as {
            choices?: { delta?: { role?: string; content?: string }; finish_reason?: string | null }[];
          };
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          if (!headerSent) {
            headerSent = true;
            res.write(sseEvent('message_start', {
              type: 'message_start',
              message: {
                id: msgId, type: 'message', role: 'assistant', content: [],
                model: cfg.model, stop_reason: null, stop_sequence: null,
                usage: { input_tokens: 0, output_tokens: 0 },
              },
            }));
            res.write(sseEvent('content_block_start', {
              type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' },
            }));
            res.write(sseEvent('ping', { type: 'ping' }));
          }

          if (typeof delta.content === 'string' && delta.content.length > 0) {
            res.write(sseEvent('content_block_delta', {
              type: 'content_block_delta', index: 0,
              delta: { type: 'text_delta', text: delta.content },
            }));
          }
        } catch { /* skip malformed lines */ }
      }
    });
    oaiRes.on('end', () => { res.end(); resolve(); });
    oaiRes.on('error', reject);
  });
}

export function createAnthropicShim(cfg: ShimConfig): Promise<ShimHandle> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== 'POST' || !req.url?.endsWith('/messages')) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        let parsed: AnthropicRequest;
        try { parsed = JSON.parse(body) as AnthropicRequest; }
        catch { res.writeHead(400); res.end('Bad request'); return; }

        const oaiBody = buildOpenAIBody(parsed, cfg.model);

        if (parsed.stream) {
          proxyStreaming(oaiBody, cfg, res).catch((e: unknown) => {
            if (!res.headersSent) { res.writeHead(502); res.end(String(e)); }
          });
        } else {
          proxyNonStreaming(oaiBody, cfg, res).catch((e: unknown) => {
            if (!res.headersSent) { res.writeHead(502); res.end(String(e)); }
          });
        }
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ port: addr.port, close: () => server.close() });
    });
    server.on('error', reject);
  });
}
