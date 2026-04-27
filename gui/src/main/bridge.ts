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
}

export class CleakBridge extends EventEmitter {
  private child: ChildProcess | null = null;
  private splitter: NdjsonSplitter;
  private stoppedByUs = false;
  private attempt = 0;

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
    // stream-json input-format requires the process to stay running and read from stdin.
    // --bare is omitted: it suppresses NDJSON frames in stream-json mode on Windows.
    const args = [
      '--verbose',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
    ];
    if (this.opts.bypassPermissions !== false) {
      args.push('--permission-mode', 'bypassPermissions');
    }
    console.log('[bridge] spawning:', this.opts.claudeBin, args.join(' '));
    console.log('[bridge] cwd:', this.opts.cwd);
    const child = this.opts.spawn(this.opts.claudeBin, args, {
      cwd: this.opts.cwd,
      env: this.opts.env,
      stdio: 'pipe',
    });
    this.child = child;
    console.log('[bridge] child pid:', child.pid);

    // 5-second alive check — if process is silent, try stdin nudge
    setTimeout(() => {
      if (this.child === child && child.exitCode === null && !child.killed) {
        console.warn('[bridge] 5s timeout — process alive but silent; sending stdin nudge');
        child.stdin?.write('\n');
      }
    }, 5000);

    // Initial stdin nudge — some stream-json implementations need a first write
    setTimeout(() => {
      if (child.stdin && !child.killed) {
        child.stdin.write('\n');
      }
    }, 500);

    child.on('error', (err) => {
      console.error('[bridge] spawn error:', err.message);
      this.emit('error', { message: `spawn error: ${err.message}` });
      this.handleExit(-1);
    });
    child.stdout?.on('data', (b: Buffer) => {
      const text = b.toString('utf8');
      console.log('[bridge] stdout:', text.slice(0, 200));
      this.splitter.feed(b);
    });
    child.stderr?.on('data', (b: Buffer) => {
      const msg = b.toString('utf8');
      console.error('[bridge] stderr:', msg);
      this.emit('error', { message: `stderr: ${msg}` });
    });
    child.on('exit', (code, signal) => {
      console.log('[bridge] exit code:', code, 'signal:', signal);
      this.handleExit(code ?? -1);
    });
  }

  private handleFrame(value: unknown): void {
    const parsed = CleakInboundFrame.safeParse(value);
    if (!parsed.success) {
      this.emit('error', { message: `unrecognized frame: ${parsed.error.message}` });
      this.setStatus({ kind: 'running', sessionId: undefined, protocolOk: false });
      return;
    }
    const frame = parsed.data;
    this.emit('frame', frame);
    if (frame.type === 'system' && frame.subtype === 'init') {
      this.attempt = 0;
      this.setStatus({ kind: 'running', sessionId: frame.session_id, protocolOk: true });
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
