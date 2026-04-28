# Cleak Desktop GUI — Design Spec

**Status:** Approved (brainstorming phase)
**Date:** 2026-04-27
**Implementation tracking:** see companion plan in `docs/superpowers/plans/`

---

## 1. Problem statement

`cleak` is a Claude-Code-style coding assistant whose user surface is a terminal UI built on Ink. We want a polished desktop GUI that exposes **every** feature of the cleak backend (all tools, MCP, agent swarms, plan mode, voice, vim, sessions, scheduling, plugins) through a VS-Code-class graphical interface, with inference routed through an OpenAI-compatible endpoint at `http://localhost:3003/v1`.

The GUI must be a complete replacement for the terminal UI, not a thin chat wrapper.

## 2. Architectural decisions (locked)

### 2.1 Process model — "GUI shell over cleak backend"

- The GUI is a standalone **Electron desktop app**.
- The cleak backend runs as a **child process** spawned by the GUI (Bun runtime), with an SDK-mode CLI invocation.
- All tool execution, MCP servers, agent swarms, hooks, plan mode, permissions, and other backend logic live inside cleak — the GUI does **not** reimplement them.
- The GUI is a presentation + control layer. It drives cleak via the existing SDK control protocol and renders cleak's structured event stream.

#### 2.1a Bootstrap reality (2026-04-27)

The cleak source at `D:\cleak2\cleak\src` is a code dump — no `package.json`, no `tsconfig.json`, no install. Its `main.tsx` imports `bun:bundle` macros (`feature(...)`) and references build-time inlines (`MACRO.VERSION`), so it cannot run directly via `bun src/main.tsx`; it must be bundled with `bun build` against a fully-resolved dep tree, which is a significant standalone effort. **For Sprint 1 we use the locally-installed `claude.exe` (Claude Code CLI) as the SDK backend** — same NDJSON SDK protocol (cleak is a Claude Code fork, so `controlSchemas.ts` matches), same env-routing for `localhost:3003/v1` to qwen3.6-plus. The GUI codebase still calls its bridge `CleakBridge`; binary swap to a real cleak build later is a single `CLAUDE_BIN` env-var change.

### 2.2 IPC — cleak's existing SDK control protocol

- Transport: NDJSON over the cleak child's stdio.
- Schemas: defined in `cleak/src/entrypoints/sdk/coreSchemas.ts` (events, messages) and `controlSchemas.ts` (control RPC: initialize, hook callbacks, permission decisions, MCP routing).
- Direction: bidirectional. GUI sends `SDKUserMessage` and control requests; cleak sends `SDKMessage` events (assistant text, tool use summaries, hook events, post-turn summary, etc.).
- The GUI never forks or modifies these schemas — it adapts to whatever cleak ships.

### 2.3 Inference routing — inside cleak

- The GUI does **not** speak the OpenAI Chat Completions API directly.
- The GUI starts the cleak child with environment variables (e.g. `ANTHROPIC_BASE_URL=http://localhost:3003/v1`, key) routed via cleak's `upstreamproxy/`.
- All model calls (including any internal sub-agent inference) go through cleak's existing client, which now points at the qwen3.6-plus endpoint.
- Single source of truth for conversation state, retries, caching, costs.

### 2.4 Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Shell | Electron + TypeScript | Native installer, OS keychain access, mature; matches `electron-safe-store` mention in spec |
| Renderer | React 18 + Vite + TypeScript | Reuses cleak's existing React component logic (`src/components/`, `src/hooks/`); HMR for fast iteration |
| State | Zustand | Already used by cleak (`src/state/`); minimal boilerplate |
| Styling | Tailwind + Radix primitives + shadcn/ui | Polished VS-Code-ish look without hand-rolling primitives |
| Editor | Monaco | VS Code's editor; LSP-friendly; rich extension surface |
| Terminal | xterm.js | Industry-standard JS terminal emulator |
| IPC | NDJSON over stdio (cleak SDK protocol) | Already specified by cleak; no protocol design needed |
| Packaging | electron-builder | Windows .exe + portable; cross-platform later |

### 2.5 Sprint approach — "foundation-then-vertical"

Sprints 1–2 lay the bridge and app shell. Every subsequent sprint is a vertical slice that ships a usable feature end-to-end and leaves the app in a working state.

## 3. Component model (high level)

