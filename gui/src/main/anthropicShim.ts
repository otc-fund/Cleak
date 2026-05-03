import http from 'node:http';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const shimLogPath = join(tmpdir(), 'cleak-shim.log');
function shimLog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  appendFileSync(shimLogPath, line);
  console.log(msg);
}

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
  content: string | { type: string; text?: string; cache_control?: unknown }[];
}

interface AnthropicRequest {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  system?: string;
  messages: AnthropicMessage[];
}

function stripCacheControl(blocks: any[]): any[] {
  return blocks.map(b => {
    if (b && typeof b === 'object' && 'cache_control' in b) {
      const { cache_control, ...rest } = b;
      return rest;
    }
    return b;
  });
}

function buildOpenAIBody(req: AnthropicRequest, model: string): Record<string, unknown> {
  const effectiveModel = model || 'qwen3.6-plus';
  const messages: { role: string; content: unknown; tool_calls?: unknown[]; tool_call_id?: string }[] = [];
  if (req.system) messages.push({ role: 'system', content: req.system });
  for (const m of req.messages) {
    if (Array.isArray(m.content)) {
      const blocks = stripCacheControl(m.content as any[]);
      const toolUseBlocks = blocks.filter((b: any) => b.type === 'tool_use');
      const toolResults = blocks.filter((b: any) => b.type === 'tool_result');
      const textBlocks = blocks.filter(
        (b: any) => b.type === 'text'
      );

      // Handle Anthropic assistant message with tool_use blocks
      if (toolUseBlocks.length > 0 && m.role === 'assistant') {
        const toolCalls = toolUseBlocks.map((tu: any) => ({
          id: tu.id || `call_${Date.now()}`,
          type: 'function' as const,
          function: {
            name: tu.name || 'unknown',
            arguments: typeof tu.input === 'string' ? tu.input : JSON.stringify(tu.input || {}),
          },
        }));
        const textContent = textBlocks
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('\n');
        messages.push({
          role: 'assistant',
          content: textContent || '',
          tool_calls: toolCalls,
        });
        continue;
      }

      // Handle Anthropic system messages: flatten content blocks to string
      if (m.role === 'system') {
        const textContent = textBlocks.map((b: any) => b.text).join('\n\n');
        if (textContent) {
          messages.push({ role: 'system', content: textContent });
        }
        continue;
      }

      // Handle Anthropic user message with tool_result blocks
      if (toolResults.length > 0 && m.role === 'user') {
        for (const tr of toolResults) {
          const tc = tr.content;
          const textContent = typeof tc === 'string'
            ? tc
            : Array.isArray(tc)
              ? tc.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
              : '';
          messages.push({ role: 'tool', content: textContent, tool_call_id: tr.tool_use_id || '' });
        }
        // If there are non-tool_result blocks too, flatten to string
        if (textBlocks.length > 0) {
          const textContent = textBlocks.map((b: any) => b.text).join('\n');
          messages.push({ role: m.role, content: textContent });
        }
        continue;
      }

      // For any other role with array content, flatten text blocks to string
      if (textBlocks.length > 0) {
        const textContent = textBlocks.map((b: any) => b.text).join('\n');
        messages.push({ role: m.role, content: textContent });
      }
    } else {
      messages.push({ role: m.role, content: m.content });
    }
  }
  // Always force streaming — upstream generates full response before returning in non-stream mode
  const body: Record<string, unknown> = { model: effectiveModel, messages, stream: true };
  if (req.max_tokens != null) body['max_tokens'] = req.max_tokens;
  if (req.temperature != null) body['temperature'] = req.temperature;

  // Translate Anthropic tools to OpenAI format if present
  if ((req as any).tools && Array.isArray((req as any).tools)) {
    body['tools'] = (req as any).tools.map((t: any) => {
      if (t.type === 'function') return t; // Already OpenAI format — passthrough
      return { type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } };
    });
  }
  // Translate tool_choice
  const anthroToolChoice = (req as any).tool_choice;
  if (anthroToolChoice) {
    if (anthroToolChoice === 'any' || anthroToolChoice === 'required') body['tool_choice'] = 'required';
    else if (anthroToolChoice === 'auto') body['tool_choice'] = 'auto';
    else if (anthroToolChoice?.type === 'tool' && anthroToolChoice?.name) body['tool_choice'] = { type: 'function', function: { name: anthroToolChoice.name } };
  }

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
  const port = u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80);
  console.log('[shim] t=', Date.now(), '→ POST', `${u.hostname}:${port}${u.pathname}`);
  shimLog(`t=${Date.now()} → POST ${u.hostname}:${port}${u.pathname} model=${body.model} stream=${body.stream}`);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: u.hostname,
        port,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(raw),
          authorization: `Bearer ${upstreamApiKey}`,
        },
      },
      (res) => {
        const t = Date.now();
        shimLog(`t=${t} ← upstream ${res.statusCode} ct=${res.headers['content-type']} transfer-encoding=${res.headers['transfer-encoding']}`);
        resolve(res);
      },
    );
    req.on('error', (e) => {
      shimLog(`t=${Date.now()} request error: ${e.message}`);
      reject(e);
    });
    req.write(raw);
    req.end();
    shimLog(`t=${Date.now()} request sent`);
  });
}

