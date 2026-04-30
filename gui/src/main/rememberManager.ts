import { join, dirname } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, readdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';

/**
 * Claude-style remember system — saves session state for clean continuation.
 * Mirrors the remember plugin architecture but implemented natively in Node.js.
 */

const REMEMBER_DIR = join(homedir(), '.remember');
const LOGS_DIR = join(REMEMBER_DIR, 'logs');
const TMP_DIR = join(REMEMBER_DIR, 'tmp');
const PROJECT_REMEMBER = join(process.cwd(), '.remember');

export interface RememberConfig {
  cooldownSeconds: number;
  minMessagesBeforeSave: number;
  ndcIntervalSeconds: number;
  ndcEnabled: boolean;
  recoveryEnabled: boolean;
  debug: boolean;
}

const DEFAULT_CONFIG: RememberConfig = {
  cooldownSeconds: 120,
  minMessagesBeforeSave: 3,
  ndcIntervalSeconds: 3600,
  ndcEnabled: true,
  recoveryEnabled: true,
  debug: false,
};

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function init(): void {
  ensureDir(REMEMBER_DIR);
  ensureDir(LOGS_DIR);
  ensureDir(TMP_DIR);
  ensureDir(PROJECT_REMEMBER);

  // Self-gitignore
  const gitignorePath = join(REMEMBER_DIR, '.gitignore');
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, '# Auto-generated — memory files should not be committed\n*\n!.gitignore\n');
  }
}

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  appendFileSync(join(LOGS_DIR, 'pipeline.log'), line);
}

function now(): Date {
  return new Date();
}

