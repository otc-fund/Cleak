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
