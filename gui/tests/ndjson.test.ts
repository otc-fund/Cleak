// tests/ndjson.test.ts
import { describe, expect, it } from 'vitest';
import { NdjsonSplitter } from '../src/main/ndjson';

describe('NdjsonSplitter', () => {
  it('emits one object per newline-terminated line', () => {
    const out: unknown[] = [];
    const s = new NdjsonSplitter((v) => out.push(v));
    s.feed(Buffer.from('{"a":1}\n{"b":2}\n'));
    expect(out).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('buffers partial lines across feeds', () => {
    const out: unknown[] = [];
    const s = new NdjsonSplitter((v) => out.push(v));
    s.feed(Buffer.from('{"a":'));
    s.feed(Buffer.from('1}\n'));
    expect(out).toEqual([{ a: 1 }]);
  });

  it('reports parse errors via onError without aborting the stream', () => {
    const out: unknown[] = [];
    const errs: string[] = [];
    const s = new NdjsonSplitter(
      (v) => out.push(v),
      (e) => errs.push(e.line),
    );
    s.feed(Buffer.from('not json\n{"ok":true}\n'));
    expect(out).toEqual([{ ok: true }]);
    expect(errs).toEqual(['not json']);
  });

  it('ignores empty lines', () => {
    const out: unknown[] = [];
    const s = new NdjsonSplitter((v) => out.push(v));
    s.feed(Buffer.from('\n{"a":1}\n\n'));
    expect(out).toEqual([{ a: 1 }]);
  });
});
