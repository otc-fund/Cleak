# Sprint 1 — Foundation: Bridge + Skeleton — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an Electron desktop app that spawns cleak as a child process, talks to it via the SDK NDJSON protocol, routes inference through `http://localhost:3003/v1` (qwen3.6-plus), and renders a one-line streamed reply to a user message. The app auto-restarts the cleak child on crash and surfaces protocol mismatches in the status bar.

**Architecture:** Electron + electron-vite (main / preload / renderer). The main process owns the SDK child — for S1 this is the locally-installed `claude.exe` (Claude Code CLI), since the cleak source is a non-runnable code dump (see spec § 2.1a). Spawned via `claude.exe --print --verbose --bare --input-format stream-json --output-format stream-json --permission-mode bypassPermissions`. Stdio carries NDJSON. A typed `BridgeClient` in main parses stream-JSON events with Zod and forwards them over `ipcMain` channels to the renderer. The renderer is React + Tailwind + Zustand; one chat store consumes events and a single `ChatView` renders streamed text.

**Tech Stack:** TypeScript • Electron 31+ • electron-vite • React 18 • Vite 5 • Tailwind 3 • Zustand 4 • Zod 3 • Vitest 1 • `claude.exe` (Claude Code CLI as SDK backend).

**Spike findings (2026-04-27):** Task 0 confirmed the wire format with the real `claude.exe`. Key quirks the rest of this plan bakes in:
- The bare `claude` command on PATH is a WindowsApps shim that swallows stdout under redirection. Use the explicit binary path: `C:\Users\Administrator\.local\bin\claude.exe` (configurable via `CLAUDE_BIN`).
- `--output-format stream-json` requires `--verbose`.
- `--bare` keeps hook frames out of the stream — without it we get `system.subtype=hook_started` / `hook_response` interleaved with assistant frames. We default to `--bare` for S1.
- The child can exit non-zero even on a clean protocol round trip (e.g. when the upstream returns 403). Read the `result` frame, don't trust the exit code alone.
- Assistant frames may carry `error: { ... }` (auth failures) and `model: "<synthetic>"`. Schemas use `.passthrough()` and treat these as optional.
- Result frames carry many more fields than originally schemed (`api_error_status`, `duration_api_ms`, `num_turns`, `modelUsage`, `permission_denials`, `terminal_reason`, `fast_mode_state`). Schema is permissive.
- Upstream auth: `localhost:3003` returned 403 for the supplied API key during the spike. Task 11 (manual smoke) is gated on resolving this; protocol-level tests (1–10) are not.

**Spec reference:** `docs/superpowers/specs/2026-04-27-cleak-gui-design.md` § 4 / S1.

---

## File structure

All paths below are inside the new `D:\cleak2\gui\` directory unless stated otherwise.

```
gui/
├── package.json
├── tsconfig.json                 // shared compiler options
├── tsconfig.node.json            // for vite/electron config files
├── electron.vite.config.ts
├── tailwind.config.cjs
├── postcss.config.cjs
├── .gitignore
├── .env.example
├── README.md
├── electron-builder.yml          // (placeholder for S18; not used yet)
├── src/
│   ├── main/
│   │   ├── index.ts              // Electron main entry: window + bridge wiring
│   │   ├── cleakProtocol.ts      // Zod schemas for stream-json messages
│   │   ├── ndjson.ts             // line-buffered JSON splitter
│   │   ├── bridge.ts             // CleakBridge: spawn, restart, send/recv
│   │   └── ipc.ts                // ipcMain channel definitions + types
│   ├── preload/
│   │   └── index.ts              // contextBridge API surface
│   └── renderer/
│       ├── index.html
│       ├── main.tsx              // React entry
│       ├── App.tsx               // composes ChatView + StatusBar + MessageInput
│       ├── styles.css            // tailwind base imports
│       ├── lib/
│       │   └── bridge.ts         // typed wrapper around window.bridge
│       ├── store/
│       │   └── chat.ts           // Zustand store for messages + bridge status
│       └── components/
│           ├── ChatView.tsx
│           ├── MessageInput.tsx
│           └── StatusBar.tsx
└── tests/
    ├── ndjson.test.ts
    ├── cleakProtocol.test.ts
    └── bridge.test.ts            // uses a fake child for restart logic
```

Each module owns one responsibility: protocol parsing in `cleakProtocol.ts`, line splitting in `ndjson.ts`, child-process lifecycle in `bridge.ts`, IPC plumbing in `ipc.ts`. Renderer modules are mirror images: `lib/bridge.ts` is the only thing that touches `window.bridge`; `store/chat.ts` is the only consumer of bridge events.

---

## Pre-flight: verify SDK invocation works on this box

### Task 0: Spike — run claude.exe directly to confirm CLI shape ✅ COMPLETE

Spike completed 2026-04-27. Findings folded into the plan header above and into Task 4 / Task 6 schemas + argv. Captured artifacts at `C:\Users\Administrator\AppData\Local\Temp\cleak-spike-I9lbZ8\` (input.ndjson, stdout.ndjson, stderr.txt). Outstanding: 403 auth from `localhost:3003`, gates Task 11 only.

---

## Task 1: Project scaffold

**Files:**
- Create: `gui/package.json`
- Create: `gui/tsconfig.json`
- Create: `gui/tsconfig.node.json`
- Create: `gui/.gitignore`
- Create: `gui/.env.example`
- Create: `gui/electron.vite.config.ts`
- Create: `gui/tailwind.config.cjs`
- Create: `gui/postcss.config.cjs`
- Create: `gui/README.md`

- [ ] **Step 1: Create `gui/` and write `package.json`**

```json
{
  "name": "cleak-gui",
  "version": "0.1.0",
  "private": true,
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.17",
    "electron": "^31.0.0",
    "electron-vite": "^2.1.0",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.4.0",
    "vite": "^5.1.0",
    "vitest": "^1.4.0"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zod": "^3.22.0",
    "zustand": "^4.5.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "isolatedModules": true,
    "resolveJsonModule": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node", "vitest/globals"],
    "baseUrl": ".",
    "paths": {
      "@main/*": ["src/main/*"],
      "@renderer/*": ["src/renderer/*"]
    }
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Write `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["electron.vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules
out
dist
.env
*.log
.vite
```

- [ ] **Step 5: Write `.env.example`**

```
# Inference upstream (forwarded to the SDK child process)
ANTHROPIC_BASE_URL=http://localhost:3003/v1
ANTHROPIC_API_KEY=pk_REPLACE_ME
ANTHROPIC_MODEL=qwen3.6-plus

# Path to the Claude Code CLI binary used as the SDK backend for S1.
# IMPORTANT: use the explicit .exe path, not bare `claude` — the WindowsApps
# shim swallows stdout under redirection.
CLAUDE_BIN=C:\Users\Administrator\.local\bin\claude.exe
```

- [ ] **Step 6: Write `electron.vite.config.ts`**

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: resolve(__dirname, 'src/main/index.ts') },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: resolve(__dirname, 'src/preload/index.ts') },
    },
  },
  renderer: {
    plugins: [react()],
    resolve: { alias: { '@renderer': resolve(__dirname, 'src/renderer') } },
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') },
    },
  },
});
```

- [ ] **Step 7: Write `tailwind.config.cjs`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 8: Write `postcss.config.cjs`**

```js
module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 9: Write `README.md`**

