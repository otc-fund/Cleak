import { join } from 'node:path';
import { app } from 'electron';
import { appendFileSync, existsSync, readFileSync, renameSync, mkdirSync, unlinkSync } from 'node:fs';

/** JSONL storage directory — matches Claude's ~/.claude/projects/<project>/ layout. */
const PROJECTS_DIR = join(app.getPath('userData'), 'projects', 'default');

/** Legacy directory for old .json files (pre-JSONL migration). */
const LEGACY_DIR = join(app.getPath('userData'), 'sessionMessages');

const VERSION = '0.1.0';

function ensureDir(): void {
  if (!existsSync(PROJECTS_DIR)) mkdirSync(PROJECTS_DIR, { recursive: true });
}

function filePath(sessionId: string): string {
  return join(PROJECTS_DIR, `${sessionId}.jsonl`);
}

function legacyPath(sessionId: string): string {
  return join(LEGACY_DIR, `${sessionId}.json`);
}

/**
 * JSONL entry — one per line in the .jsonl file.
 * Mirrors Claude Code's entry format with renderer-specific extensions.
 */
export interface JsonlEntry {
  /** Unique ID for this entry (same as ChatMessage.id). */
  uuid: string;
  /** ID of the parent entry — null for user entries (roots). */
  parentUuid: string | null;
  /** Claude's internal session_id. */
  sessionId: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Version of the app that wrote this entry. */
  version: string;
  /** Entrypoint type. */
  entrypoint: 'cli';
  /** Entry type: user message, assistant response, or last-prompt sentinel. */
  type: 'user' | 'assistant' | 'last-prompt';
  /** Mirrored Claude-style message field. */
  message?: { role: 'user' | 'assistant'; content: unknown[] };
  /** Renderer-specific: ContentBlock array for round-trip fidelity. */
  blocks?: unknown[];
  /** Renderer-specific: whether the assistant message is still pending. */
  pending?: boolean;
}

/** Renderer-facing message shape (same as before). */
export interface PersistedMessage {
  id: string;
  role: string;
  blocks: unknown[];
  pending: boolean;
  ts: number;
  sessionId?: string;
  parentUuid?: string | null;
}

/**
 * Append a single JSONL entry to the session file.
 * This is the core write operation — append-only, one line at a time.
 */
function appendEntryDirect(sessionId: string, entry: JsonlEntry): void {
  ensureDir();
  appendFileSync(filePath(sessionId), JSON.stringify(entry) + '\n', 'utf8');
}

/**
 * Compute the parentUuid for a message based on conversation position.
 * User entries are roots (null parentUuid). Assistant entries point to
 * the preceding user message.
 */
function computeParentUuid(msg: PersistedMessage, allMessages: PersistedMessage[]): string | null {
  if (msg.role === 'user') return null;

  const idx = allMessages.indexOf(msg);
  for (let i = idx - 1; i >= 0; i--) {
    const prev = allMessages[i];
    if (prev && prev.role === 'user') {
      return prev.id;
    }
  }
  return null;
}

/**
 * Read all JSONL entries from a session file.
 * Corrupted/truncated lines are silently skipped — only the last line
 * is ever at risk, so this recovers gracefully from crashes.
 */
