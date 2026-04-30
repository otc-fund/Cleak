import { join } from 'node:path';
import { app } from 'electron';
import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';

const VERSION = '0.1.0';

/** JSONL history file — matches Claude's {userData}/projects/default/history.jsonl layout. */
const HISTORY_FILE = join(app.getPath('userData'), 'projects', 'default', 'history.jsonl');

/**
 * Metadata entry appended to history.jsonl whenever a session is saved.
 */
export interface HistoryEntry {
  /** Unique ID for this history entry. */
  uuid: string;
  /** Claude's internal session_id. */
  sessionId: string;
  /** Human-readable session name. */
  sessionName: string;
  /** ISO-8601 timestamp when this entry was written. */
  timestamp: string;
  /** ISO-8601 of the session's last activity. */
  lastActive: string;
  /** Number of messages in the session. */
  messageCount: number;
  /** Estimated token count. */
  tokenCount: number;
  /** Estimated cost in USD. */
  cost: number;
  /** Whether the session is pinned. */
  pinned: boolean;
  /** Version of the app that wrote this entry. */
  version: string;
}

function ensureDir(): void {
  const dir = join(app.getPath('userData'), 'projects', 'default');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Append a single history entry — appendFileSync, one JSON line.
 */
export function appendHistoryEntry(entry: HistoryEntry): void {
  ensureDir();
  appendFileSync(HISTORY_FILE, JSON.stringify(entry) + '\n', 'utf8');
}

/**
 * Read all history entries from the JSONL file.
 * Corrupted/truncated lines are silently skipped.
 */
export function loadHistory(): HistoryEntry[] {
  if (!existsSync(HISTORY_FILE)) return [];
  try {
    const content = readFileSync(HISTORY_FILE, 'utf8');
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const entries: HistoryEntry[] = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as HistoryEntry);
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
 * Return the latest history entry per sessionId, keyed by sessionId.
 * This gives the "current state" of each session.
 */
export function getLatestSessions(): Map<string, HistoryEntry> {
  const entries = loadHistory();
  const map = new Map<string, HistoryEntry>();
  // Process in order — last entry for each sessionId wins
  for (const entry of entries) {
    map.set(entry.sessionId, entry);
  }
  return map;
}

/**
 * Build a history entry from a PersistedSession and append it.
 */
export function recordSessionHistory(
  session: { id: string; name: string; createdAt: number; lastActive: number; messageCount: number; tokenCount: number; cost: number; pinned?: boolean },
): void {
  const entry: HistoryEntry = {
    uuid: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    sessionId: session.id,
    sessionName: session.name,
    timestamp: new Date().toISOString(),
    lastActive: new Date(session.lastActive).toISOString(),
    messageCount: session.messageCount,
    tokenCount: session.tokenCount,
    cost: session.cost,
    pinned: session.pinned ?? false,
    version: VERSION,
  };
  appendHistoryEntry(entry);
}
