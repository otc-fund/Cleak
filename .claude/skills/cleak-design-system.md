---
name: cleak-design-system
description: Design system and styling patterns for Cleak Desktop GUI
---

Use this skill when styling components, creating new UI elements, or reviewing visual design in the Cleak GUI.

## Color Palette

CSS custom properties in `gui/src/renderer/styles.css`:

### Backgrounds
- `--bg-base` (#0b0b0b) — page background
- `--bg-panel` (#141414) — panel backgrounds
- `--bg-hover` (#1e1e1e) — hover state
- `--bg-active` (#252525) — active/selected state

### Text
- `--text-primary` (#e4e4e7) — primary text
- `--text-muted` (#71717a) — secondary/muted text
- `--text-subtle` (#3f3f46) — tertiary/subtle text

### Other
- `--border` (#2a2a2a) — borders
- `--accent` (#3b82f6) — accent color (blue)
- `--accent-fg` (#ffffff) — text on accent bg

### Layout
- `--activity-w: 3rem` — activity bar width
- `--side-w: 16rem` — side panel width
- `--right-w: 18rem` — right panel width
- `--status-h: 1.5rem` — status bar height

## Tailwind Classes

Common utility patterns:
- `text-muted` / `text-primary` — text colors
- `bg-hover` / `bg-active` / `bg-panel` — backgrounds
- `border-border` — border color
- `transition-colors` — smooth color transitions
- `shrink-0` — prevent flex shrinking
- `min-h-0` / `min-w-0` — fix flex overflow issues
- `overflow-hidden` / `overflow-auto` — scrolling

## Layout Rules

1. **Flex column for vertical layouts** — `flex flex-col` on containers.
2. **`flex-1 min-h-0` for scrollable areas** — this is critical for containing overflow within flex children.
3. **`shrink-0` for fixed-size panels** — ActivityBar, SidePanel, StatusBar should not shrink.
4. **No fixed heights** — use flex growth/shrink, not `h-96` or `height: 400px`.

## Themes

Three themes controlled by `data-theme` on `<html>`:
- `dark` — default, dark grays with blue accent
- `light` — light grays, same structure
- `high-contrast` — pure black/white, high contrast borders

Add new theme colors by extending all three `[data-theme]` blocks in `styles.css`.

## Anti-patterns

- **No inline `style={{}}` for colors** — use Tailwind classes or CSS vars.
- **No hardcoded colors** — always use CSS custom properties.
- **No `!important`** — fix specificity instead.
- **No fixed pixel heights on flex containers** — use flex properties.