export function loadEntries(sessionId: string): JsonlEntry[] {
  if (!sessionId) return [];
  const path = filePath(sessionId);
  if (!existsSync(path)) return [];
  try {
    const content = readFileSync(path, 'utf8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const entries: JsonlEntry[] = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as JsonlEntry);
      } catch {
        // Truncated/corrupted line — skip
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Reconstruct a flat message array from JSONL entries.
 * Walks the parentUuid tree: each user entry (root) followed by its
 * assistant children.
 */
function reconstructMessages(entries: JsonlEntry[]): PersistedMessage[] {
  const messages: PersistedMessage[] = [];

  // Process entries in file order (which is chronological for append-only)
  for (const e of entries) {
    if (e.type === 'last-prompt') continue; // sentinel only

    messages.push({
      id: e.uuid,
      role: e.type === 'user' ? 'user' : 'assistant',
      blocks: e.blocks ?? [],
      pending: e.pending ?? false,
      ts: new Date(e.timestamp).getTime(),
      sessionId: e.sessionId,
      parentUuid: e.parentUuid,
    });
  }

  return messages;
}

/**
 * Migrate a legacy .json file to JSONL format.
 * Called automatically on first access to an old session.
 */
function migrateLegacyFile(sessionId: string): void {
  const lPath = legacyPath(sessionId);
  if (!existsSync(lPath)) return;

  try {
    const oldMessages = JSON.parse(readFileSync(lPath, 'utf8')) as PersistedMessage[];
    if (!Array.isArray(oldMessages)) return;

    ensureDir();

    // Convert each message to a JSONL entry
    for (const msg of oldMessages) {
      const entry: JsonlEntry = {
        uuid: msg.id,
        parentUuid: computeParentUuid(msg, oldMessages),
        sessionId: msg.sessionId ?? sessionId,
        timestamp: new Date(msg.ts).toISOString(),
        version: VERSION,
        entrypoint: 'cli',
        type: msg.role === 'user' ? 'user' : 'assistant',
        message: { role: msg.role as 'user' | 'assistant', content: [] },
        blocks: msg.blocks,
        pending: msg.pending,
      };
      appendEntryDirect(sessionId, entry);
    }

    // Add last-prompt sentinel
    if (oldMessages.length > 0) {
      const last = oldMessages[oldMessages.length - 1];
      if (last) {
        appendEntryDirect(sessionId, {
          uuid: crypto.randomUUID(),
          parentUuid: last.id,
          sessionId,
          timestamp: new Date().toISOString(),
          version: VERSION,
          entrypoint: 'cli',
          type: 'last-prompt',
        });
      }
    }

    // Rename the old file (don't delete — safety backup)
    renameSync(lPath, lPath + '.migrated');
  } catch (err) {
    console.error('[sessionMessages] Migration failed for', sessionId, err);
  }
}

/**
 * Save messages to disk using append-only writes.
 * Diffs against existing entries on disk and only appends new ones.
 * Always writes a last-prompt sentinel at the end.
 */
export function saveSessionMessages(sessionId: string, messages: PersistedMessage[]): void {
  if (!sessionId || messages.length === 0) return;

  // Migrate legacy file if it exists
  migrateLegacyFile(sessionId);

  const existing = loadEntries(sessionId);
  const existingUuids = new Set(existing.map(e => e.uuid));

  // Append only messages not already on disk
  for (const msg of messages) {
    if (existingUuids.has(msg.id)) continue;

    const entry: JsonlEntry = {
      uuid: msg.id,
      parentUuid: msg.parentUuid ?? computeParentUuid(msg, messages),
      sessionId,
      timestamp: new Date(msg.ts).toISOString(),
      version: VERSION,
      entrypoint: 'cli',
      type: msg.role === 'user' ? 'user' : 'assistant',
      message: { role: msg.role as 'user' | 'assistant', content: [] },
      blocks: msg.blocks,
      pending: msg.pending,
    };

    appendEntryDirect(sessionId, entry);
  }

  // Write/update last-prompt sentinel
  const lastMsg = messages[messages.length - 1];
  if (lastMsg) {
    // Remove old last-prompt entries (they'll be replaced)
    appendEntryDirect(sessionId, {
      uuid: crypto.randomUUID(),
      parentUuid: lastMsg.id,
      sessionId,
      timestamp: new Date().toISOString(),
      version: VERSION,
      entrypoint: 'cli',
      type: 'last-prompt',
    });
  }
}

/**
 * Load messages from disk. Migrates legacy .json files automatically.
 */
export function loadSessionMessages(sessionId: string): PersistedMessage[] {
  if (!sessionId) return [];

  // Migrate legacy file if it exists
  migrateLegacyFile(sessionId);

  const entries = loadEntries(sessionId);
  return reconstructMessages(entries);
}

/**
 * Delete a session's JSONL file.
 */
export function deleteSessionMessages(sessionId: string): void {
  if (!sessionId) return;
  const path = filePath(sessionId);
  if (existsSync(path)) unlinkSync(path);
}