async function proxyStreaming(
  body: Record<string, unknown>,
  cfg: ShimConfig,
  res: http.ServerResponse,
): Promise<void> {
  const oaiRes = await makeRequest(cfg.upstreamBaseUrl, cfg.upstreamApiKey, body);

  // If upstream returns an error status, pass it through
  if (oaiRes.statusCode && oaiRes.statusCode >= 400) {
    const errBody: Buffer[] = [];
    oaiRes.on('data', (c: Buffer) => errBody.push(c));
    oaiRes.on('end', () => {
      res.writeHead(oaiRes.statusCode!, { 'content-type': 'application/json' });
      res.end(Buffer.concat(errBody));
    });
    return;
  }

  // If upstream returns a JSON error instead of SSE, forward it
  const ct = oaiRes.headers['content-type'] || '';
  if (!ct.includes('text/event-stream') && !ct.includes('stream')) {
    const errBody: Buffer[] = [];
    oaiRes.on('data', (c: Buffer) => errBody.push(c));
    oaiRes.on('end', () => {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: `Upstream returned non-SSE response: ${Buffer.concat(errBody).toString()}` } }));
    });
    return;
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });

  const msgId = `msg_${Date.now()}`;
  let headerSent = false;
  let lineBuf = '';
  let firstChunkTs: number | null = null;

  // Track content block state: thinking at index 0, text at index 1
  let textBlockIndex: number | null = null;
  let thinkingBlockActive = false;
  let thinkingWasActivated = false; // tracks if thinking was ever started (for correct text index)
  // Track tool call state — proxy sends non-standard format:
  // each chunk may have a different call_id and name="unknown" on incremental chunks.
  // We use the first real id/name and ignore subsequent overrides.
  let toolCallIndex: number | null = null;
  let toolCallName = '';
  let toolCallInput = '';
  let toolCallId = '';
  let toolCallIdLocked = false;
  let toolCallNameLocked = false;
  let finishReasonSent = false;
  let doneSent = false;

  await new Promise<void>((resolve, reject) => {
    let debugChunkCount = 0;
    oaiRes.on('data', (chunk: Buffer) => {
      if (!firstChunkTs) {
        firstChunkTs = Date.now();
        shimLog(`t=${firstChunkTs} first streaming chunk`);
      }
      // Log first 3 raw chunks for debugging (raw SSE data)
      if (debugChunkCount < 3) {
        shimLog(`  RAW[${debugChunkCount}]: ${chunk.toString().slice(0, 300)}`);
        debugChunkCount++;
      }
      lineBuf += chunk.toString();
      const lines = lineBuf.split('\n');
      lineBuf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          // Guard against duplicate [DONE] from upstream (DashScope sends 2)
          if (doneSent) return;
          doneSent = true;
          // Close any still-open content blocks
          if (thinkingBlockActive) {
            res.write(sseEvent('content_block_stop', { type: 'content_block_stop', index: 0 }));
          }
          if (textBlockIndex != null) {
            res.write(sseEvent('content_block_stop', { type: 'content_block_stop', index: textBlockIndex }));
          }
          if (toolCallIndex != null) {
            res.write(sseEvent('content_block_stop', { type: 'content_block_stop', index: toolCallIndex }));
          }
          // Only emit message_delta if finish_reason wasn't already sent via a chunk
          if (!finishReasonSent) {
            res.write(sseEvent('message_delta', {
              type: 'message_delta',
              delta: { stop_reason: 'end_turn', stop_sequence: null },
              usage: { output_tokens: 0 },
            }));
          }
          res.write(sseEvent('message_stop', { type: 'message_stop' }));
          return;
        }
        try {
          const parsed = JSON.parse(payload) as {
            choices?: { delta?: { role?: string; content?: string; reasoning_content?: string; tool_calls?: Array<{ index?: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }> }; finish_reason?: string | null }[];
            error?: { message?: string; type?: string; code?: number };
          };

          // Detect upstream error wrapped in SSE data (e.g. from DashScope proxy)
          if (parsed.error) {
            console.error('[shim] upstream error:', JSON.stringify(parsed.error));
            shimLog(`  ERROR: ${JSON.stringify(parsed.error)}`);
            // Forward as a text block so the user sees the error message
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
              res.write(sseEvent('ping', { type: 'ping' }));
            }
            if (textBlockIndex == null) {
              textBlockIndex = 0;
              res.write(sseEvent('content_block_start', {
                type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' },
              }));
            }
            res.write(sseEvent('content_block_delta', {
              type: 'content_block_delta', index: textBlockIndex,
              delta: { type: 'text_delta', text: `API error: ${parsed.error.message || JSON.stringify(parsed.error)}` },
            }));
            doneSent = true;
            res.write(sseEvent('content_block_stop', { type: 'content_block_stop', index: textBlockIndex }));
            res.write(sseEvent('message_delta', {
              type: 'message_delta',
              delta: { stop_reason: 'end_turn', stop_sequence: null },
              usage: { output_tokens: 0 },
            }));
            res.write(sseEvent('message_stop', { type: 'message_stop' }));
            return;
          }

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
            res.write(sseEvent('ping', { type: 'ping' }));
          }

          // Handle thinking (reasoning_content) vs response text (content)
          if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
            if (!thinkingBlockActive) {
              res.write(sseEvent('content_block_start', {
                type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' },
              }));
              thinkingBlockActive = true;
              thinkingWasActivated = true;
            }
            res.write(sseEvent('content_block_delta', {
              type: 'content_block_delta', index: 0,
              delta: { type: 'thinking_delta', thinking: delta.reasoning_content },
            }));
          }

          if (typeof delta.content === 'string' && delta.content.length > 0) {
            const rawContent = delta.content;

            // Detect Qwen-style thinking delimiters embedded in content.
            // Some upstream APIs merge reasoning into the content field instead
            // of using a separate reasoning_content stream.
            const THOUGHT_START = '<|begin_of_thought|>';
            const THOUGHT_END = '<|end_of_thought|>';

            let remaining = rawContent;
            while (remaining.length > 0) {
              const thinkStartIdx = remaining.indexOf(THOUGHT_START);
              const thinkEndIdx = remaining.indexOf(THOUGHT_END);

              if (thinkStartIdx === -1) {
                // No thinking delimiter found — emit as text
                emitTextContent(remaining);
                remaining = '';
              } else if (thinkStartIdx > 0) {
                // Text before thinking delimiter
                emitTextContent(remaining.slice(0, thinkStartIdx));
                remaining = remaining.slice(thinkStartIdx);
              } else {
                // Thinking delimiter at start — extract thinking content
                if (thinkEndIdx === -1) {
                  // No end delimiter yet — emit thinking and wait for more chunks
                  emitThinkingContent(remaining.slice(THOUGHT_START.length));
                  remaining = '';
                } else {
                  // Complete thinking block
                  emitThinkingContent(remaining.slice(THOUGHT_START.length, thinkEndIdx));
                  remaining = remaining.slice(thinkEndIdx + THOUGHT_END.length);
                }
              }
            }

            function emitThinkingContent(text: string) {
              if (!text) return;
              if (!thinkingBlockActive) {
                res.write(sseEvent('content_block_start', {
                  type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' },
                }));
                thinkingBlockActive = true;
                thinkingWasActivated = true;
              }
              res.write(sseEvent('content_block_delta', {
                type: 'content_block_delta', index: 0,
                delta: { type: 'thinking_delta', thinking: text },
              }));
            }

            function emitTextContent(text: string) {
              if (!text) return;
              // Close thinking if it was active (from either reasoning_content or content delimiters)
              if (thinkingBlockActive) {
                res.write(sseEvent('content_block_stop', { type: 'content_block_stop', index: 0 }));
                thinkingBlockActive = false;
              }
              // Start text block if it doesn't exist yet
              if (textBlockIndex == null) {
                // If thinking was ever activated, it occupied index 0, so text goes at index 1.
                // Otherwise text starts at index 0.
                textBlockIndex = thinkingWasActivated ? 1 : 0;
                res.write(sseEvent('content_block_start', {
                  type: 'content_block_start', index: textBlockIndex, content_block: { type: 'text', text: '' },
                }));
              }

              res.write(sseEvent('content_block_delta', {
                type: 'content_block_delta', index: textBlockIndex,
                delta: { type: 'text_delta', text },
              }));
            }
          }

          // Handle tool_calls from OpenAI streaming
          if (delta.tool_calls && delta.tool_calls.length > 0) {
            const tc = delta.tool_calls[0]!;
            // Close thinking block if active
            if (thinkingBlockActive) {
              res.write(sseEvent('content_block_stop', { type: 'content_block_stop', index: 0 }));
              thinkingBlockActive = false;
            }
            // Start a new tool_use block if needed
            if (toolCallIndex == null) {
              toolCallIndex = textBlockIndex != null ? textBlockIndex + 1 : 0;
              // Lock the first real ID and name — ignore changing IDs and empty/unknown names
              if (tc.id && tc.id !== 'unknown') { toolCallId = tc.id; toolCallIdLocked = true; }
              if (tc.function?.name && tc.function.name !== 'unknown' && tc.function.name !== '') { toolCallName = tc.function.name; toolCallNameLocked = true; }
              // DashScope first chunk sends arguments: "{}" as a placeholder — skip it,
              // real content arrives in subsequent chunks. But if it sends real content,
              // use it directly.
              const args = tc.function?.arguments || '';
              if (args && args !== '{}') {
                toolCallInput = args;
              }
              res.write(sseEvent('content_block_start', {
                type: 'content_block_start', index: toolCallIndex,
                content_block: { type: 'tool_use', id: toolCallId || `tool_${Date.now()}`, name: toolCallName || 'unknown', input: {} },
              }));
            } else {
              // Accumulate incremental tool call arguments
              // Only accept id/name if not yet locked and they look real (not empty/unknown)
              if (!toolCallIdLocked && tc.id && tc.id !== 'unknown') { toolCallId = tc.id; toolCallIdLocked = true; }
              if (!toolCallNameLocked && tc.function?.name && tc.function.name !== 'unknown' && tc.function.name !== '') { toolCallName = tc.function.name; toolCallNameLocked = true; }
              // DashScope may send "{}" on subsequent chunks too — skip those
              const args = tc.function?.arguments || '';
              if (args && args !== '{}') {
                toolCallInput += args;
              }
            }
            // Only emit delta if there's actual content (skip "{}" placeholder chunks)
            const deltaArgs = tc.function?.arguments;
            if (deltaArgs && deltaArgs !== '{}') {
              res.write(sseEvent('content_block_delta', {
                type: 'content_block_delta', index: toolCallIndex,
                delta: { type: 'input_json_delta', partial_json: deltaArgs },
              }));
            }
          }

          // Handle finish_reason — translate to Anthropic stop_reason
          const finishReason = parsed.choices?.[0]?.finish_reason;
          if (finishReason === 'tool_calls') {
            // Close tool_call block if still open
            if (toolCallIndex != null) {
              res.write(sseEvent('content_block_stop', { type: 'content_block_stop', index: toolCallIndex }));
            }
            res.write(sseEvent('message_delta', {
              type: 'message_delta',
              delta: { stop_reason: 'tool_use', stop_sequence: null },
              usage: { output_tokens: 0 },
            }));
            finishReasonSent = true;
          } else if (finishReason === 'stop') {
            res.write(sseEvent('message_delta', {
              type: 'message_delta',
              delta: { stop_reason: 'end_turn', stop_sequence: null },
              usage: { output_tokens: 0 },
            }));
            finishReasonSent = true;
          }
        } catch { /* skip malformed lines */ }
      }
    });
    oaiRes.on('end', () => {
      const endTs = Date.now();
      shimLog(`t=${endTs} streaming ended (delta: ${firstChunkTs ? endTs - firstChunkTs : '?'}ms)`);
      res.end();
      resolve();
    });
    oaiRes.on('error', (err) => { if (!res.destroyed) res.end(); reject(err); });
  });
}

