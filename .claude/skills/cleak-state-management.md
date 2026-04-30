---
name: cleak-state-management
description: Patterns for Zustand stores in the Cleak Desktop GUI
---

Use this skill when creating or modifying Zustand stores in `gui/src/renderer/store/`.

## Store Conventions

1. **One store per domain** — each store manages one area of state. Don't combine unrelated state into one store.
2. **Actions are functions on the store** — defined inside `create()`, not as external functions.
3. **No middleware unless necessary** — the existing stores use plain `create()`. Don't add persist, devtools, etc. unless explicitly requested.
4. **Cross-store reads use `getState()`** — never `useOtherStore()` inside a store's action.

## Common Patterns

### Basic store
```typescript
export const useStore = create<StoreState>((set, get) => ({
  value: initial,
  setValue: (v) => set({ value: v }),
}));
```

### Action that reads current state
```typescript
toggleFlag() {
  const { flag } = get();
  set({ flag: !flag });
}
```

### Action that updates an item in an array
```typescript
updateItem(id, patch) {
  set(s => ({
    items: s.items.map(item =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  }));
}
```

### Async action
```typescript
async loadItems() {
  const data = await api.fetch();
  set({ items: data });
}
```

### Cross-store access
```typescript
// Inside an action in store A, reading store B:
import { useStoreB } from './storeB';
// ...
const bState = useStoreB.getState();
```

## Stores Overview

| Store | Purpose | Key state |
|-------|---------|-----------|
| `chat` | Messages, bridge status, cost | `messages`, `status`, `activeSessionId`, `framesBlocked` |
| `ui` | UI state: panels, tabs, theme | `activeActivity`, `sidePanelOpen`, `chatSideTab`, `theme` |
| `sessions` | Session list, current session | `sessions`, `currentSession` |
| `tasks` | Task tree, task output | `tasks`, `activeTaskId` |
| `todos` | Todo list | `todos` |
| `agents` | Agent registry, messages | `agents`, `activeAgentId`, `messages` |
| `terminals` | Terminal tabs | `tabs`, `activeTabId` |
| `search` | Grep/glob results | `globResults`, `grepResults` |
| `editor` | File highlights, open files | `highlights`, `openFiles` |
| `contextUsage` | Token usage display | `totalTokens`, `usedTokens` |
| `notifications` | Toast notifications | `notifications` |
| `memory` | Memory files | `memoryFiles`, `selectedMemory` |
| `settings` | App settings | `theme`, `keybindings`, `model` |

## Anti-patterns

- **Don't** use `useState` in components for data that should be global.
- **Don't** pass store values as props through multiple levels — subscribe directly in the component that needs them.
- **Don't** call `set()` with a function unless you need the previous state.
- **Don't** create derived state in the store — compute it in the component or a selector.