```markdown
# Cleak GUI

Electron desktop GUI for the cleak coding assistant.

## Prerequisites
- Node.js 20+
- Bun (cleak runs on Bun)
- A running OpenAI-compatible endpoint at `http://localhost:3003/v1` serving `qwen3.6-plus`

## Setup
```bash
cd gui
npm install
cp .env.example .env  # then edit ANTHROPIC_API_KEY
npm run dev
```

## Layout
- `src/main` — Electron main process, owns the cleak child
- `src/preload` — exposes a typed bridge to the renderer
- `src/renderer` — React UI
- `tests` — Vitest unit tests
```

- [ ] **Step 10: Install dependencies**

Run from `gui/`:
```bash
npm install
```
Expected: clean install. Tolerate peer warnings.

- [ ] **Step 11: Commit**

```bash
git init   # only if D:\cleak2 is not yet a repo
git add gui/package.json gui/tsconfig*.json gui/.gitignore gui/.env.example \
  gui/electron.vite.config.ts gui/tailwind.config.cjs gui/postcss.config.cjs gui/README.md
git commit -m "feat(gui): scaffold electron-vite + tailwind project"
```

---

## Task 2: Vitest config + first sanity test

**Files:**
- Create: `gui/vitest.config.ts`
- Create: `gui/tests/smoke.test.ts`

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@renderer': resolve(__dirname, 'src/renderer'),
    },
  },
});
```

- [ ] **Step 2: Write `tests/smoke.test.ts`**

```ts
import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: 1 test, 1 passed.

- [ ] **Step 4: Commit**

```bash
git add gui/vitest.config.ts gui/tests/smoke.test.ts
git commit -m "test(gui): add vitest config and smoke test"
```

---

## Task 3: NDJSON line splitter (TDD)

**Files:**
- Create: `gui/tests/ndjson.test.ts`
- Create: `gui/src/main/ndjson.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/ndjson.test.ts
import { describe, expect, it } from 'vitest';
import { NdjsonSplitter } from '../src/main/ndjson';

