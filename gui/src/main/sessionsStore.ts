import { join } from 'node:path';
import { app } from 'electron';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SESSIONS_FILE = join(app.getPath('userData'), 'sessions.json');

export interface PersistedSession {
  id: string;
  name: string;
  createdAt: number;
  lastActive: number;
  messageCount: number;
  tokenCount: number;
  cost: number;
  pinned?: boolean;
}

export function loadSessions(): PersistedSession[] {
  if (!existsSync(SESSIONS_FILE)) return [];
  try {
    return JSON.parse(readFileSync(SESSIONS_FILE, 'utf8')) as PersistedSession[];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: PersistedSession[]): void {
  const dir = app.getPath('userData');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf8');
}
