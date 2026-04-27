import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { CleakBridge, type SpawnFn } from '../src/main/bridge';

class FakeChild extends EventEmitter {
  stdout = new Readable({ read() {} });
  stderr = new Readable({ read() {} });
  stdin: Writable;
  killed = false;
  constructor() {
    super();
    const self = this;
    this.stdin = new Writable({
      write(chunk, _enc, cb) {
        self.emit('stdin-write', chunk.toString('utf8'));
        cb();
      },
    });
  }
  kill() {
    this.killed = true;
    this.emit('exit', 0, null);
    return true;
  }
}

function makeSpawn(child: FakeChild): SpawnFn {
  return vi.fn(() => child as never);
}

describe('CleakBridge', () => {
  it('emits status running after a system init frame arrives', async () => {
    const child = new FakeChild();
    const events: unknown[] = [];
    const bridge = new CleakBridge({
      spawn: makeSpawn(child),
      cwd: '/tmp',
      env: {},
      claudeBin: 'C:/fake/claude.exe',
    });
    bridge.on('status', (s) => events.push(['status', s]));
    bridge.start();
    child.stdout.push(
      '{"type":"system","subtype":"init","session_id":"s-1","tools":[],"mcp_servers":[]}\n',
    );
    await new Promise((r) => setImmediate(r));
    expect(events).toEqual([
      ['status', { kind: 'starting' }],
      ['status', { kind: 'running', sessionId: 's-1', protocolOk: true }],
    ]);
  });

  it('forwards parsed frames as `frame` events', async () => {
    const child = new FakeChild();
    const frames: unknown[] = [];
    const bridge = new CleakBridge({
      spawn: makeSpawn(child),
      cwd: '/tmp',
      env: {},
      claudeBin: 'C:/fake/claude.exe',
    });
    bridge.on('frame', (f) => frames.push(f));
    bridge.start();
    child.stdout.push(
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"hi"}]},"session_id":"s-1"}\n',
    );
    await new Promise((r) => setImmediate(r));
    expect(frames).toHaveLength(1);
  });

  it('writes outbound user frames to the child stdin as NDJSON', async () => {
    const child = new FakeChild();
    const writes: string[] = [];
    child.on('stdin-write', (s: string) => writes.push(s));
    const bridge = new CleakBridge({
      spawn: makeSpawn(child),
      cwd: '/tmp',
      env: {},
      claudeBin: 'C:/fake/claude.exe',
    });
    bridge.start();
    bridge.sendUserMessage('hello');
    await new Promise((r) => setImmediate(r));
    expect(writes).toEqual([
      '{"type":"user","message":{"role":"user","content":"hello"}}\n',
    ]);
  });

  it('restarts on unexpected exit with backoff up to maxAttempts', async () => {
    let n = 0;
    const spawn: SpawnFn = vi.fn(() => {
      n++;
      const c = new FakeChild();
      setImmediate(() => c.emit('exit', 1, null));
      return c as never;
    });
    const events: unknown[] = [];
    const bridge = new CleakBridge({
      spawn,
      cwd: '/tmp',
      env: {},
      claudeBin: 'C:/fake/claude.exe',
      restart: { maxAttempts: 2, baseDelayMs: 0 },
    });
    bridge.on('status', (s) => events.push(s));
    bridge.start();
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
    expect(n).toBe(3); // initial + 2 restarts
    const stopped = events[events.length - 1] as { kind: string };
    expect(stopped.kind).toBe('stopped');
  });
});