describe('NdjsonSplitter', () => {
  it('emits one object per newline-terminated line', () => {
    const out: unknown[] = [];
    const s = new NdjsonSplitter((v) => out.push(v));
    s.feed(Buffer.from('{"a":1}\n{"b":2}\n'));
    expect(out).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('buffers partial lines across feeds', () => {
    const out: unknown[] = [];
    const s = new NdjsonSplitter((v) => out.push(v));
    s.feed(Buffer.from('{"a":'));
    s.feed(Buffer.from('1}\n'));
    expect(out).toEqual([{ a: 1 }]);
  });

  it('reports parse errors via onError without aborting the stream', () => {
    const out: unknown[] = [];
    const errs: string[] = [];
    const s = new NdjsonSplitter(
      (v) => out.push(v),
      (e) => errs.push(e.line),
    );
    s.feed(Buffer.from('not json\n{"ok":true}\n'));
    expect(out).toEqual([{ ok: true }]);
    expect(errs).toEqual(['not json']);
  });

  it('ignores empty lines', () => {
    const out: unknown[] = [];
    const s = new NdjsonSplitter((v) => out.push(v));
    s.feed(Buffer.from('\n{"a":1}\n\n'));
    expect(out).toEqual([{ a: 1 }]);
  });
});
```

- [ ] **Step 2: Run the test, watch it fail**

Run: `npm test -- ndjson`
Expected: FAIL — `Cannot find module '../src/main/ndjson'`.

- [ ] **Step 3: Implement the splitter**

```ts
// src/main/ndjson.ts
export interface NdjsonError {
  line: string;
  cause: unknown;
}

export class NdjsonSplitter {
  private buf = '';

  constructor(
    private readonly onValue: (value: unknown) => void,
    private readonly onError?: (err: NdjsonError) => void,
  ) {}

  feed(chunk: Buffer | string): void {
    this.buf += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    let nl: number;
    while ((nl = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, nl).trimEnd();
      this.buf = this.buf.slice(nl + 1);
      if (line.length === 0) continue;
      try {
        this.onValue(JSON.parse(line));
      } catch (cause) {
        this.onError?.({ line, cause });
      }
    }
  }
}
```

- [ ] **Step 4: Run tests, watch them pass**

Run: `npm test -- ndjson`
Expected: 4 tests, 4 passed.

- [ ] **Step 5: Commit**

```bash
git add gui/tests/ndjson.test.ts gui/src/main/ndjson.ts
git commit -m "feat(gui): NDJSON line splitter with partial-line buffering"
```

---

## Task 4: Cleak protocol Zod schemas (TDD)

**Files:**
- Create: `gui/tests/cleakProtocol.test.ts`
- Create: `gui/src/main/cleakProtocol.ts`

We model the **minimum** subset of cleak's stream-json protocol needed for S1: outbound `user` messages, inbound `system`/`assistant`/`result` frames. Subsequent sprints extend this file. Use the actual frames captured in Task 0 Step 4 to confirm field shapes; the schemas below are accurate to the format documented in cleak's SDK schemas.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run, watch it fail**

Run: `npm test -- cleakProtocol`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the schemas**

```ts
// src/main/cleakProtocol.ts
import { z } from 'zod';

const TextBlock = z.object({ type: z.literal('text'), text: z.string() });
const ThinkingBlock = z.object({
  type: z.literal('thinking'),
  thinking: z.string(),
});
const ToolUseBlock = z.object({
  type: z.literal('tool_use'),
  id: z.string(),
  name: z.string(),
  input: z.unknown(),
});
const ToolResultBlock = z.object({
  type: z.literal('tool_result'),
  tool_use_id: z.string(),
  content: z.unknown(),
  is_error: z.boolean().optional(),
});

const ContentBlock = z.discriminatedUnion('type', [
  TextBlock,
  ThinkingBlock,
  ToolUseBlock,
  ToolResultBlock,
]);

export const SystemFrame = z.object({
  type: z.literal('system'),
  subtype: z.string(),
  session_id: z.string().optional(),
  tools: z.array(z.unknown()).optional(),
  mcp_servers: z.array(z.unknown()).optional(),
}).passthrough();

export const AssistantFrame = z.object({
  type: z.literal('assistant'),
  session_id: z.string().optional(),
  message: z.object({
    role: z.literal('assistant'),
    content: z.union([z.string(), z.array(ContentBlock)]),
    model: z.string().optional(), // can be "<synthetic>" on errors
  }).passthrough(),
  error: z.object({ type: z.string() }).passthrough().optional(),
}).passthrough();

export const UserFrame = z.object({
  type: z.literal('user'),
  session_id: z.string().optional(),
  message: z.object({
    role: z.literal('user'),
    content: z.union([z.string(), z.array(ContentBlock)]),
  }),
}).passthrough();

export const ResultFrame = z.object({
  type: z.literal('result'),
  subtype: z.string(),
  is_error: z.boolean(),
  session_id: z.string().optional(),
  duration_ms: z.number().optional(),
  duration_api_ms: z.number().optional(),
  total_cost_usd: z.number().optional(),
  num_turns: z.number().optional(),
  api_error_status: z.number().optional(),
  terminal_reason: z.string().optional(),
  modelUsage: z.record(z.unknown()).optional(),
  permission_denials: z.array(z.unknown()).optional(),
  fast_mode_state: z.unknown().optional(),
  result: z.string().optional(),
}).passthrough();

export const CleakInboundFrame = z.discriminatedUnion('type', [
  SystemFrame,
  AssistantFrame,
  UserFrame,
  ResultFrame,
]);
export type CleakInboundFrame = z.infer<typeof CleakInboundFrame>;

export interface OutboundUserFrame {
  type: 'user';
  message: { role: 'user'; content: string };
}

export function buildUserFrame(text: string): OutboundUserFrame {
  return { type: 'user', message: { role: 'user', content: text } };
}
```

- [ ] **Step 4: Run, watch them pass**

Run: `npm test -- cleakProtocol`
Expected: 5 tests, 5 passed.

- [ ] **Step 5: Reconcile against Task 0 captures**

Open the JSON frames captured in Task 0 Step 4. For each, re-run the corresponding `safeParse` in a one-off script or REPL. If any frame fails, extend the schemas with the missing optional field (use `.passthrough()` is already in place to accept extras, but discriminator fields must be exact). Re-run tests.

- [ ] **Step 6: Commit**

```bash
git add gui/tests/cleakProtocol.test.ts gui/src/main/cleakProtocol.ts
git commit -m "feat(gui): zod schemas for cleak stream-json frames"
```

---

## Task 5: IPC channel definitions

**Files:**
- Create: `gui/src/main/ipc.ts`

This defines the typed surface between main and preload. Pulled out so renderer types stay in sync.

- [ ] **Step 1: Write `ipc.ts`**

```ts
// src/main/ipc.ts
import type { CleakInboundFrame } from './cleakProtocol';

export type BridgeStatus =
  | { kind: 'starting' }
  | { kind: 'running'; sessionId?: string; protocolOk: boolean }
  | { kind: 'restarting'; reason: string; attempt: number }
  | { kind: 'stopped'; reason: string };

export interface BridgeEventMap {
  status: BridgeStatus;
  frame: CleakInboundFrame;
  error: { message: string };
}

export const IpcChannels = {
  sendUserMessage: 'bridge:sendUserMessage',
  status: 'bridge:status',
  frame: 'bridge:frame',
  error: 'bridge:error',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add gui/src/main/ipc.ts
git commit -m "feat(gui): typed IPC channel definitions"
```

---

## Task 5b: Anthropic→OpenAI translation shim (TDD)

**Context:** `localhost:3003` exposes an OpenAI-compatible `/chat/completions` endpoint only. `claude.exe` speaks the Anthropic Messages API (`POST /v1/messages`). This task creates a thin localhost HTTP server that lives inside the Electron main process, accepts Anthropic-format calls, translates them to OpenAI format, proxies to the real upstream, and streams the response back in Anthropic SSE format. `claude.exe` gets `ANTHROPIC_BASE_URL=http://localhost:{shimPort}` so it never knows the difference.

**Files:**
- Create: `gui/tests/anthropicShim.test.ts`
- Create: `gui/src/main/anthropicShim.ts`

### Format mappings

**Request — Anthropic → OpenAI:**

| Anthropic field | OpenAI field |
|---|---|
| `model` | replaced by configured `model` |
| `messages` | `messages` (same structure) |
| `max_tokens` | `max_tokens` |
| `temperature` | `temperature` |
| `stream` | `stream` |
| `system` (string) | prepend `{role:"system", content: system}` to messages |
| `tools` (Anthropic format) | **S1: pass through as-is; full tool translation in S3** |

**Response streaming — OpenAI SSE chunk → Anthropic SSE events:**

OpenAI sends `data: {choices:[{delta:{content:"..."}}]}` chunks. Map these to Anthropic's event stream:

1. **On first chunk** (before or when `delta.role === "assistant"`): emit:
   - `event: message_start` with a synthetic message object
   - `event: content_block_start` for index 0
2. **On each content chunk**: emit `event: content_block_delta` with `text_delta`
3. **On finish chunk** (`choices[0].finish_reason` non-null): emit:
   - `event: content_block_stop`
   - `event: message_delta` with `stop_reason: "end_turn"`
   - `event: message_stop`
4. **On `data: [DONE]`**: close the response

- [ ] **Step 1: Write the failing tests**

```ts
// tests/anthropicShim.test.ts
import { describe, expect, it, afterAll } from 'vitest';
import http from 'node:http';
import { createAnthropicShim } from '../src/main/anthropicShim';

// Minimal fake upstream OpenAI server
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
      { hostname: u.hostname, port: Number(u.port), path: u.pathname, method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(raw) } },
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
      { hostname: u.hostname, port: Number(u.port), path: u.pathname, method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(raw) } },
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
      // OpenAI-side request should have the configured model, not the requested one
      expect((captured as { model: string }).model).toBe('gpt-test');
      // Response should be Anthropic-shaped
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
      // Check text accumulation
      const dataLines = lines.filter((l) => l.startsWith('data:'));
      const deltas = dataLines
        .map((l) => { try { return JSON.parse(l.slice(5)); } catch { return null; } })
        .filter((d) => d?.type === 'content_block_delta');
      const text = deltas.map((d: { delta: { text: string } }) => d.delta.text).join('');
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
```

- [ ] **Step 2: Run, watch it fail**

Run: `npm test -- anthropicShim`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the shim**

```ts
// src/main/anthropicShim.ts
import http from 'node:http';

export interface ShimConfig {
  upstreamBaseUrl: string;  // e.g. http://localhost:3003/v1
  upstreamApiKey: string;
  model: string;
}

export interface ShimHandle {
  port: number;
  close: () => void;
}

// Minimal Anthropic-format message type
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

function buildOpenAIBody(req: AnthropicRequest, model: string) {
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

async function proxyNonStreaming(
  body: Record<string, unknown>,
  cfg: ShimConfig,
  res: http.ServerResponse,
): Promise<void> {
  const raw = JSON.stringify(body);
  const u = new URL(`${cfg.upstreamBaseUrl}/chat/completions`);
  await new Promise<void>((resolve, reject) => {
    const oaiReq = http.request(
      {
        hostname: u.hostname, port: Number(u.port),
        path: u.pathname + u.search, method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(raw),
          authorization: `Bearer ${cfg.upstreamApiKey}`,
        },
      },
      (oaiRes) => {
        let buf = '';
        oaiRes.on('data', (c: Buffer) => (buf += c.toString()));
        oaiRes.on('end', () => {
          try {
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
          } catch (e) {
            res.writeHead(502);
            res.end(String(e));
          }
          resolve();
        });
        oaiRes.on('error', reject);
      },
    );
    oaiReq.on('error', reject);
    oaiReq.write(raw);
    oaiReq.end();
  });
}

async function proxyStreaming(
  body: Record<string, unknown>,
  cfg: ShimConfig,
  res: http.ServerResponse,
): Promise<void> {
  const raw = JSON.stringify(body);
  const u = new URL(`${cfg.upstreamBaseUrl}/chat/completions`);
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });

  const msgId = `msg_${Date.now()}`;
  let headerSent = false;

  await new Promise<void>((resolve, reject) => {
    const oaiReq = http.request(
      {
        hostname: u.hostname, port: Number(u.port),
        path: u.pathname + u.search, method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(raw),
          authorization: `Bearer ${cfg.upstreamApiKey}`,
        },
      },
      (oaiRes) => {
        let buf = '';
        oaiRes.on('data', (chunk: Buffer) => {
          buf += chunk.toString();
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
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
              const chunk = JSON.parse(payload) as {
                choices?: { delta?: { role?: string; content?: string }; finish_reason?: string | null }[];
              };
              const delta = chunk.choices?.[0]?.delta;
              if (!delta) continue;

              if (!headerSent) {
                headerSent = true;
                res.write(sseEvent('message_start', {
                  type: 'message_start',
                  message: { id: msgId, type: 'message', role: 'assistant', content: [], model: cfg.model,
                    stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } },
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
            } catch { /* skip malformed */ }
          }
        });
        oaiRes.on('end', () => {
          res.end();
          resolve();
        });
        oaiRes.on('error', reject);
      },
    );
    oaiReq.on('error', reject);
    oaiReq.write(raw);
    oaiReq.end();
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
      resolve({
        port: addr.port,
        close: () => server.close(),
      });
    });

    server.on('error', reject);
  });
}
```

- [ ] **Step 4: Run tests, watch them pass**

Run: `npm test -- anthropicShim`
Expected: 3 tests, 3 passed.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add gui/tests/anthropicShim.test.ts gui/src/main/anthropicShim.ts
git commit -m "feat(gui): Anthropic-to-OpenAI translation shim for localhost:3003"
```

---

## Task 6: CleakBridge — spawn + stream parsing (TDD with fake spawner)

**Files:**
- Create: `gui/tests/bridge.test.ts`
- Create: `gui/src/main/bridge.ts`

We test bridge logic by injecting a `spawn` function instead of using real `child_process.spawn`. This keeps tests fast and deterministic.

- [ ] **Step 1: Write the failing test**

```ts
// tests/bridge.test.ts
import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { CleakBridge, type SpawnFn } from '../src/main/bridge';

class FakeChild extends EventEmitter {
  stdout = new Readable({ read() {} });
  stderr = new Readable({ read() {} });
  stdin: Writable;
  killed = false;
  constructor() {
    super();
    const self = this;
    this.stdin = new Writable({
      write(chunk, _enc, cb) {
        self.emit('stdin-write', chunk.toString('utf8'));
        cb();
      },
    });
  }
  kill() {
    this.killed = true;
    this.emit('exit', 0, null);
    return true;
  }
}

function makeSpawn(child: FakeChild): SpawnFn {
  return vi.fn(() => child as never);
}

describe('CleakBridge', () => {
  it('emits status running after a system init frame arrives', async () => {
    const child = new FakeChild();
    const events: unknown[] = [];
    const bridge = new CleakBridge({
      spawn: makeSpawn(child),
      cwd: '/tmp',
      env: {},
      claudeBin: 'C:/fake/claude.exe',
    });
    bridge.on('status', (s) => events.push(['status', s]));
    bridge.start();
    child.stdout.push(
      '{"type":"system","subtype":"init","session_id":"s-1","tools":[],"mcp_servers":[]}\n',
    );
    await new Promise((r) => setImmediate(r));
    expect(events).toEqual([
      ['status', { kind: 'starting' }],
      ['status', { kind: 'running', sessionId: 's-1', protocolOk: true }],
    ]);
  });

  it('forwards parsed frames as `frame` events', async () => {
    const child = new FakeChild();
    const frames: unknown[] = [];
    const bridge = new CleakBridge({
      spawn: makeSpawn(child),
      cwd: '/tmp',
      env: {},
      claudeBin: 'C:/fake/claude.exe',
    });
    bridge.on('frame', (f) => frames.push(f));
    bridge.start();
    child.stdout.push(
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"hi"}]},"session_id":"s-1"}\n',
    );
    await new Promise((r) => setImmediate(r));
    expect(frames).toHaveLength(1);
  });

  it('writes outbound user frames to the child stdin as NDJSON', async () => {
    const child = new FakeChild();
    const writes: string[] = [];
    child.on('stdin-write', (s: string) => writes.push(s));
    const bridge = new CleakBridge({
      spawn: makeSpawn(child),
      cwd: '/tmp',
      env: {},
      claudeBin: 'C:/fake/claude.exe',
    });
    bridge.start();
    bridge.sendUserMessage('hello');
    await new Promise((r) => setImmediate(r));
    expect(writes).toEqual([
      '{"type":"user","message":{"role":"user","content":"hello"}}\n',
    ]);
  });

  it('restarts on unexpected exit with backoff up to maxAttempts', async () => {
    let n = 0;
    const spawn: SpawnFn = vi.fn(() => {
      n++;
      const c = new FakeChild();
      // Schedule an immediate crash on next tick
      setImmediate(() => c.emit('exit', 1, null));
      return c as never;
    });
    const events: unknown[] = [];
    const bridge = new CleakBridge({
      spawn,
      cwd: '/tmp',
      env: {},
      claudeBin: 'C:/fake/claude.exe',
      restart: { maxAttempts: 2, baseDelayMs: 0 },
    });
    bridge.on('status', (s) => events.push(s));
    bridge.start();
    // Drain the loop
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
    expect(n).toBe(3); // initial + 2 restarts
    const stopped = events[events.length - 1] as { kind: string };
    expect(stopped.kind).toBe('stopped');
  });
});
```

- [ ] **Step 2: Run, watch it fail**

Run: `npm test -- bridge`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the bridge**

```ts
// src/main/bridge.ts
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { CleakInboundFrame, buildUserFrame } from './cleakProtocol';
import { NdjsonSplitter } from './ndjson';
import type { BridgeStatus } from './ipc';