```
┌────────────────────────────────────────────────────────────────────┐
│                       Electron main process                        │
│                                                                    │
│  ┌─────────────────┐   spawn   ┌─────────────────────────────┐     │
│  │  Cleak Bridge   │──────────▶│ cleak Bun child (SDK mode)  │     │
│  │  (NDJSON I/O,   │◀──────────│  → tools, MCP, agents,      │     │
│  │   restart mgmt, │           │    permissions, upstream    │     │
│  │   key routing)  │           │    proxy → qwen3.6-plus     │     │
│  └────────┬────────┘           └─────────────────────────────┘     │
│           │ contextBridge / preload                                 │
└───────────┼─────────────────────────────────────────────────────────┘
            │
┌───────────▼─────────────────────────────────────────────────────────┐
│                       Renderer (React)                              │
│                                                                     │
│  ┌──────────┐  ┌──────────────────────────────────┐  ┌───────────┐  │
│  │ Activity │  │            Workbench             │  │  Right    │  │
│  │ bar      │  │   (chat | editor | terminal |    │  │  panel    │  │
│  │          │  │    plan | notebook | web)        │  │ (context- │  │
│  │ Files    │  │                                  │  │  ual)     │  │
│  │ Search   │  │                                  │  │           │  │
│  │ Tasks    │  │                                  │  │ Files     │  │
│  │ Agents   │  │                                  │  │ Todos     │  │
│  │ MCP      │  │                                  │  │ Tasks     │  │
│  │ Git      │  │                                  │  │ Agents    │  │
│  │ Skills   │  │                                  │  │ MCP       │  │
│  │ Settings │  │                                  │  │ Git       │  │
│  └──────────┘  └──────────────────────────────────┘  └───────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Status bar: model | tokens | cost | mode | bridge health   │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

Key boundaries:

- **Cleak Bridge** is the only module that touches the cleak child process. Renderer never sees stdio.
- **Renderer state stores** subscribe to a typed event bus fed by the bridge. Each store owns one slice (chat, files, todos, tasks, agents, mcp, git, perms, settings).
- **Each panel** consumes only the stores it needs. Panels are isolated; adding a new tool/panel does not touch existing ones.
- **Tool-call rendering** is pluggable: a registry maps tool names to React components. Default renderer for unknown tools = generic JSON viewer. New cleak tools light up automatically.

## 4. Sprint plan

Each sprint targets ~1 week. Definition of done per sprint: feature works end-to-end, basic tests pass, app builds & launches, demoable.

### S1 — Foundation: bridge + skeleton

- Electron + Vite + TS scaffold; main / preload / renderer split.
- Cleak child spawn manager: locate Bun, spawn cleak in SDK / `--print --output-format stream-json` mode, capture stdio, parse NDJSON.
- Implement bridge client for `controlSchemas.ts` initialize handshake + `coreSchemas.ts` SDK message ingestion.
- Wire env vars for upstream LLM (`ANTHROPIC_BASE_URL`, key) into the child env.
- Minimal renderer: text input → user message → streamed assistant text rendered.
- Health: bridge restart on crash; surface protocol-version mismatch in status bar.

**DoD:** "hello" round trip; messages stream from qwen3.6-plus; bridge auto-recovers from a forced child kill.

### S2 — App shell

- VS-Code-style layout: activity bar (left), collapsible side panel, main area with tabs, right contextual panel, status bar.
- Tailwind + shadcn install; theme tokens for dark / light / high-contrast.
- Zustand store skeleton for each domain slice.
- Settings panel scaffold.
- Secure storage: API key + sensitive env vars via `electron-safe-store` / OS keychain.
- Env-var manager UI.
- Status bar: model name, bridge state, placeholder token/cost, mode badge.

**DoD:** themed empty shell; settings persist across restarts; key never written to plain disk.

### S3 — Chat & tool-call rendering

- Markdown rendering with GFM, copy buttons on code blocks, language-aware syntax highlighting.
- Streaming render with stable scroll anchor.
- Thinking blocks: collapsible; auto-collapse-into-group when ≥3 in a row.
- Tool-call cards: name, params (collapsible JSON), result (truncate + expand), duration, success/error.
- Token + cost meter (input/output/cache-read/cache-creation/$); update on every `SDKPostTurnSummaryMessage`.
- Message timestamps + request IDs (copy-on-click).
- Multi-turn: replay history from cleak's session record on launch.

**DoD:** chat looks polished; thinking and tool calls visibly distinct; cost meter accurate.

### S4 — Files & editor

- File-tree panel: search/filter, .gitignore-aware, icons, expand/collapse, watch for external changes.
- Monaco editor with multi-tab, dirty-state indicator, save / discard.
- Diff view (inline + side-by-side) for agent edits — uses cleak edit events.
- Search/replace per-file and project-wide (global search panel).
- Tool integrations: live-highlight regions touched by `FileReadTool`/`FileEditTool`/`FileWriteTool`/`PatchApplyTool` events.

**DoD:** open file, agent edits stream into the same buffer with diff highlighting; manual save works.

### S5 — Terminal & processes

- xterm.js multi-tab terminal: bash + PowerShell, configurable shell args.
- Tool integrations: `BashTool`, `PowerShellTool`, `BashOutputTool`, `BashHistoryTool`, `KillBashTool`, `KillProcessTool`.
- Background-task badges in status bar; click → focuses terminal tab.
- Process-list panel (`ps`-style) with kill controls.

**DoD:** agent runs `npm test` in a visible terminal tab; user can kill it from the GUI.

### S6 — Search & navigation

- Global grep panel: pattern, glob filter, regex toggle, results grouped by file with previews.
- Glob picker UI for `GlobTool` invocations.
- Quick-open (Ctrl+P): fuzzy file open across project.
- `ToolSearchTool` invocation panel for dynamic tool discovery.

**DoD:** Ctrl+P opens any file; grep returns project results; agent grep results show in same panel.

### S7 — Tasks, todos, plan mode

- Todo panel synced with `TodoWriteTool`: add / check / edit / delete; status (pending / in-progress / completed); collapsible.
- Task panel for sub-agents (`TaskTool`/`TaskOutputTool`/`TaskStopTool`): hierarchy view, status, output viewer, cancel.
- Plan mode toggle (`EnterPlanMode`/`ExitPlanModeV2`): UI lock-down, plan diff/approval workflow, plan history.

**DoD:** Plan → review → approve → execute loop works; sub-tasks streamable & cancellable.

### S8 — Agents & swarms

- Multi-agent dashboard: list active agents w/ color, status, current task.
- Create/delete agent (`AgentTool`, `TeamCreateTool`, `TeamDeleteTool`).
- Inter-agent messaging (`SendMessageTool`) — chat-like view per agent pair.
- Custom agent JSON config editor with schema validation.
- Per-agent permissions overrides.
- `AskUserQuestionTool` modal: multiple-choice / text-input / file-selection.

**DoD:** Spawn an agent, watch it ask the user a question via modal, kill it, see the team graph update.

### S9 — MCP

- MCP server manager: add/remove/configure stdio + SSE servers; server list with live connection status.
- Resource viewer: browse `ListMcpResourcesTool` output, view via `ReadMcpResourceTool`.
- MCP tool browser: list tools per server, schema preview, invoke from UI.
- All routed through cleak's MCP client (`MCPClientTool`).

**DoD:** Add an MCP server in the UI, see its tools in the browser, invoke one and see the result.

### S10 — Permissions & security

- Permission manager UI: per-tool allow/deny/ask, session vs persistent grants.
- Trust-level indicator for current workspace.
- Auto-mode state visible & toggleable.
- Secret detection in diffs/edits — block-and-warn flow.
- Risk badges on tool calls.
- `TestingPermissionTool` flow for QA.

**DoD:** Deny a tool once → matches denied. Grant persistent → survives restart. Secret in a diff blocks the edit until confirmed.

### S11 — Slash commands & skills

- All slash commands wired:
  `/help` `/clear` `/compact` `/config` `/cost` `/doctor` `/export` `/model` `/agents` `/advisor` `/brief` `/approve` `/plan` `/todos` `/skills` `/mcp` `/ps` `/terminal` `/voice` `/vim` `/theme` `/keybindings` `/plugins` `/worktree` `/teammate` `/daemon` `/remote` `/stats` `/share` `/resume` `/teleport`.
- Command palette (Ctrl+Shift+P) lists all commands with descriptions and keybindings.
- Skill manager: built-in skills (`src/skills/bundled/`) + custom from `.claude/skills/`; toggle, view docs.
- `SkillTool` and `SlashCommandTool` plumbing.

**DoD:** Each slash command executes its UI action; skill toggles persist; skill docs render as markdown.

### S12 — Git & worktrees

- Git panel: status (staged/unstaged/untracked), inline diff, commit form, push/pull, branch switcher, log viewer.
- Worktree manager: list, create, switch, exit (`EnterWorktreeTool`/`ExitWorktreeTool`).
- `PatchApplyTool` UI: preview patch, apply/skip per hunk.
- `SubscribePRTool`: PR list with status badges (CI, reviews, mergeable).

**DoD:** Commit a file from the GUI; create a worktree; subscribe to a PR and see CI status update.

### S13 — LSP & advanced editor

- `LSPTool` integration: diagnostics panel (errors/warnings per file), go-to-definition, find-references, hover tooltips, autocomplete in Monaco.
- Jupyter notebook editor: `NotebookEditTool` with cell-level run / edit / output.
- `BriefTool` panel — generate / view project brief.
- `SummarizeTool` — summarize selected code/files.
- `DevTool` panel.

**DoD:** Hover shows type info; diagnostics turn red on error; notebook cells run inline.

### S14 — Web tools

- `WebSearchTool` results panel with clickable links + previews.
- `WebFetchTool` content preview pane.
- Embedded Lightpanda browser at `http://localhost:9222` (panel embedding the live page).
- `SendUserFileTool` (drop a file into the conversation).
- `TungstenTool`.

