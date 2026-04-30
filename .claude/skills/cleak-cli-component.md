---
name: cleak-cli-component
description: Build and edit Cleak CLI components (Ink-based terminal UI)
---

Use this skill when adding new CLI commands, editing existing commands, or reviewing CLI TUI code in `cleak/src/`.

## Architecture

- **Framework**: Ink (React for terminal) — NOT the Electron GUI
- **Entry**: `cleak/src/ink/components/App.tsx`
- **Commands**: `cleak/src/commands/` — each command is a self-contained module
- **Components**: `cleak/src/components/` — shared UI primitives
- **Design System**: `cleak/src/components/design-system/` — ThemedBox, ThemedText, Dialog, Pane, etc.

## Command Structure

Each command in `cleak/src/commands/<name>/` typically has:
- `index.ts` — command registration and main JSX component
- Additional files for complex logic

Commands register via the command registry and render as Ink JSX.

## Ink Components

Core Ink primitives:
- `<Box>` — layout container (flex-like)
- `<Text>` — text output with color/style support
- `<Newline>` — line break
- `<Spacer>` — flexible space
- `<Link>` — clickable terminal link

Custom design system components in `cleak/src/components/design-system/`:
- `ThemedBox` — themed container
- `ThemedText` — themed text with automatic color mapping
- `Dialog` — modal-like overlay
- `Pane` — panel container
- `ProgressBar` — progress indicator
- `Divider` — separator line

## Styling

Terminal UI uses Ink's style prop, not CSS:
```tsx
<Box flexDirection="column" padding={1}>
  <Text color="blue">Hello</Text>
</Box>
```

Colors: `blue`, `green`, `yellow`, `red`, `magenta`, `cyan`, `white`, `gray`, `black`.
Styles: `bold`, `dim`, `italic`, `underline`, `strikethrough`.

## Context

- `AppContext` — app-wide state
- `ModalContext` — modal dialog management
- `OverlayContext` — overlay management
- `TerminalSizeContext` — terminal dimensions

## Rules

1. **Use design system components** (`ThemedBox`, `ThemedText`) instead of raw Ink components where available.
2. **Commands are self-contained** — don't share state between commands except through context.
3. **Respect terminal size** — use `TerminalSizeContext` for responsive layouts.
4. **No CSS** — this is terminal output, not a browser.
