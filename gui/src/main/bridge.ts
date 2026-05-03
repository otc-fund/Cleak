import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { CleakInboundFrame, buildUserFrame } from './cleakProtocol';
import { NdjsonSplitter } from './ndjson';
import type { BridgeStatus } from './ipc';

export type SpawnFn = (
  cmd: string,
  args: readonly string[],
  opts: { cwd: string; env: NodeJS.ProcessEnv; stdio: 'pipe' },
) => ChildProcess;

export interface BridgeOptions {
  spawn: SpawnFn;
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** Absolute path to the Claude Code CLI binary (claude.exe on Windows). */
  claudeBin: string;
  bypassPermissions?: boolean;
  restart?: { maxAttempts: number; baseDelayMs: number };
  /** Compact context summary to prime the session — injected as first stdin message. */
  contextPriming?: string;
  /** Path to a temporary settings file that overrides global Claude settings. */
  settingsFile?: string;
}

export class CleakBridge extends EventEmitter {
  private child: ChildProcess | null = null;
  private splitter: NdjsonSplitter;
  private stoppedByUs = false;
  private attempt = 0;
  private sessionId: string | undefined;
  private readyTimeout: NodeJS.Timeout | null = null;

  constructor(private readonly opts: BridgeOptions) {
    super();
    this.splitter = this.makeSplitter();
  }

  private makeSplitter(): NdjsonSplitter {
    return new NdjsonSplitter(
      (v) => this.handleFrame(v),
      (e) => this.emit('error', { message: `parse error: ${e.line}` }),
    );
  }

  start(): void {
    this.stoppedByUs = false;
    this.spawnChild();
  }

  stop(): void {
    this.stoppedByUs = true;
    if (this.readyTimeout) { clearTimeout(this.readyTimeout); this.readyTimeout = null; }
    this.child?.kill();
  }

  sendUserMessage(text: string): void {
    if (!this.child?.stdin) return;
    const frame = buildUserFrame(text);
    this.child.stdin.write(JSON.stringify(frame) + '\n');
  }

  private spawnChild(): void {
    this.splitter = this.makeSplitter();
    this.setStatus({ kind: 'starting' });
    const args = [
      '--verbose',
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--bare',
    ];
    if (this.opts.bypassPermissions !== false) {
      args.push('--permission-mode', 'bypassPermissions');
    }
    if (this.opts.settingsFile) {
      args.push('--settings', this.opts.settingsFile);
    }
    const child = this.opts.spawn(this.opts.claudeBin, args, {
      cwd: this.opts.cwd,
      env: this.opts.env,
      stdio: 'pipe',
    });
    this.child = child;

    // Initial stdin nudge — some stream-json implementations need a first write
    setTimeout(() => {
      if (child.stdin && !child.killed) {
        child.stdin.write('\n');
        // Context priming: inject a compact session summary to restore continuity
        // without loading the full conversation history (prevents context bloat)
        if (this.opts.contextPriming) {
          const primingFrame = buildUserFrame(this.opts.contextPriming);
          child.stdin.write(JSON.stringify(primingFrame) + '\n');
        }
      }
    }, 500);

    // 5-second alive check — if process is silent, try stdin nudge
    setTimeout(() => {
      if (this.child === child && child.exitCode === null && !child.killed) {
        child.stdin?.write('\n');
      }
    }, 5000);

    child.on('error', (err) => {
      this.emit('error', { message: `spawn error: ${err.message}` });
      if (this.child === child) this.handleExit(-1);
    });
    child.stdout?.on('data', (b: Buffer) => this.splitter.feed(b));
    child.stderr?.on('data', (b: Buffer) => {
      const msg = b.toString('utf8');
      // Check if stderr contains NDJSON (some implementations write frames to stderr)
      for (const line of msg.split('\n').filter(l => l.trim().startsWith('{'))) {
        this.splitter.feed(Buffer.from(line + '\n'));
      }
      this.emit('error', { message: `stderr: ${msg}` });
    });
    child.on('exit', (code, signal) => {
      if (this.readyTimeout) { clearTimeout(this.readyTimeout); this.readyTimeout = null; }
      if (this.child !== child) return; // A newer child was spawned — ignore stale exit
      this.handleExit(code ?? -1);
    });

    // Fallback: if no system/init arrives within 3s, transition to running
    this.readyTimeout = setTimeout(() => {
      if (this.child !== child || child.exitCode !== null || child.killed) return;
      if (this.sessionId) return; // already connected
      this.setStatus({ kind: 'running', sessionId: undefined, protocolOk: false });
    }, 3000);
  }

  private handleFrame(value: unknown): void {
    const parsed = CleakInboundFrame.safeParse(value);
    if (!parsed.success) {
      this.emit('error', { message: `unrecognized frame: ${parsed.error.message}` });
      this.setStatus({ kind: 'running', sessionId: undefined, protocolOk: false });
      return;
    }
    const frame = parsed.data;
    if (frame.type === 'result') {
      const raw = value as Record<string, unknown>;
      console.log('[bridge] result frame - parsed has result:', 'result' in frame,
        'raw.result:', raw['result'],
        'parsed result:', (frame as any).result);
    }
    this.emit('frame', frame);

    if (frame.type === 'system' && frame.subtype === 'init') {
      this.attempt = 0;
      if (this.readyTimeout) { clearTimeout(this.readyTimeout); this.readyTimeout = null; }
      this.setStatus({ kind: 'running', sessionId: frame.session_id, protocolOk: true });
    }
    // Capture session_id from hook frames and transition to running (init frame may never arrive)
    if (frame.type === 'system' && frame.subtype?.startsWith('hook_')) {
      if (frame.session_id) this.sessionId = frame.session_id;
      if (this.attempt === 0) {
        if (this.readyTimeout) { clearTimeout(this.readyTimeout); this.readyTimeout = null; }
        this.setStatus({ kind: 'running', sessionId: this.sessionId, protocolOk: true });
      }
    }
  }

  private handleExit(code: number): void {
    const { maxAttempts = 3, baseDelayMs = 500 } = this.opts.restart ?? {};
    if (this.stoppedByUs) {
      this.setStatus({ kind: 'stopped', reason: 'user' });
      return;
    }
    if (this.attempt >= maxAttempts) {
      this.setStatus({
        kind: 'stopped',
        reason: `child exited (code=${code}); max restart attempts reached`,
      });
      return;
    }
    this.attempt += 1;
    const delay = baseDelayMs * 2 ** (this.attempt - 1);
    this.setStatus({
      kind: 'restarting',
      reason: `child exited (code=${code})`,
      attempt: this.attempt,
    });
    if (delay === 0) {
      setImmediate(() => this.spawnChild());
    } else {
      setTimeout(() => this.spawnChild(), delay);
    }
  }

  private setStatus(s: BridgeStatus): void {
    this.emit('status', s);
  }
}
