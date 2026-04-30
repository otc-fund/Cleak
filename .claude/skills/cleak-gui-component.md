---
name: cleak-gui-component
description: Build and edit Electron + React + Tailwind GUI components for Cleak Desktop
---

Use this skill when adding new GUI components, editing existing ones, or reviewing GUI code in the Cleak Desktop app.

## Architecture

- **Renderer**: React 18 + Vite + TypeScript, located in `gui/src/renderer/`
- **State**: Zustand stores in `gui/src/renderer/store/` — no Redux, no Context for state
- **Styling**: Tailwind CSS via `gui/tailwind.config.cjs`, custom vars in `gui/src/renderer/styles.css`
- **Layout**: `AppShell` (root) → `ActivityBar` + `SidePanel` + `MainArea` + `RightPanel` + `StatusBar`
- **Editor**: Monaco editor in `gui/src/renderer/components/editor/`
- **Terminal**: xterm.js in `gui/src/renderer/components/terminal/`

## Component Rules

1. **Prefer editing existing files** over creating new ones.
2. **State lives in Zustand stores**, never in component `useState` unless it's purely local UI state (editing mode, hover, etc).
3. **Selectors use the function form**: `useChat((s) => s.messages)` — not `useChat().messages`.
4. **Cross-store access**: use `useStore.getState()` inside callbacks/effects, never in render.
5. **No comments** unless the WHY is non-obvious.
6. **No emojis** unless explicitly requested.
7. **No `// removed` or dead code comments** — delete completely.
8. **No feature flags or backwards-compatibility shims** — change the code directly.

## File Organization

Components are organized by feature under `gui/src/renderer/components/`:
- `chat/` — message rendering, tool calls, thinking blocks
- `layout/` — AppShell, ActivityBar, SidePanel, MainArea, RightPanel, StatusBar
- `sessions/` — SessionManager, session list UI
- `editor/` — Monaco editor, tabs
- `terminal/` — xterm terminal, process list
- `search/` — GrepPanel, GlobPicker, GrepResults, QuickOpen
- `tasks/` — TaskPanel, TaskOutput, task tree
- `todos/` — TodoPanel, TodoItem
- `agents/` — AgentDashboard, AgentCard, AgentChat
- `scheduling/` — CronManager, MonitorList
- `memory/` — MemoryBrowser, MemoryCard, MemoryEditor
- `context/` — ContextUsageGrid, ContextStatusBar
- `settings/` — SettingsPanel
- `files/` — FilePanel, FileTree
- `plan/` — PlanModeBanner, PlanApproval
- `modals/` — AskUserQuestionModal
- `notifications/` — ToastContainer, NotificationCenter

## IPC Bridge

The GUI communicates with the Cleak backend via `gui/src/renderer/lib/bridge.ts`:
- `useBridgeWiring()` — subscribes to status/frame/error events
- `switchSession()` — saves current session, activates target, loads messages
- `restartBridgeForNewSession()` — spawns new Claude process
- `sendUser()` — sends user message to bridge

IPC channels are defined in `gui/src/main/ipc.ts`. The main process wires them in `gui/src/main/index.ts`.

## Zustand Store Patterns

All stores follow the same pattern in `gui/src/renderer/store/`:

```typescript
interface StoreState {
  // state fields
  someValue: Type;
  // actions
  setSomeValue(v: Type): void;
}

export const useStore = create<StoreState>((set, get) => ({
  someValue: initialValue,
  setSomeValue: (v) => set({ someValue: v }),
}));
```

Existing stores: `chat`, `ui`, `sessions`, `tasks`, `todos`, `agents`, `terminals`, `search`, `editor`, `contextUsage`, `notifications`, `memory`, `settings`.

## Theming

CSS custom properties in `styles.css`:
- `--bg-base`, `--bg-panel`, `--bg-hover`, `--bg-active` — backgrounds
- `--border` — borders
- `--text-primary`, `--text-muted`, `--text-subtle` — text colors
- `--accent`, `--accent-fg` — accent colors
- `--activity-w`, `--side-w`, `--right-w` — panel widths

Three themes: `dark`, `light`, `high-contrast`. Set via `data-theme` attribute on `<html>`.