**DoD:** Search → preview a result inline; embedded browser loads & forwards URLs from chat.

### S15 — Voice, vim, keybindings

- Voice mode: STT (live transcription), TTS playback, push-to-talk + continuous, language/voice settings.
- Vim emulation in Monaco: normal/insert/visual/cmdline; `~/.vimrc` support.
- Keybinding editor: edit any binding, conflict detection, platform-specific overrides (Win/Mac/Linux), import/export.

**DoD:** Speak a question → text appears; assistant reply plays as audio. `:wq` saves a buffer in vim mode. Custom Ctrl+K binding works.

### S16 — Sessions, scheduling, remote modes

- Session manager: list / load / delete / search / export / import; share / resume / teleport; background sessions (Ctrl+B equivalent).
- Scheduling: `ScheduleCronTool` (Create / Delete / List) UI.
- `RemoteTriggerTool`, `MonitorTool`, `PushNotificationTool` panels.
- Daemon, bridge, coordinator, assistant (KAIROS) mode toggles + status.
- `SleepTool` UI (pause an agent).

**DoD:** Schedule a task to run in 1 hour and see it trigger; resume a session from yesterday; teleport between two GUI instances.

### S17 — Windows-specific & plugins

- Dedicated PowerShell tab (vs generic terminal): native PS profile, integrated history.
- `WindowsDefenderTool` scan UI: trigger scans, view results.
- `WingetTool`: search, install, uninstall, upgrade packages.
- Plugin marketplace UI: browse, install, enable/disable, configure plugins.

