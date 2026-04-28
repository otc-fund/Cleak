# Fix Cleak Bridge → OpenAI-Compatible Connection

> Paste this prompt into a fresh `claude` CLI session from `D:\cleak2`.

---

You are fixing the bridge connection in the Cleak GUI project at D:\cleak2\gui.

## Architecture

Cleak is an Electron 31 + React 18 + TypeScript desktop app. It spawns `claude.exe`
(Claude Code CLI) as a subprocess with `--input-format stream-json --output-format stream-json`.
Claude.exe uses the Anthropic SDK internally. An in-process HTTP shim intercepts those calls
and translates Anthropic /v1/messages → OpenAI /chat/completions format, forwarding to the
user's upstream at http://localhost:3003/v1.

Flow:
```
claude.exe (stdio NDJSON)
  → CleakBridge (Node EventEmitter)
  → Electron IPC
  → React renderer

claude.exe Anthropic SDK calls
  → http://127.0.0.1:<shim_port>/v1/messages  (in-process shim)
  → http://localhost:3003/v1/chat/completions  (user's OpenAI-compatible server)
```

## Current Symptoms

1. **Bridge silent**: After spawning, claude.exe produces NO stdout, NO stderr, and NO exit
   event — even after 30+ seconds. The process is alive (no exit). Direct .exe spawn (no shell).
   Binary: `C:\Users\Administrator\.local\bin\claude.exe`

2. **400 "model is not passed"**: When the shim forwards to the upstream, the upstream returns
   HTTP 400. The model value may be missing or empty in the OpenAI body.

## Key Files

| File | Purpose |
|------|---------|
| `gui/src/main/bridge.ts` | Spawns claude.exe, listens to stdout NDJSON frames |
| `gui/src/main/anthropicShim.ts` | In-process HTTP shim: Anthropic → OpenAI translation |
| `gui/src/main/settings.ts` | loadSettings/saveSettings (defaults: baseUrl=`http://localhost:3003/v1`, model=`qwen3.6-plus`) |
| `gui/src/main/index.ts` | createWindow(): creates shim, sets env, spawns bridge |

Spawn args used:
```
--verbose --bare --input-format stream-json --output-format stream-json --permission-mode bypassPermissions
```

Env vars injected into claude.exe:
```
ANTHROPIC_BASE_URL=http://127.0.0.1:<shimPort>
ANTHROPIC_API_KEY=shim-passthrough
```

---

## Task 1 — Diagnose & Fix Bridge Stdout Silence

Read `bridge.ts` and `index.ts` first.

The process spawns but emits nothing on stdout/stderr and never exits. Try the following fixes:

### 1a — Send initial stdin nudge

In `bridge.ts` `spawnChild()`, after child is set up, write a newline to stdin after 500 ms.
Some stream-json implementations need a first write before emitting the `system/init` frame:

```ts
setTimeout(() => {
  if (child.stdin && !child.killed) {
    child.stdin.write('\n');
  }
}, 500);
```

### 1b — Log pid and add 5-second alive check

```ts
console.log('[bridge] child pid:', child.pid);

setTimeout(() => {
  if (this.child === child && child.exitCode === null && !child.killed) {
    console.warn('[bridge] 5s timeout — process alive but silent; sending stdin nudge');
    child.stdin?.write('\n');
  }
}, 5000);
```

### 1c — Prefer claude.cmd over claude.exe in resolveClaudeBin()

The npm global install on Windows produces a `.cmd` shim that reliably pipes through cmd.exe.
The `.local\bin\claude.exe` variant may be a wrapper that doesn't forward stdio correctly.

Reorder the candidates array in `index.ts` `resolveClaudeBin()`:

```ts
const candidates = [
  // Windows installer
  join(homedir(), 'AppData', 'Local', 'Programs', 'claude', 'claude.exe'),
  // npm global — prefer .cmd over bare .exe (.cmd reliably pipes via shell)
  join(homedir(), 'AppData', 'Roaming', 'npm', 'claude.cmd'),
  // Linux/Mac npm global
  join(homedir(), '.local', 'bin', 'claude'),
  join(homedir(), '.local', 'bin', 'claude.exe'),
  // Last resort
  'claude',
];
```

The existing `useShell = /\.(cmd|bat)$/i.test(claudeBin)` logic already handles this correctly:
`.cmd` gets `shell: true`, `.exe` gets `shell: false`.

---

## Task 2 — Fix 400 "model is not passed"

Read `anthropicShim.ts`.

In `buildOpenAIBody()`, if `cfg.model` is an empty string the OpenAI body gets `model: ""`
which causes a 400. Add a fallback:

```ts
function buildOpenAIBody(req: AnthropicRequest, model: string): Record<string, unknown> {
  const effectiveModel = model || 'qwen3.6-plus';
  const messages: { role: string; content: unknown }[] = [];
  if (req.system) messages.push({ role: 'system', content: req.system });
  for (const m of req.messages) messages.push({ role: m.role, content: m.content });
  const body: Record<string, unknown> = { model: effectiveModel, messages };
  if (req.max_tokens != null) body['max_tokens'] = req.max_tokens;
  if (req.temperature != null) body['temperature'] = req.temperature;
  if (req.stream) body['stream'] = true;
  return body;
}
```

Also add upstream error logging in `proxyNonStreaming()` after the response is buffered:

```ts
if ((oaiRes.statusCode ?? 200) >= 400) {
  console.error('[shim] upstream error', oaiRes.statusCode, buf);
}
```

---

## Task 3 — Validate Shim URL Construction

In `anthropicShim.ts` `makeRequest()`, the URL is built as:

```ts
const u = new URL(`${upstreamBaseUrl}/chat/completions`);
```

For `http://localhost:3003/v1` this yields `/v1/chat/completions` on port `3003` — correct.
But if `upstreamBaseUrl` has no explicit port, `u.port` is `''` and Node's `http.request`
defaults to port 80. Add a guard and a diagnostic log:

```ts
const port = u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80);
console.log('[shim] → POST', `${u.hostname}:${port}${u.pathname}`);

const req = http.request(
  {
    hostname: u.hostname,
    port,                    // ← was: Number(u.port)
    path: u.pathname + u.search,
    method: 'POST',
    headers: { ... },
  },
  resolve,
);
```

---

## Task 4 — Typecheck & Commit

```bash
cd D:\cleak2\gui && npm run typecheck
```

Fix any TypeScript errors, then:

```bash
git add gui/src/main/bridge.ts gui/src/main/anthropicShim.ts gui/src/main/index.ts
git commit -m "fix(bridge): stdin nudge, prefer claude.cmd, model fallback, shim URL guard"
```

Do **not** run the Electron app — just verify types compile and commit.