export type SpawnFn = (
  cmd: string,
  args: readonly string[],
  opts: { cwd: string; env: NodeJS.ProcessEnv; stdio: 'pipe' },
) => ChildProcess;

export interface BridgeOptions {
  spawn: SpawnFn;
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** Absolute path to the Claude Code CLI binary (claude.exe on Windows). */
  claudeBin: string;
  bypassPermissions?: boolean;
  restart?: { maxAttempts: number; baseDelayMs: number };
}

export class CleakBridge extends EventEmitter {
  private child: ChildProcess | null = null;
  private splitter = new NdjsonSplitter(
    (v) => this.handleFrame(v),
    (e) => this.emit('error', { message: `parse error: ${e.line}` }),
  );
  private stoppedByUs = false;
  private attempt = 0;

  constructor(private readonly opts: BridgeOptions) {
    super();
  }

  start(): void {
    this.stoppedByUs = false;
    this.spawnChild();
  }

  stop(): void {
    this.stoppedByUs = true;
    this.child?.kill();
  }

  sendUserMessage(text: string): void {
    if (!this.child?.stdin) return;
    const frame = buildUserFrame(text);
    this.child.stdin.write(JSON.stringify(frame) + '\n');
  }

  private spawnChild(): void {
    this.setStatus({ kind: 'starting' });
    const args = [
      '--print',
      '--verbose',
      '--bare',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
    ];
    if (this.opts.bypassPermissions !== false) {
      args.push('--permission-mode', 'bypassPermissions');
    }
    const child = this.opts.spawn(this.opts.claudeBin, args, {
      cwd: this.opts.cwd,
      env: this.opts.env,
      stdio: 'pipe',
    });
    this.child = child;
    child.stdout?.on('data', (b: Buffer) => this.splitter.feed(b));
    child.stderr?.on('data', (b: Buffer) =>
      this.emit('error', { message: `stderr: ${b.toString('utf8')}` }),
    );
    child.on('exit', (code) => this.handleExit(code ?? -1));
  }

