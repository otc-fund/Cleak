import fg from 'fast-glob';
import * as fs from 'fs';
import * as path from 'path';

export interface GrepMatch {
  file: string;       // absolute path
  line: number;       // 1-based
  column: number;     // 1-based
  matchText: string;  // full line content
}

export interface GrepOptions {
  cwd: string;
  glob?: string;      // e.g. "*.ts"
  regex?: boolean;
  maxResults?: number; // cap at ~500 to avoid renderer overload
}

const DEFAULT_IGNORE = ['**/node_modules/**', '**/.git/**', '**/dist/**'];

export async function runGrep(pattern: string, opts: GrepOptions): Promise<GrepMatch[]> {
  const { cwd, glob: globPat, regex = false, maxResults = 500 } = opts;

  const files = await fg(globPat ?? '**/*', {
    cwd,
    ignore: DEFAULT_IGNORE,
    onlyFiles: true,
    absolute: true,
  });

  const results: GrepMatch[] = [];
  let re: RegExp | null = null;
  if (regex) {
    try { re = new RegExp(pattern); }
    catch (e: unknown) { throw new Error(`Invalid regex: ${e instanceof Error ? e.message : String(e)}`); }
  }

  for (const file of files) {
    if (results.length >= maxResults) break;
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch { continue; }

    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (results.length >= maxResults) break;
      const line = lines[i] ?? '';
      const idx = re ? line.search(re) : line.indexOf(pattern);
      if (idx !== -1) {
        results.push({
          file,
          line: i + 1,
          column: idx + 1,
          matchText: line,
        });
      }
    }
  }

  return results;
}

export async function runGlob(pattern: string, cwd: string): Promise<string[]> {
  return fg(pattern, {
    cwd,
    ignore: DEFAULT_IGNORE,
    onlyFiles: true,
    absolute: true,
  });
}
