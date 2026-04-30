---
name: cleak-ipc-bridge
description: IPC patterns between Cleak Desktop GUI and the Cleak backend
---

Use this skill when working on IPC channels, the bridge layer, or main/renderer process communication.

## Architecture

```
┌─────────────────────────────────┐
│ Electron Main Process           │  gui/src/main/
│  - index.ts          (entry)    │
│  - ipc.ts            (channels) │
│  - sessionsStore.ts  (persist)  │
└───────────┬─────────────────────┘
            │ IPC channels
┌───────────▼─────────────────────┐
│ Electron Preload                │  gui/src/preload/
│  - index.ts  (exposes bridge)   │
└───────────┬─────────────────────┘
            │ window.bridge
┌───────────▼─────────────────────┐
│ React Renderer                  │  gui/src/renderer/
│  - lib/bridge.ts   (API)        │
│  - store/chat.ts   (messages)   │
└─────────────────────────────────┘
```

## IPC Channel Patterns

Channels are defined in `gui/src/main/ipc.ts`:

```typescript
export const IpcChannels = {
  status:           'bridge:status',
  frame:            'bridge:frame',
  error:            'bridge:error',
  // ... handler: 'bridge:handlerName'
} as const;
```

### Renderer → Main (request/response)
```typescript
// Renderer
const result = await window.bridge.someAction(args);

// Main
ipcMain.handle(IpcChannels.someAction, (_e, args) => {
  return doSomething(args);
});
```

### Main → Renderer (events)
```typescript
// Main
win.webContents.send(IpcChannels.status, { kind: 'running', sessionId: id });

// Renderer (in useBridgeWiring)
const off = window.bridge.onStatus((s) => { setStatus(s); });
```

## Key IPC Flows

### Session switch
1. Renderer calls `window.bridge.activateSession(sessionId)` → Main
2. Main calls `setActiveBridge(managed)` → sends status event with `reloadMessages: true`
3. Renderer's `useBridgeWiring` receives status → reloads messages from JSONL
4. Renderer updates chat store via `setStateForSession(messages, sessionId)`

### User message
1. Renderer calls `window.bridge.sendUserMessage(text)`
2. Main forwards to active bridge
3. Bridge sends frames back via `win.webContents.send(IpcChannels.frame, frame)`
4. Renderer's `ingestFrame()` processes the frame into chat messages

### File operations
```typescript
// List files
const tree = await window.bridge.listFiles();
// Read file
const content = await window.bridge.readFile(path);
// Write file
await window.bridge.writeFile(path, content);
```

## Rules

1. **Never call IPC from a store directly** — use the bridge API in `lib/bridge.ts`.
2. **Channel names are prefixed** — `bridge:*`, `files:*`, `settings:*`, etc.
3. **Error handling** — wrap IPC calls in try/catch; surface errors via `pushError()`.
4. **Async IPC** — always `await` handler calls; don't fire-and-forget unless intentional (`void`).