  private handleFrame(value: unknown): void {
    const parsed = CleakInboundFrame.safeParse(value);
    if (!parsed.success) {
      this.emit('error', { message: `unrecognized frame: ${parsed.error.message}` });
      this.setStatus({
        kind: 'running',
        sessionId: undefined,
        protocolOk: false,
      });
      return;
    }
    const frame = parsed.data;
    this.emit('frame', frame);
    if (frame.type === 'system' && frame.subtype === 'init') {
      this.attempt = 0;
      this.setStatus({
        kind: 'running',
        sessionId: frame.session_id,
        protocolOk: true,
      });
    }
  }

  private handleExit(code: number): void {
    const { maxAttempts = 3, baseDelayMs = 500 } = this.opts.restart ?? {};
    if (this.stoppedByUs) {
      this.setStatus({ kind: 'stopped', reason: 'user' });
      return;
    }
    if (this.attempt >= maxAttempts) {
      this.setStatus({
        kind: 'stopped',
        reason: `child exited (code=${code}); max restart attempts reached`,
      });
      return;
    }
    this.attempt += 1;
    const delay = baseDelayMs * 2 ** (this.attempt - 1);
    this.setStatus({
      kind: 'restarting',
      reason: `child exited (code=${code})`,
      attempt: this.attempt,
    });
    setTimeout(() => this.spawnChild(), delay);
  }

