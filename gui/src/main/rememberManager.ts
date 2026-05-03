import { join, dirname } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, readdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';

/**
 * Claude-style remember system — saves session state for clean continuation.
 * Each session gets its own isolated directory under .remember/sessions/<sessionId>/.
 * Cross-session files (identity.md, remember.md) are shared intentionally.
 */

const REMEMBER_DIR = join(homedir(), '.remember');
const SESSIONS_DIR = join(REMEMBER_DIR, 'sessions');
const TMP_DIR = join(REMEMBER_DIR, 'tmp');
const PROJECT_REMEMBER = join(process.cwd(), '.remember');

export interface RememberConfig {
  cooldownSeconds: number;
  minMessagesBeforeSave: number;
  debug: boolean;
}

const DEFAULT_CONFIG: RememberConfig = {
  cooldownSeconds: 120,
  minMessagesBeforeSave: 3,
  debug: false,
};

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function init(): void {
  ensureDir(REMEMBER_DIR);
  ensureDir(SESSIONS_DIR);
  ensureDir(TMP_DIR);
  ensureDir(PROJECT_REMEMBER);

  // Self-gitignore
  const gitignorePath = join(REMEMBER_DIR, '.gitignore');
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, '# Auto-generated — memory files should not be committed\n*\n!.gitignore\n');
  }
}

/** Return the per-session directory for this sessionId. */
function sessionDir(sessionId: string): string {
  return join(SESSIONS_DIR, sessionId);
}

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  appendFileSync(join(TMP_DIR, 'pipeline.log'), line);
}

function now(): Date {
  return new Date();
}

function formatTimestamp(d: Date): string {
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

/**
 * Save a session to the remember pipeline.
 * Writes to the session's own now.md — NOT to any global file.
 */
export function saveSession(sessionId: string, messages: { role: string; blocks?: unknown[]; content?: string }[]): void {
  init();

  const config = DEFAULT_CONFIG;
  if (messages.length < config.minMessagesBeforeSave) {
    log(`[save] Skipping ${sessionId} — only ${messages.length} messages (min: ${config.minMessagesBeforeSave})`);
    return;
  }

  // Per-session cooldown
  const cooldownPath = join(TMP_DIR, `save-cooldown-${sessionId}`);
  if (existsSync(cooldownPath)) {
    const mtime = parseInt(readFileSync(cooldownPath, 'utf8').trim(), 10);
    const elapsed = (Date.now() - mtime) / 1000;
    if (elapsed < config.cooldownSeconds) {
      if (config.debug) log(`[save] Cooldown active (${Math.round(elapsed)}s/${config.cooldownSeconds}s) for ${sessionId}`);
      return;
    }
  }

  // Write per-session cooldown
  writeFileSync(cooldownPath, Date.now().toString());

  const exchanges = extractExchanges(messages);
  if (exchanges.length === 0) {
    log(`[save] No meaningful exchanges for ${sessionId}`);
    return;
  }

  // Write to session's own now.md
  const sessDir = sessionDir(sessionId);
  ensureDir(sessDir);
  const nowMd = buildNowMd(sessionId, exchanges);
  writeFileSync(join(sessDir, 'now.md'), nowMd);
  log(`[save] Wrote now.md for ${sessionId} (${exchanges.length} exchanges)`);
}

interface Exchange {
  user: string;
  assistant: string;
  timestamp: string;
}

/**
 * Extract user/assistant exchanges from messages.
 */
function extractExchanges(messages: { role: string; blocks?: unknown[]; content?: string }[]): Exchange[] {
  const exchanges: Exchange[] = [];
  let lastUser: Exchange | null = null;

  for (const msg of messages) {
    if (msg.role === 'user') {
      const text = extractText(msg);
      if (text) {
        lastUser = { user: text, assistant: '', timestamp: formatTimestamp(now()) };
        exchanges.push(lastUser);
      }
    } else if (msg.role === 'assistant' && lastUser) {
      const text = extractText(msg);
      if (text) {
        lastUser.assistant = text;
      }
    }
  }

  return exchanges;
}

function extractText(msg: { blocks?: unknown[]; content?: string }): string {
  if (msg.content) return truncate(msg.content, 1000);
  if (msg.blocks && Array.isArray(msg.blocks)) {
    const texts = msg.blocks
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');
    return truncate(texts, 1000);
  }
  return '';
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '...(truncated)';
}

function buildNowMd(sessionId: string, exchanges: Exchange[]): string {
  const lines: string[] = [
    `# Session Buffer — ${formatTimestamp(now())}`,
    `Session: ${sessionId}`,
    '',
    '## Exchanges',
    '',
  ];

  for (let i = 0; i < exchanges.length; i++) {
    const ex = exchanges[i];
    if (!ex) continue;
    lines.push(`### Exchange ${i + 1}`);
    lines.push(`**User:** ${ex.user}`);
    if (ex.assistant) {
      lines.push(`**Assistant:** ${ex.assistant}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Load session-specific memory.
 * Only reads from the session's own directory.
 * Cross-global files (identity.md, remember.md) are NOT included —
 * those are intentional user-managed notes, not session context.
 */
export function loadSessionMemory(sessionId: string): string | null {
  init();

  const sessDir = sessionDir(sessionId);
  const parts: string[] = [];

  // Session's own now.md (current session buffer)
  const nowPath = join(sessDir, 'now.md');
  if (existsSync(nowPath)) {
    parts.push('## Current Session Buffer\n' + readFileSync(nowPath, 'utf8'));
  }

  if (parts.length === 0) return null;

  return [
    '# Remembered Context',
    '',
    'The following context was loaded from this session.',
    '',
    ...parts,
    '',
    '[End of remembered context. Continue from here.]',
  ].join('\n');
}

/**
 * Write a handoff note. These ARE cross-session — the user writes a note
 * to carry into the next session intentionally.
 */
export function writeHandoffNote(content: string): void {
  init();
  writeFileSync(join(REMEMBER_DIR, 'remember.md'), content);
  log('[handoff] Wrote remember.md');
}