function formatTimestamp(d: Date): string {
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

/**
 * Save a session to the remember pipeline.
 * Extracts exchanges and writes to now.md (current session buffer).
 * If NDC is due, compresses into daily files.
 */
export function saveSession(sessionId: string, messages: { role: string; blocks?: unknown[]; content?: string }[]): void {
  init();

  const config = DEFAULT_CONFIG;
  if (messages.length < config.minMessagesBeforeSave) {
    log(`[save] Skipping ${sessionId} — only ${messages.length} messages (min: ${config.minMessagesBeforeSave})`);
    return;
  }

  // Check cooldown
  const cooldownPath = join(TMP_DIR, 'save-cooldown');
  if (existsSync(cooldownPath)) {
    const mtime = parseInt(readFileSync(cooldownPath, 'utf8').trim(), 10);
    const elapsed = (Date.now() - mtime) / 1000;
    if (elapsed < config.cooldownSeconds) {
      if (config.debug) log(`[save] Cooldown active (${Math.round(elapsed)}s/${config.cooldownSeconds}s)`);
      return;
    }
  }

  // Write cooldown marker
  writeFileSync(cooldownPath, Date.now().toString());

  const exchanges = extractExchanges(messages);
  if (exchanges.length === 0) {
    log(`[save] No meaningful exchanges for ${sessionId}`);
    return;
  }

  // Write to now.md
  const nowMd = buildNowMd(sessionId, exchanges);
  writeFileSync(join(REMEMBER_DIR, 'now.md'), nowMd);
  log(`[save] Wrote now.md for ${sessionId} (${exchanges.length} exchanges)`);

  // Check if NDC compression is due
  if (config.ndcEnabled) {
    const lastNdc = getLastNdcTimestamp();
    const elapsed = (Date.now() - lastNdc) / 1000;
    if (elapsed >= config.ndcIntervalSeconds) {
      compressDaily(sessionId, exchanges);
    }
  }
}

interface Exchange {
  user: string;
  assistant: string;
  timestamp: string;
}

/**
 * Extract user/assistant exchanges from messages.
 * Truncates long blocks to keep summaries concise.
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
 * Compress current exchanges into a daily summary file.
 */
function compressDaily(sessionId: string, exchanges: Exchange[]): void {
  const today = new Date().toISOString().split('T')[0];
  const dailyFile = join(REMEMBER_DIR, `today-${today}.md`);

  const lines: string[] = [
    `# Daily Summary — ${today}`,
    '',
    '## Sessions',
    '',
  ];

  for (const ex of exchanges) {
    lines.push(`- **User:** ${ex.user.slice(0, 150)}`);
    if (ex.assistant) {
      lines.push(`  **Assistant:** ${ex.assistant.slice(0, 150)}`);
    }
    lines.push('');
  }

  appendFileSync(dailyFile, lines.join('\n') + '\n');
  log(`[compress] Wrote ${dailyFile}`);

  // Update NDC timestamp
  writeFileSync(join(TMP_DIR, 'last-ndc'), Date.now().toString());

  // Consolidate into recent.md (last 7 days)
  consolidateRecent();
}

function getLastNdcTimestamp(): number {
  const ndcPath = join(TMP_DIR, 'last-ndc');
  if (existsSync(ndcPath)) {
    return parseInt(readFileSync(ndcPath, 'utf8').trim(), 10);
  }
  return 0;
}

/**
 * Build recent.md from the last 7 days of daily summaries.
 */
function consolidateRecent(): void {
  const today = new Date();
  const files: string[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const file = join(REMEMBER_DIR, `today-${dateStr}.md`);
    if (existsSync(file)) {
      files.push(file);
    }
  }

  if (files.length === 0) return;

  const content = files
    .map(f => readFileSync(f, 'utf8'))
    .join('\n\n---\n\n');

  writeFileSync(join(REMEMBER_DIR, 'recent.md'), content);
  log(`[consolidate] Wrote recent.md (${files.length} days)`);
}

/**
 * Load all memory files for injection into a new session.
 * Returns a formatted context block that Claude reads at session start.
 */
export function loadSessionMemory(): string | null {
  init();

  const parts: string[] = [];

  // Identity
  const identityPath = join(REMEMBER_DIR, 'identity.md');
  if (existsSync(identityPath)) {
    parts.push('## Identity\n' + readFileSync(identityPath, 'utf8'));
  }

  // Handoff note (remember.md)
  const rememberPath = join(REMEMBER_DIR, 'remember.md');
  if (existsSync(rememberPath)) {
    parts.push('## Handoff Note (Last Session)\n' + readFileSync(rememberPath, 'utf8'));
  }

  // Now.md (current session buffer)
  const nowPath = join(REMEMBER_DIR, 'now.md');
  if (existsSync(nowPath)) {
    parts.push('## Current Session Buffer\n' + readFileSync(nowPath, 'utf8'));
  }

  // Today
  const today = new Date().toISOString().split('T')[0];
  const todayPath = join(REMEMBER_DIR, `today-${today}.md`);
  if (existsSync(todayPath)) {
    parts.push("## Today's Summary\n" + readFileSync(todayPath, 'utf8'));
  }

  // Recent (last 7 days)
  const recentPath = join(REMEMBER_DIR, 'recent.md');
  if (existsSync(recentPath)) {
    parts.push('## Recent History (Last 7 Days)\n' + readFileSync(recentPath, 'utf8'));
  }

  // Archive
  const archivePath = join(REMEMBER_DIR, 'archive.md');
  if (existsSync(archivePath)) {
    parts.push('## Archive\n' + readFileSync(archivePath, 'utf8'));
  }

  if (parts.length === 0) return null;

  return [
    '# Remembered Context',
    '',
    'The following context was loaded from your previous sessions.',
    '',
    ...parts,
    '',
    '[End of remembered context. Continue from here.]',
  ].join('\n');
}

/**
 * Write a handoff note (triggered by /remember or session end).
 */
export function writeHandoffNote(content: string): void {
  init();
  writeFileSync(join(REMEMBER_DIR, 'remember.md'), content);
  log('[handoff] Wrote remember.md');
}

/**
 * Clean up old daily files (keep last 30 days).
 */
export function cleanupOldFiles(): void {
  init();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const files = readdirSync(REMEMBER_DIR).filter(f => f.startsWith('today-') && f.endsWith('.md'));
  for (const f of files) {
    const dateStr = f.replace('today-', '').replace('.md', '');
    const fileDate = new Date(dateStr);
    if (fileDate < cutoff) {
      unlinkSync(join(REMEMBER_DIR, f));
      log(`[cleanup] Removed ${f}`);
    }
  }
}
