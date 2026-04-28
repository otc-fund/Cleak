# Sprint 3 — Chat & Tool-Call Rendering

> Paste into a fresh `claude` CLI session from `D:\cleak2`.
> Use `superpowers:subagent-driven-development` to execute task-by-task.

---

## Context

Cleak GUI is an Electron 31 + React 18 + TypeScript desktop app at `D:\cleak2\gui`.
Sprint 2 is complete: VS Code-style shell, activity bar, side panel, tabs, theme system,
settings with encrypted API key — all working.

The bridge spawns `claude.exe` with `--input-format stream-json --output-format stream-json`.
Frames arrive as typed Zod-parsed objects (`CleakInboundFrame` in `src/main/cleakProtocol.ts`).

**Sprint 2 git tag:** `gui-s2`

---

## Goal

Replace the plain-text ChatView with a production-quality chat renderer:
markdown, syntax-highlighted code blocks, streaming scroll anchor, collapsible thinking blocks,
tool-call cards with params/result/duration, token/cost meter, and timestamps.

---

## Existing Files to Know

| File | Notes |
|------|-------|
| `gui/src/renderer/store/chat.ts` | Zustand store: `ChatMessage { id, role, text, pending }`. Needs extension. |
| `gui/src/renderer/components/ChatView.tsx` | Plain whitespace-pre text. Replace entirely. |
| `gui/src/renderer/components/MessageInput.tsx` | Keep as-is. |
| `gui/src/renderer/lib/cn.ts` | `cn()` helper (clsx + tailwind-merge). |
| `gui/src/main/cleakProtocol.ts` | Zod schemas: `AssistantFrame`, `ResultFrame`, `ThinkingBlock`, `ToolUseBlock`. |
| `gui/src/renderer/store/ui.ts` | `useUi` store (theme, layout). |

**Current `package.json` deps** (already installed):
`react`, `react-dom`, `zustand`, `zod`, `clsx`, `tailwind-merge`, `lucide-react`,
`@radix-ui/react-tabs`, `@radix-ui/react-tooltip`

---

## New Dependencies to Install

```bash
cd D:\cleak2\gui
npm install react-markdown remark-gfm rehype-highlight rehype-raw highlight.js
npm install -D @types/highlight.js
```

---

## File Structure

```
gui/src/renderer/
├── store/
│   └── chat.ts                    ← Extend: richer message model, cost/token state
├── components/
│   ├── ChatView.tsx               ← Replace: orchestrates message list + auto-scroll
│   ├── MessageInput.tsx           ← Unchanged
│   └── chat/
│       ├── AssistantMessage.tsx   ← Create: renders assistant turn (text + thinking + tools)
│       ├── UserMessage.tsx        ← Create: user bubble with timestamp
│       ├── ThinkingBlock.tsx      ← Create: collapsible thinking block
│       ├── ToolCallCard.tsx       ← Create: tool_use + matching tool_result card
│       ├── MarkdownBody.tsx       ← Create: react-markdown wrapper with code highlighting
│       └── CostMeter.tsx         ← Create: token/cost display fed from ResultFrame
gui/tests/
└── chat/
    ├── chatStore.test.ts          ← Create: store unit tests
    └── ToolCallCard.test.ts       ← Create: component tests
```

---

## Task 1 — Extend Chat Store

**File:** `gui/src/renderer/store/chat.ts`

Replace the flat `ChatMessage` model with a richer one that separates content blocks,
tracks tool calls, and stores cost/token data from `ResultFrame`.

```ts
// New types

export type TextBlock    = { type: 'text'; text: string };
export type ThinkingBlock = { type: 'thinking'; thinking: string };
export type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown };
export type ToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: unknown; is_error?: boolean };
export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  /** Rich content blocks (assistant). For user messages, always a single TextBlock. */
  blocks: ContentBlock[];
  /** True while streaming (assistant only). */
  pending: boolean;
  /** Unix ms timestamp. */
  ts: number;
  /** session_id from frame, for grouping. */
  sessionId?: string;
}

export interface CostData {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCostUsd: number;
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
```

`ingestFrame` logic:
- `frame.type === 'assistant'`: if `frame.message.content` is a string, treat as `[{type:'text', text}]`.
  If array, map each Zod block to the new `ContentBlock` union.
  Find the last pending assistant message and append blocks (merge trailing text blocks when streaming).
  If no pending assistant message exists, push a new one.
- `frame.type === 'result'`: mark last pending assistant as `pending: false`.
  Extract `total_cost_usd`, `modelUsage` from frame to populate `CostData`.
  `modelUsage` is a record like `{ "model-name": { input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens } }`.
  Sum across all model entries.
- Other frame types: ignore for now.