  private setStatus(s: BridgeStatus): void {
    this.emit('status', s);
  }
}
```

- [ ] **Step 4: Run, watch them pass**

Run: `npm test -- bridge`
Expected: 4 tests, 4 passed.

- [ ] **Step 5: Commit**

```bash
git add gui/tests/bridge.test.ts gui/src/main/bridge.ts
git commit -m "feat(gui): cleak bridge — spawn, frame parsing, restart-with-backoff"
```

---

## Task 7: Preload script

**Files:**
- Create: `gui/src/preload/index.ts`
- Create: `gui/src/renderer/global.d.ts`

- [ ] **Step 1: Write `src/preload/index.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../main/ipc';
import type { BridgeStatus, BridgeEventMap } from '../main/ipc';
import type { CleakInboundFrame } from '../main/cleakProtocol';

const api = {
  sendUserMessage(text: string): void {
    ipcRenderer.send(IpcChannels.sendUserMessage, text);
  },
  onStatus(handler: (s: BridgeStatus) => void): () => void {
    const wrapped = (_e: unknown, s: BridgeStatus) => handler(s);
    ipcRenderer.on(IpcChannels.status, wrapped);
    return () => ipcRenderer.off(IpcChannels.status, wrapped);
  },
  onFrame(handler: (f: CleakInboundFrame) => void): () => void {
    const wrapped = (_e: unknown, f: CleakInboundFrame) => handler(f);
    ipcRenderer.on(IpcChannels.frame, wrapped);
    return () => ipcRenderer.off(IpcChannels.frame, wrapped);
  },
  onError(handler: (e: BridgeEventMap['error']) => void): () => void {
    const wrapped = (_e: unknown, p: BridgeEventMap['error']) => handler(p);
    ipcRenderer.on(IpcChannels.error, wrapped);
    return () => ipcRenderer.off(IpcChannels.error, wrapped);
  },
};

export type BridgeApi = typeof api;
contextBridge.exposeInMainWorld('bridge', api);
```

- [ ] **Step 2: Write `src/renderer/global.d.ts`**

```ts
import type { BridgeApi } from '../preload';

declare global {
  interface Window {
    bridge: BridgeApi;
  }
}
export {};
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add gui/src/preload/index.ts gui/src/renderer/global.d.ts
git commit -m "feat(gui): preload contextBridge API"
```

---

## Task 8: Electron main entry — wire bridge ↔ ipcMain ↔ window

**Files:**
- Create: `gui/src/main/index.ts`

- [ ] **Step 1: Write `src/main/index.ts`**

```ts
import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn as nodeSpawn } from 'node:child_process';
import { resolve } from 'node:path';
import { CleakBridge } from './bridge';
import { IpcChannels } from './ipc';
import type { BridgeStatus } from './ipc';
import type { CleakInboundFrame } from './cleakProtocol';
// Note: anthropicShim is imported dynamically inside createWindow to avoid
// loading the http server before app.whenReady resolves.

const isDev = !app.isPackaged;

function buildEnv(shimPort: number): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  // Point claude.exe at the local translation shim, not the OpenAI server directly.
  // The shim accepts Anthropic Messages API and forwards as OpenAI chat completions.
  env['ANTHROPIC_BASE_URL'] = `http://127.0.0.1:${shimPort}`;
  env['ANTHROPIC_API_KEY'] = 'shim-passthrough'; // shim uses its own key
  if (process.env['ANTHROPIC_MODEL']) env['ANTHROPIC_MODEL'] = process.env['ANTHROPIC_MODEL'];
  return env;
}

function resolveClaudeBin(): string {
  const fromEnv = process.env.CLAUDE_BIN;
  if (fromEnv) return fromEnv;
  // Default to the explicit Windows binary path. The bare `claude` command on
  // PATH is a WindowsApps shim that swallows stdout under pipe redirection.
  return 'C:\\Users\\Administrator\\.local\\bin\\claude.exe';
}

function resolveSdkCwd(): string {
  // Project root (parent of gui/). The SDK child runs there so any file ops
  // it does are scoped to the project tree.
  return resolve(app.getAppPath(), '..');
}

