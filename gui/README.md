# Cleak GUI

Electron desktop GUI for the cleak coding assistant.

## Prerequisites
- Node.js 20+
- A locally-installed Claude Code CLI (`claude.exe`) used as the SDK backend
- A running OpenAI-compatible endpoint at `http://localhost:3003/v1` serving `qwen3.6-plus`

## Setup
```bash
cd gui
npm install
cp .env.example .env  # then edit ANTHROPIC_API_KEY and CLAUDE_BIN if needed
npm run dev
```

## Layout
- `src/main` — Electron main process, owns the SDK child
- `src/preload` — exposes a typed bridge to the renderer
- `src/renderer` — React UI
- `tests` — Vitest unit tests

## Sprint 1 status (foundation)

- ✅ Electron + Vite + TypeScript scaffold
- ✅ NDJSON line splitter (partial-line buffering, error recovery)
- ✅ Cleak stream-json Zod schemas (system / assistant / user / result)
- ✅ Anthropic→OpenAI translation shim (streaming + non-streaming)
- ✅ SDK child spawn (`claude.exe`) + auto-restart with exponential backoff
- ✅ IPC bridge to renderer via contextBridge
- ✅ Minimal chat UI with streaming display
- ✅ Status bar with bridge state and model info
- ✅ Smoke test: Electron window opens, `claude.exe` spawns, API responds

### Known limits (addressed in future sprints)
- Permissions bypassed (`--permission-mode bypassPermissions`); real permission UI → S10
- API key stored in plain `.env`; secure keychain → S2
- No markdown / code blocks / thinking blocks / tool-call rendering → S3
- Single chat column; no sidebar, file browser, terminal, MCP → S3–S17