export function createAnthropicShim(cfg: ShimConfig): Promise<ShimHandle> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      console.log('[shim] ←', req.method, req.url);
      shimLog(`← ${req.method} ${req.url}`);

      // Handle Anthropic model listing: GET /v1/models
      // Claude CLI calls this to validate the configured model before starting
      if (req.method === 'GET' && req.url?.endsWith('/models')) {
        shimLog(`→ returning synthetic models list for model=${cfg.model}`);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          data: [
            { id: cfg.model, name: cfg.model, created_at: new Date().toISOString(), type: 'model' },
            { id: 'default', name: 'default', created_at: new Date().toISOString(), type: 'model' },
          ],
          has_more: false,
          first_id: cfg.model,
          last_id: 'default',
        }));
        return;
      }

      if (req.method !== 'POST' || !(req.url?.includes('/messages'))) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        shimLog(`t=${Date.now()} request body received, len=${body.length}`);
        let parsed: AnthropicRequest;
        try { parsed = JSON.parse(body) as AnthropicRequest; }
        catch { res.writeHead(400); res.end('Bad request'); return; }

        const oaiBody = buildOpenAIBody(parsed, cfg.model);
        // Diagnostic: dump full request body (truncated) for debugging 400 errors
        const rawBody = JSON.stringify(oaiBody, null, 2);
        shimLog(`  body(len=${rawBody.length}):\n${rawBody.slice(0, 3000)}${rawBody.length > 3000 ? '\n...[truncated]' : ''}`);

        // Always use streaming proxy — oaiBody.stream is always true (forced in buildOpenAIBody)
        proxyStreaming(oaiBody, cfg, res).catch((e: unknown) => {
          if (!res.headersSent) { res.writeHead(502); res.end(String(e)); }
        });
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({ port: addr.port, close: () => server.close() });
    });
    server.on('error', reject);
  });
}
