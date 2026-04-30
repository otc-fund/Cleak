---
name: cleak-testing
description: Testing patterns for the Cleak Desktop GUI
---

Use this skill when writing tests, reviewing test code, or debugging test failures in `gui/tests/`.

## Test Structure

Tests live in `gui/tests/` using **Vitest**. Config is in `gui/vitest.config.ts`.

```
gui/tests/
  uiStore.test.ts        # Zustand store tests
  memory/
    memoryStore.test.ts  # Memory-specific tests
```

## Patterns

### Store testing
```typescript
import { useStore } from '../src/renderer/store/storeName';

describe('useStore', () => {
  beforeEach(() => {
    useStore.setState({ /* reset to known state */ });
  });

  it('does something', () => {
    useStore.getState().someAction();
    expect(useStore.getState().someValue).toBe(expected);
  });
});
```

### Testing with async actions
```typescript
it('loads data', async () => {
  await useStore.getState().loadData();
  expect(useStore.getState().items).toHaveLength(3);
});
```

## Commands

```bash
cd gui
npm test           # Run all tests
npm run typecheck  # Type check only
```

## Rules

1. **Test behavior, not implementation** — assert on store state, not on internal calls.
2. **Reset state in `beforeEach`** — stores are singletons; tests leak state.
3. **No mocks for simple stores** — test the real store logic.
4. **Mock IPC calls** — use `vi.mock()` for `window.bridge` methods when testing components that depend on IPC.