**DoD:** Install a plugin via the UI; run a Defender scan; install a winget package.

### S18 — Polish, packaging, ship

- Animations on panel transitions, toasts, skeleton loaders.
- Accessibility audit (keyboard nav, screen-reader labels, contrast).
- Notification center (in-app + native OS notifications, opt-in).
- Status-bar polish.
- electron-builder Windows .exe installer + portable build.
- Auto-update channel (electron-updater).
- Smoke-test suite (Playwright on the renderer).
- README with setup, build, dev workflow.

**DoD:** Distributable .exe; installer adds Start menu entry; auto-update works against a staging feed.

## 5. Cross-cutting concerns

- **Testing:** TDD on bridge protocol adapters and state reducers (clear contracts). Playwright E2E smoke for each new panel after the panel sprint. No mocking of the cleak child in E2E — spawn a real one in a test harness pointed at a stub LLM.
- **Error handling:** Bridge crashes → auto-restart (max 3/min, then surface). Protocol mismatches surfaced in status bar with version info.
- **Telemetry:** Reuse cleak's analytics events; user-toggleable in Settings; default off until first launch consent.
- **Security:** API key stored in OS keychain; tool calls always traverse the permission layer; secret-scan runs on every diff before render; CSP locked down in renderer.
- **Performance:** Renderer uses virtualized lists for chat history >500 messages, file tree >5k entries, search results, etc.
- **Cross-platform readiness:** Windows-first per spec, but no Win-only APIs in core paths; S17 isolates Win-only features.

## 6. Out of scope (v1)

Per explicit user instruction, **nothing** in `GUI_PROMPT.md` is deferred. Every tool, hook, skill, slash command, panel, and feature listed there maps to a sprint above.

Items genuinely out of scope:

- Mac and Linux installers (only built on demand; not part of release pipeline).
- Mobile.
- Cloud-hosted multi-user mode.

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Cleak SDK protocol changes mid-build | Pin a cleak commit; bump deliberately; protocol-version surfaced in status bar |
| `localhost:3003/v1` schema drift from OpenAI spec | Contained inside cleak's upstream proxy; GUI is unaffected |
| Monaco + Vim + LSP in one editor proves fragile | Spike in S13 before fully committing; fall back to CodeMirror 6 if needed |
| Lightpanda local browser unavailable | Render an iframe pointing at `localhost:9222` only when reachable; otherwise hide panel |
| Sprint slippage cascades | Vertical-slice structure means slipping a feature sprint never blocks the foundation; reorder sprints freely |

## 8. Open questions

None at design-doc time. Any new questions discovered during implementation are tracked in the sprint plan, not here.

---

**Next step:** invoke the writing-plans skill to expand each sprint into an executable implementation plan with checklists.
