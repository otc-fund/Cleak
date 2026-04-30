import { join } from 'node:path';
import { app } from 'electron';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';

const VERSION = '0.1.0';

/** Directory for active session files — Claude's {userData}/sessions/ layout. */
const ACTIVE_DIR = join(app.getPath('userData'), 'sessions');

/** Metadata for a currently-active Claude session. */
export interface ActiveSession {
  /** OS process ID of the Electron renderer that owns this session. */
  pid: number;
  /** Claude's internal session_id. */
  sessionId: string;
  /** Working directory the claude process was spawned with. */
  cwd: string;
  /** ISO-8601 timestamp when the session started. */
  startedAt: string;
  /** Version of the app that created this session. */
  version: string;
  /** Kind of entrypoint. */
  kind: 'headless';
  /** Entrypoint identifier. */
  entrypoint: 'gui';
  /** Current status. */
  status: 'started' | 'running' | 'stopped';
}

function ensureDir(): void {
  if (!existsSync(ACTIVE_DIR)) mkdirSync(ACTIVE_DIR, { recursive: true });
}

function filePath(pid: number): string {
  return join(ACTIVE_DIR, `${pid}.json`);
}

/**
 * Register an active session — writes {userData}/sessions/{pid}.json.
 * Call when the bridge starts and gets a session_id from Claude.
 */
export function registerActiveSession(sessionId: string, cwd: string): void {
  ensureDir();
  const session: ActiveSession = {
    pid: process.pid,
    sessionId,
    cwd,
    startedAt: new Date().toISOString(),
    version: VERSION,
    kind: 'headless',
    entrypoint: 'gui',
    status: 'started',
  };
  writeFileSync(filePath(process.pid), JSON.stringify(session, null, 2), 'utf8');
}

/**
 * Unregister an active session — deletes {userData}/sessions/{pid}.json.
 * Call when the bridge stops or the window closes.
 */
export function unregisterActiveSession(pid: number = process.pid): void {
  const path = filePath(pid);
  if (existsSync(path)) unlinkSync(path);
}

/**
 * Load all active session metadata files.
 * Returns an array of ActiveSession — stale PIDs (dead processes) are flagged.
 */
export function loadActiveSessions(): ActiveSession[] {
  if (!existsSync(ACTIVE_DIR)) return [];

  const files = readdirSync(ACTIVE_DIR).filter(f => f.endsWith('.json'));
  const sessions: ActiveSession[] = [];
  for (const f of files) {
    try {
      const session = JSON.parse(readFileSync(join(ACTIVE_DIR, f), 'utf8')) as ActiveSession;
      sessions.push(session);
    } catch {
      // Corrupted file — skip
    }
  }
  return sessions;
}

/**
 * Check if a session_id is currently active.
 */
export function isSessionActive(sessionId: string): boolean {
  return loadActiveSessions().some(s => s.sessionId === sessionId);
}
