// src/main/ndjson.ts
export interface NdjsonError {
  line: string;
  cause: unknown;
}

export class NdjsonSplitter {
  private buf = '';

  constructor(
    private readonly onValue: (value: unknown) => void,
    private readonly onError?: (err: NdjsonError) => void,
  ) {}

  feed(chunk: Buffer | string): void {
    this.buf += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    let nl: number;
    while ((nl = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, nl).trimEnd();
      this.buf = this.buf.slice(nl + 1);
      if (line.length === 0) continue;
      try {
        this.onValue(JSON.parse(line));
      } catch (cause) {
        this.onError?.({ line, cause });
      }
    }
  }
}
