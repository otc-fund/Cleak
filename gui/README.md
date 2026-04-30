# Cleak Desktop GUI

A VS-Code-style desktop interface for the cleak coding assistant.

## Prerequisites

- Node.js >= 20
- Bun (for the cleak backend)
- Windows 10+ (primary), macOS/Linux supported but installers not distributed

## Development

```bash
cd gui
npm install
npm run dev        # Start Electron in dev mode with Vite HMR
npm test           # Run unit tests
npm run typecheck  # Type check
npm run test:e2e   # Run Playwright E2E tests
```

## Build

```bash
npm run electron:build          # NSIS installer + portable
npm run electron:build:portable  # Portable only
```

Output: `gui/dist/`

## Architecture

- **Main process**: Electron main, cleak bridge, pty manager, file watcher
- **Renderer**: React 18 + Vite + TypeScript, Zustand state, Monaco editor, xterm.js terminal
- **IPC**: NDJSON over stdio for cleak bridge; Electron IPC for pty/file/search

## Sprints

| Sprint | Feature | Tag |
|--------|---------|-----|
| S1 | Foundation: bridge + skeleton | `gui-s1` |
| S2 | App shell | `gui-s2` |
| S3 | Chat & tool-call rendering | `gui-s3` |
| S4 | Files & editor | `gui-s4` |
| S5 | Terminal & processes | `gui-s5` |
| S6 | Search & navigation | `gui-s6` |
| S7 | Tasks, todos, plan mode | `gui-s7` |
| S8 | Agents & swarms | `gui-s8` |
| S9 | MCP | `gui-s9` |
| S10 | Permissions & security | `gui-s10` |
| S11 | Slash commands & skills | `gui-s11` |
| S12 | Git & worktrees | `gui-s12` |
| S13 | LSP & advanced editor | `gui-s13` |
| S14 | Web tools | `gui-s14` |
| S15 | Voice, vim, keybindings | `gui-s15` |
| S16 | Sessions, scheduling | `gui-s16` |
| S17 | Windows-specific & plugins | `gui-s17` |
| S18 | Polish, packaging, ship | `gui-s18` |
