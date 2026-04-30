---
name: cleak-memory
description: Patterns for the Cleak memory system (private + team memories)
---

Use this skill when working on the memory feature in either Cleak CLI or Cleak Desktop GUI.

## Architecture

Memories live in `.claude/memories/` inside the project directory:

```
.claude/memories/
  MEMORY.md              # Index file — loaded every session
  user_role.md           # Individual memory files
  feedback_testing.md
  project_info.md
```

## Memory File Format

Each memory file has YAML frontmatter + markdown body:

```markdown
---
name: feedback_testing
description: Integration tests must hit real database
type: feedback
---

Integration tests must use a real database, not mocks.

**Why:** Prior incident where mock/prod divergence masked a broken migration.
**How to apply:** When writing tests for data access layers, use the real test database.
```

## Memory Types

| Type | Purpose | Scope |
|------|---------|-------|
| `user` | User's role, goals, knowledge | Always private |
| `feedback` | Guidance on how to approach work | Private (preference) or team (convention) |
| `project` | Ongoing work context, decisions, deadlines | Private or team |
| `reference` | Pointers to external systems | Usually team |

## What NOT to Save

- Code patterns, architecture, file paths — derivable from code
- Git history — use `git log`
- Debugging solutions — the fix is in the code
- Anything in CLAUDE.md
- Ephemeral task details

## Core Files

- `cleak/src/memdir/memoryTypes.ts` — type definitions, section templates
- `cleak/src/commands/memory/memory.tsx` — CLI memory command
- `gui/src/renderer/components/memory/` — GUI memory browser, editor, card
- `gui/src/renderer/store/memory.ts` — GUI memory store
- `gui/src/main/memory-hooks.ts` — main process memory hooks

## Scope Rules

- **Private**: personal preferences, individual feedback, user-specific context
- **Team**: project-wide conventions, shared decisions, external system references
- Default feedback to private unless it's clearly a project-wide convention
- Default project to team unless it's personal context
- User memories are always private