`appendUser`:
```ts
appendUser(text) {
  set(s => ({
    messages: [
      ...s.messages,
      { id: nextId(), role: 'user', blocks: [{ type: 'text', text }], pending: false, ts: Date.now() },
      { id: nextId(), role: 'assistant', blocks: [], pending: true, ts: Date.now() },
    ],
  }));
},
```

Write tests in `gui/tests/chat/chatStore.test.ts` covering:
- `appendUser` adds user + pending assistant
- `ingestFrame` with string content appends text block
- `ingestFrame` with array content maps blocks correctly
- `ingestFrame` with `result` frame marks pending false and sets cost
- `pushError` caps at 20 errors

Run: `cd D:\cleak2\gui && npm test`
Expected: all tests pass.

Commit: `git commit -m "feat(chat): richer message model with blocks, cost data from ResultFrame"`

---

## Task 2 — MarkdownBody Component

**File:** `gui/src/renderer/components/chat/MarkdownBody.tsx`

```tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { cn } from '../../lib/cn';

interface Props {
  children: string;
  className?: string;
}

export function MarkdownBody({ children, className }: Props): React.ReactElement {
  return (
    <div className={cn('prose prose-invert prose-sm max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre({ children, ...props }) {
            return (
              <div className="relative group">
                <pre {...props}>{children}</pre>
                <CopyButton getText={() => {
                  // extract text from pre's code child
                  const code = (children as React.ReactElement)?.props?.children;
                  return typeof code === 'string' ? code : '';
                }} />
              </div>
            );
          },
          code({ className: cls, children, ...props }) {
            const isBlock = cls?.startsWith('language-');
            return isBlock
              ? <code className={cls} {...props}>{children}</code>
              : <code className="px-1 py-0.5 rounded bg-surface text-accent text-[0.8em]" {...props}>{children}</code>;
          },
        }}
      />
    </div>
  );
}

function CopyButton({ getText }: { getText: () => string }): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      className="absolute top-2 right-2 px-2 py-1 text-[10px] rounded bg-surface/80 text-muted
                 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={() => {
        void navigator.clipboard.writeText(getText());
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
```

Add `@tailwindcss/typography` plugin:
```bash
cd D:\cleak2\gui && npm install -D @tailwindcss/typography
```

Update `gui/tailwind.config.cjs`:
```js
plugins: [require('@tailwindcss/typography')],
```

No dedicated test needed — covered in AssistantMessage tests.

Commit: `git commit -m "feat(chat): MarkdownBody with GFM, syntax highlight, copy button"`

---

## Task 3 — ThinkingBlock Component

**File:** `gui/src/renderer/components/chat/ThinkingBlock.tsx`

Collapsible. Default: collapsed when the thinking text is >200 chars OR when it's part of
a group of ≥3 consecutive thinking blocks (handled by parent via `forceCollapse` prop).

```tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';
import { cn } from '../../lib/cn';

interface Props {
  thinking: string;
  forceCollapse?: boolean;
}

export function ThinkingBlock({ thinking, forceCollapse = false }: Props): React.ReactElement {
  const defaultOpen = !forceCollapse && thinking.length <= 200;
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="my-1 rounded border border-border/50 bg-surface/30 text-xs">
      <button
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-muted hover:text-primary transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <Brain size={12} className="text-accent/70 shrink-0" />
        <span className="flex-1 text-left truncate">
          {open ? 'Thinking' : `Thinking: ${thinking.slice(0, 60)}…`}
        </span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="px-3 pb-2 text-muted whitespace-pre-wrap leading-relaxed border-t border-border/30">
          {thinking}
        </div>
      )}
    </div>
  );
}
```

Commit: `git commit -m "feat(chat): collapsible ThinkingBlock component"`

---

## Task 4 — ToolCallCard Component

**File:** `gui/src/renderer/components/chat/ToolCallCard.tsx`

Receives a `ToolUseBlock` and optionally the matching `ToolResultBlock`.

```tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { ToolUseBlock, ToolResultBlock } from '../../store/chat';

interface Props {
  toolUse: ToolUseBlock;
  result?: ToolResultBlock;
  /** Duration in ms if available */
  durationMs?: number;
}

export function ToolCallCard({ toolUse, result, durationMs }: Props): React.ReactElement {
  const [paramsOpen, setParamsOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  const resultText = result
    ? typeof result.content === 'string'
      ? result.content
      : JSON.stringify(result.content, null, 2)
    : null;

  const TRUNCATE = 300;
  const resultTruncated = resultText && resultText.length > TRUNCATE;
  const [resultExpanded, setResultExpanded] = useState(false);

  const isError = result?.is_error;

  return (
    <div className={cn(
      'my-1 rounded border text-xs',
      isError ? 'border-red-900/50 bg-red-950/20' : 'border-border/50 bg-surface/20',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Wrench size={11} className="text-accent/70 shrink-0" />
        <span className="font-mono font-medium text-primary/80">{toolUse.name}</span>
        {result && (
          isError
            ? <XCircle size={11} className="text-red-400 ml-auto" />
            : <CheckCircle size={11} className="text-green-400 ml-auto" />
        )}
        {!result && <span className="ml-auto text-muted animate-pulse">running…</span>}
        {durationMs != null && (
          <span className="text-muted">{durationMs < 1000 ? `${durationMs}ms` : `${(durationMs/1000).toFixed(1)}s`}</span>
        )}
      </div>

      {/* Params */}
      <div className="border-t border-border/30">
        <button
          className="w-full flex items-center gap-1 px-2 py-1 text-muted hover:text-primary transition-colors"
          onClick={() => setParamsOpen(v => !v)}
        >
          {paramsOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <span>params</span>
        </button>
        {paramsOpen && (
          <pre className="px-3 pb-2 text-muted overflow-x-auto text-[10px] leading-relaxed">
            {JSON.stringify(toolUse.input, null, 2)}
          </pre>
        )}
      </div>

      {/* Result */}
      {resultText != null && (
        <div className="border-t border-border/30">
          <button
            className="w-full flex items-center gap-1 px-2 py-1 text-muted hover:text-primary transition-colors"
            onClick={() => setResultOpen(v => !v)}
          >
            {resultOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            <span className={isError ? 'text-red-400' : ''}>result</span>
          </button>
          {resultOpen && (
            <div className="px-3 pb-2">
              <pre className={cn('text-[10px] leading-relaxed overflow-x-auto whitespace-pre-wrap',
                isError ? 'text-red-300' : 'text-muted')}>
                {resultExpanded || !resultTruncated
                  ? resultText
                  : resultText.slice(0, TRUNCATE) + '…'}
              </pre>
              {resultTruncated && (
                <button
                  className="text-accent text-[10px] mt-1 hover:underline"
                  onClick={() => setResultExpanded(v => !v)}
                >
                  {resultExpanded ? 'show less' : 'show more'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

Write tests in `gui/tests/chat/ToolCallCard.test.ts`:
- Renders tool name in header
- Shows "running…" when no result
- Shows CheckCircle when result and no error
- Shows XCircle when result is_error=true
- Truncates long result text and shows "show more"

Use `@testing-library/react` if already in devDeps; otherwise just test with pure logic.
(If testing-library not installed: `npm install -D @testing-library/react @testing-library/jest-dom jsdom`)

Run: `npm test`
Commit: `git commit -m "feat(chat): ToolCallCard with params/result collapsible, error state, truncation"`

---

## Task 5 — AssistantMessage Component

**File:** `gui/src/renderer/components/chat/AssistantMessage.tsx`

Renders one assistant `ChatMessage`. Interleaves `ThinkingBlock`, `ToolCallCard`, and
`MarkdownBody` in block order. Groups ≥3 consecutive thinking blocks for `forceCollapse`.

```tsx
import React, { useMemo } from 'react';
import type { ChatMessage, ContentBlock, ToolUseBlock, ToolResultBlock } from '../../store/chat';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallCard } from './ToolCallCard';
import { MarkdownBody } from './MarkdownBody';

interface Props {
  message: ChatMessage;
}

export function AssistantMessage({ message }: Props): React.ReactElement {
  // Build a result lookup: tool_use_id → ToolResultBlock
  const resultMap = useMemo(() => {
    const m = new Map<string, ToolResultBlock>();
    for (const b of message.blocks) {
      if (b.type === 'tool_result') m.set(b.tool_use_id, b);
    }
    return m;
  }, [message.blocks]);

  // Count consecutive thinking blocks for auto-collapse
  const thinkingRun = useMemo(() => {
    const runs = new Map<number, number>(); // blockIndex → run length
    let run = 0;
    for (let i = message.blocks.length - 1; i >= 0; i--) {
      if (message.blocks[i].type === 'thinking') { run++; runs.set(i, run); }
      else run = 0;
    }
    return runs;
  }, [message.blocks]);

  // Filter out tool_result blocks (rendered inside ToolCallCard, not standalone)
  const renderBlocks = message.blocks.filter(b => b.type !== 'tool_result');

  return (
    <div className="group flex flex-col gap-0.5">
      {renderBlocks.map((block, i) => {
        if (block.type === 'thinking') {
          const run = thinkingRun.get(i) ?? 1;
          return <ThinkingBlock key={i} thinking={block.thinking} forceCollapse={run >= 3} />;
        }
        if (block.type === 'tool_use') {
          const result = resultMap.get(block.id);
          return <ToolCallCard key={i} toolUse={block as ToolUseBlock} result={result} />;
        }
        if (block.type === 'text') {
          return block.text
            ? <MarkdownBody key={i}>{block.text}</MarkdownBody>
            : null;
        }
        return null;
      })}
      {message.pending && (
        <span className="inline-block w-2 h-3.5 bg-accent/60 animate-pulse rounded-sm" />
      )}
    </div>
  );
}
```

No separate test needed — covered by chatStore tests and visual review.

Commit: `git commit -m "feat(chat): AssistantMessage renders blocks in order with thinking/tool/markdown"`

---

## Task 6 — UserMessage Component

**File:** `gui/src/renderer/components/chat/UserMessage.tsx`

```tsx
import React from 'react';
import type { ChatMessage } from '../../store/chat';