async function createWindow(): Promise<void> {
  // Start the Anthropic→OpenAI shim before creating the window so the bridge
  // can point claude.exe at the shim port on startup.
  const { createAnthropicShim } = await import('./anthropicShim');
  const shim = await createAnthropicShim({
    upstreamBaseUrl: process.env['ANTHROPIC_BASE_URL'] ?? 'http://localhost:3003/v1',
    upstreamApiKey: process.env['ANTHROPIC_API_KEY'] ?? '',
    model: process.env['ANTHROPIC_MODEL'] ?? 'qwen3.6-plus',
  });

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#0b0b0b',
    webPreferences: {
      preload: resolve(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    await win.loadURL(process.env.ELECTRON_RENDERER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(resolve(__dirname, '../renderer/index.html'));
  }

  const bridge = new CleakBridge({
    spawn: nodeSpawn as never,
    cwd: resolveSdkCwd(),
    env: buildEnv(shim.port),
    claudeBin: resolveClaudeBin(),
  });

  bridge.on('status', (s: BridgeStatus) => {
    if (!win.isDestroyed()) win.webContents.send(IpcChannels.status, s);
  });
  bridge.on('frame', (f: CleakInboundFrame) => {
    if (!win.isDestroyed()) win.webContents.send(IpcChannels.frame, f);
  });
  bridge.on('error', (e: { message: string }) => {
    if (!win.isDestroyed()) win.webContents.send(IpcChannels.error, e);
  });

  ipcMain.on(IpcChannels.sendUserMessage, (_e, text: string) => {
    bridge.sendUserMessage(text);
  });

  bridge.start();

  win.on('closed', () => { bridge.stop(); shim.close(); });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add gui/src/main/index.ts
git commit -m "feat(gui): electron main wires bridge to ipcMain and window"
```

---

## Task 9: Renderer chat store

**Files:**
- Create: `gui/src/renderer/store/chat.ts`

- [ ] **Step 1: Write the store**

```ts
// src/renderer/store/chat.ts
import { create } from 'zustand';
import type { BridgeStatus } from '../../main/ipc';
import type { CleakInboundFrame } from '../../main/cleakProtocol';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  pending: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  status: BridgeStatus;
  errors: string[];
  appendUser(text: string): void;
  ingestFrame(frame: CleakInboundFrame): void;
  setStatus(s: BridgeStatus): void;
  pushError(message: string): void;
}

function nextId(): string {
  return Math.random().toString(36).slice(2);
}

function extractAssistantText(frame: CleakInboundFrame): string {
  if (frame.type !== 'assistant') return '';
  const c = frame.message.content;
  if (typeof c === 'string') return c;
  return c
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

export const useChat = create<ChatState>((set) => ({
  messages: [],
  status: { kind: 'starting' },
  errors: [],
  appendUser(text) {
    set((s) => ({
      messages: [
        ...s.messages,
        { id: nextId(), role: 'user', text, pending: false },
        { id: nextId(), role: 'assistant', text: '', pending: true },
      ],
    }));
  },
  ingestFrame(frame) {
    if (frame.type === 'assistant') {
      const piece = extractAssistantText(frame);
      set((s) => {
        const msgs = [...s.messages];
        const tail = msgs[msgs.length - 1];
        if (tail && tail.role === 'assistant' && tail.pending) {
          msgs[msgs.length - 1] = { ...tail, text: tail.text + piece };
        } else {
          msgs.push({ id: nextId(), role: 'assistant', text: piece, pending: true });
        }
        return { messages: msgs };
      });
    } else if (frame.type === 'result') {
      set((s) => {
        const msgs = [...s.messages];
        const tail = msgs[msgs.length - 1];
        if (tail && tail.role === 'assistant' && tail.pending) {
          msgs[msgs.length - 1] = { ...tail, pending: false };
        }
        return { messages: msgs };
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
```

- [ ] **Step 2: Add a focused unit test**

Create `gui/tests/chatStore.test.ts`:

```ts
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
```

- [ ] **Step 3: Run and pass**

Run: `npm test -- chatStore`
Expected: 3 tests, 3 passed.

> Note: this test imports zustand which uses `react`. Vitest's default `node` env is fine because zustand's vanilla store works without a DOM, and the `create` from `zustand` works in node. If you hit a `useSyncExternalStore` error, switch this single test file to use `import { createStore } from 'zustand/vanilla'` instead — but the default path should work.

- [ ] **Step 4: Commit**

```bash
git add gui/src/renderer/store/chat.ts gui/tests/chatStore.test.ts
git commit -m "feat(gui): chat store with streaming-aware ingestion"
```

---

## Task 10: Renderer components

**Files:**
- Create: `gui/src/renderer/styles.css`
- Create: `gui/src/renderer/index.html`
- Create: `gui/src/renderer/main.tsx`
- Create: `gui/src/renderer/App.tsx`
- Create: `gui/src/renderer/components/ChatView.tsx`
- Create: `gui/src/renderer/components/MessageInput.tsx`
- Create: `gui/src/renderer/components/StatusBar.tsx`
- Create: `gui/src/renderer/lib/bridge.ts`

- [ ] **Step 1: `styles.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { background: #0b0b0b; color: #e7e7e7; }
```

- [ ] **Step 2: `index.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Cleak</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: `main.tsx`**

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const el = document.getElementById('root')!;
createRoot(el).render(<App />);
```

- [ ] **Step 4: `lib/bridge.ts` — single touch-point for window.bridge**

```ts
// src/renderer/lib/bridge.ts
import { useEffect } from 'react';
import { useChat } from '../store/chat';

export function useBridgeWiring(): void {
  const setStatus = useChat((s) => s.setStatus);
  const ingest = useChat((s) => s.ingestFrame);
  const pushError = useChat((s) => s.pushError);
  useEffect(() => {
    const offS = window.bridge.onStatus(setStatus);
    const offF = window.bridge.onFrame(ingest);
    const offE = window.bridge.onError((e) => pushError(e.message));
    return () => {
      offS();
      offF();
      offE();
    };
  }, [setStatus, ingest, pushError]);
}

export function sendUser(text: string): void {
  window.bridge.sendUserMessage(text);
}
```

- [ ] **Step 5: `components/ChatView.tsx`**

```tsx
import React, { useEffect, useRef } from 'react';
import { useChat } from '../store/chat';

export function ChatView(): React.ReactElement {
  const messages = useChat((s) => s.messages);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [messages]);
  return (
    <div ref={ref} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
      {messages.map((m) => (
        <div
          key={m.id}
          className={
            m.role === 'user'
              ? 'whitespace-pre-wrap text-blue-300'
              : 'whitespace-pre-wrap text-zinc-100'
          }
        >
          <span className="text-xs uppercase tracking-wider text-zinc-500 mr-2">
            {m.role}
          </span>
          {m.text}
          {m.pending && <span className="animate-pulse">▍</span>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: `components/MessageInput.tsx`**

```tsx
import React, { useState } from 'react';
import { useChat } from '../store/chat';
import { sendUser } from '../lib/bridge';

export function MessageInput(): React.ReactElement {
  const [text, setText] = useState('');
  const status = useChat((s) => s.status);
  const appendUser = useChat((s) => s.appendUser);
  const disabled = status.kind !== 'running';
  const submit = (): void => {
    const t = text.trim();
    if (!t || disabled) return;
    appendUser(t);
    sendUser(t);
    setText('');
  };
  return (
    <div className="border-t border-zinc-800 p-3 flex gap-2">
      <textarea
        className="flex-1 bg-zinc-900 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-zinc-700"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={disabled ? 'Bridge not ready…' : 'Message cleak (Enter to send)'}
        disabled={disabled}
      />
      <button
        onClick={submit}
        disabled={disabled || !text.trim()}
        className="px-3 py-2 rounded bg-zinc-800 disabled:opacity-50 hover:bg-zinc-700"
      >
        Send
      </button>
    </div>
  );
}
```

- [ ] **Step 7: `components/StatusBar.tsx`**

```tsx
import React from 'react';
import { useChat } from '../store/chat';

function describe(s: ReturnType<typeof useChat.getState>['status']): string {
  switch (s.kind) {
    case 'starting':
      return 'starting…';
    case 'running':
      return s.protocolOk
        ? `running (session ${s.sessionId ?? '—'})`
        : 'running — protocol mismatch';
    case 'restarting':
      return `restarting (attempt ${s.attempt}): ${s.reason}`;
    case 'stopped':
      return `stopped: ${s.reason}`;
  }
}

export function StatusBar(): React.ReactElement {
  const status = useChat((s) => s.status);
  const lastError = useChat((s) => s.errors[s.errors.length - 1]);
  return (
    <div className="border-t border-zinc-800 px-3 py-1 text-xs flex justify-between text-zinc-400">
      <span>cleak: {describe(status)}</span>
      <span className="truncate max-w-[60%] text-right">
        {lastError ? `⚠ ${lastError}` : 'qwen3.6-plus @ localhost:3003'}
      </span>
    </div>
  );
}
```

- [ ] **Step 8: `App.tsx`**

```tsx
import React from 'react';
import { ChatView } from './components/ChatView';
import { MessageInput } from './components/MessageInput';
import { StatusBar } from './components/StatusBar';
import { useBridgeWiring } from './lib/bridge';

export default function App(): React.ReactElement {
  useBridgeWiring();
  return (
    <div className="flex flex-col h-full">
      <ChatView />
      <MessageInput />
      <StatusBar />
    </div>
  );
}
```

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add gui/src/renderer
git commit -m "feat(gui): minimal chat UI — input, streamed view, status bar"
```

---

## Task 11: Manual smoke test — full round trip

**Files:** none (verification).

- [ ] **Step 1: Set env**

In `gui/.env` (created by copying `.env.example`), confirm:
```
ANTHROPIC_BASE_URL=http://localhost:3003/v1
ANTHROPIC_API_KEY=pk_f160feb169e64ddfae00879e90c7a32a
ANTHROPIC_MODEL=qwen3.6-plus
CLAUDE_BIN=C:\Users\Administrator\.local\bin\claude.exe
```
electron-vite reads `.env` files automatically; if it doesn't pick them up in your install, prefix the dev command with the env values inline.

- [ ] **Step 2: Confirm the upstream LLM accepts the API key**

Run:
```bash
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" http://localhost:3003/v1/models
```
Expected: a non-error response listing models. **The Task 0 spike got a 403 "Invalid or inactive API key" with the supplied key — if you still see 403, fix the key/upstream before proceeding.** Without this the GUI will start, the bridge will report `running`, but every assistant frame will carry an `error` envelope and an empty reply.

- [ ] **Step 3: Launch the GUI**

Run from `gui/`: `npm run dev`
Expected: Electron window opens, status bar shows `starting…` then `running (session …)`.

- [ ] **Step 4: Send "hello"**

Type `hello` in the input, press Enter.
Expected: an assistant bubble appears and streams text. After completion the cursor (`▍`) disappears.

- [ ] **Step 5: Force a crash; observe restart**

In another shell, kill the SDK child (Task Manager → claude.exe, or `taskkill /F /IM claude.exe`).
Expected: status bar transitions `running → restarting (attempt 1) → running` within ~1s. Send another message; it should succeed.

- [ ] **Step 6: Capture a screenshot for the README**

Save as `gui/docs/screenshot-s1.png`. Add it to README under a "## Screenshot" section in the next task.

- [ ] **Step 7: No commit** — proceed to docs task.

---

## Task 12: Document & finalize sprint

**Files:**
- Modify: `gui/README.md`
- Create: `gui/docs/cleak-help.txt` (the dump from Task 0 step 2)
- Create: `gui/docs/wire-format-s1.md`

- [ ] **Step 1: Append a "Sprint 1 status" section to `README.md`**

Add at the bottom:

```markdown
## Sprint 1 status (foundation)

- ✅ Electron + Vite + TS scaffold
- ✅ NDJSON line splitter
- ✅ Cleak stream-json schema (subset: system/assistant/user/result)
- ✅ SDK child (`claude.exe`) spawn + auto-restart with exponential backoff
- ✅ IPC bridge to renderer
- ✅ Minimal chat UI with streaming display
- ✅ Status bar with bridge state and protocol mismatch surface

### Known limits
- Permissions are bypassed (`--permission-mode bypassPermissions`); real permission UI ships in S10.
- API key is stored in plain `.env`; secure keychain ships in S2.
- Chat has no markdown / code blocks / thinking blocks / tool-call rendering; that ships in S3.
```

- [ ] **Step 2: Save the cleak help output**

Write the captured output of `bun cleak/src/main.tsx --help` to `gui/docs/cleak-help.txt` exactly as produced.

- [ ] **Step 3: Save the wire-format reference**

Write `gui/docs/wire-format-s1.md` with the JSON frames captured in Task 0 Step 4 plus a short note on which fields the schemas in `cleakProtocol.ts` rely on. This is the source of truth for S2+ when the schema is extended.

- [ ] **Step 4: Run the full test suite**

Run from `gui/`: `npm test`
Expected: every test passes (smoke + ndjson + cleakProtocol + bridge + chatStore).

- [ ] **Step 5: Commit and tag**

```bash
git add gui/README.md gui/docs
git commit -m "docs(gui): sprint 1 status, cleak help dump, wire-format reference"
git tag gui-s1
```

---

## Sprint 1 Definition of Done

All items must be ✅ before moving to Sprint 2:

1. `npm run dev` opens an Electron window without errors.
2. `npm test` runs ≥ 12 passing tests across ndjson, cleakProtocol, bridge, chatStore, smoke.
3. Status bar reports `running` after cleak's init frame arrives.
4. Sending a user message streams an assistant reply token-by-token.
5. Killing the cleak child externally produces a `restarting` state and recovers without the user reloading the window.
6. `npm run typecheck` is clean.
7. `gui/docs/wire-format-s1.md` records the actual frames cleak emits, and the Zod schemas accept them.

---

## Self-review notes

- **Spec coverage:** Sprint 1 maps to spec § 4 / S1 line items: scaffold, child spawn, NDJSON SDK protocol client, env wiring for upstream LLM, minimal renderer, bridge restart on crash, protocol-mismatch surfacing. All covered.
- **No placeholders:** Every step contains real code or a real command. The only "TBD"-shaped items are explicitly read-only verification tasks (Task 0 captures, Task 11 manual smoke) — these *must* run on the user's box, not in the plan.
- **Type consistency:** `BridgeStatus`, `CleakInboundFrame`, `IpcChannels`, `BridgeApi` flow consistently through main → preload → renderer. `buildUserFrame` shape matches the test in Task 4 and the bridge implementation in Task 6.
- **Sprint hand-off:** S2 will add the app shell (sidebar/activity bar/right panel), keychain-backed API key storage, and theming on top of this foundation. The chat store and bridge stay; they'll be wrapped, not rewritten.