interface Props {
  message: ChatMessage;
}

export function UserMessage({ message }: Props): React.ReactElement {
  const text = message.blocks.find(b => b.type === 'text')?.text ?? '';
  const time = new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex justify-end gap-2 group">
      <div className="max-w-[80%]">
        <div className="rounded-lg px-3 py-2 bg-accent/15 border border-accent/20 text-sm text-primary whitespace-pre-wrap">
          {text}
        </div>
        <div className="text-right text-[10px] text-muted mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {time}
        </div>
      </div>
    </div>
  );
}
```

Commit: `git commit -m "feat(chat): UserMessage bubble with hover timestamp"`

---

## Task 7 — CostMeter Component

**File:** `gui/src/renderer/components/chat/CostMeter.tsx`

Reads `cost` from the chat store. Displayed in the StatusBar (wire it there too).

```tsx
import React from 'react';
import { useChat } from '../../store/chat';

export function CostMeter(): React.ReactElement | null {
  const cost = useChat(s => s.cost);
  if (!cost) return null;

  const fmt = (n: number): string =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div className="flex items-center gap-2 text-[10px] text-muted font-mono">
      <span title="Input tokens">↑{fmt(cost.inputTokens)}</span>
      <span title="Output tokens">↓{fmt(cost.outputTokens)}</span>
      {cost.cacheReadTokens > 0 && (
        <span title="Cache read tokens" className="text-green-600">⚡{fmt(cost.cacheReadTokens)}</span>
      )}
      {cost.totalCostUsd > 0 && (
        <span title="Total cost" className="text-amber-500/70">
          ${cost.totalCostUsd < 0.01 ? cost.totalCostUsd.toFixed(4) : cost.totalCostUsd.toFixed(3)}
        </span>
      )}
    </div>
  );
}
```

In `gui/src/renderer/components/StatusBar.tsx`, import and render `<CostMeter />` in the
right section of the status bar (replace the placeholder token/cost span if present).

Commit: `git commit -m "feat(chat): CostMeter component wired into StatusBar"`

---

## Task 8 — Replace ChatView

**File:** `gui/src/renderer/components/ChatView.tsx`

Replace the entire file:

```tsx
import React, { useEffect, useRef } from 'react';
import { useChat } from '../store/chat';
import { AssistantMessage } from './chat/AssistantMessage';
import { UserMessage } from './chat/UserMessage';

export function ChatView(): React.ReactElement {
  const messages = useChat(s => s.messages);
  const errors = useChat(s => s.errors);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Stable scroll anchor: only auto-scroll when near bottom
  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottom = (): boolean => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useEffect(() => {
    if (isNearBottom()) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-muted text-sm">
          Start a conversation…
        </div>
      )}
      {messages.map(m =>
        m.role === 'user'
          ? <UserMessage key={m.id} message={m} />
          : <AssistantMessage key={m.id} message={m} />
      )}
      {errors.length > 0 && (
        <div className="text-xs text-red-400/80 border border-red-900/30 rounded px-3 py-2 bg-red-950/20">
          {errors[errors.length - 1]}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
```

Commit: `git commit -m "feat(chat): replace plain ChatView with rich block renderer"`

---

## Task 9 — Typecheck & Final Test Pass

```bash
cd D:\cleak2\gui
npm run typecheck
npm test
```

Fix any TypeScript errors. All tests must pass.

Final commit if any fixes needed:
```bash
git commit -m "fix(chat): typecheck errors from Sprint 3 components"
```

Tag:
```bash
git tag gui-s3
```

---

## Definition of Done

- [ ] `npm test` passes (all existing + new tests)
- [ ] `npm run typecheck` clean
- [ ] AssistantMessage renders markdown, code blocks with copy button, thinking blocks (collapsible), tool-call cards
- [ ] UserMessage shows right-aligned bubble with hover timestamp
- [ ] CostMeter appears in StatusBar after first `result` frame
- [ ] Streaming: scroll auto-follows only when near bottom
- [ ] Tagged `gui-s3`
