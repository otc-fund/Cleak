import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { runGrep, runGlob } from '../../src/main/grepEngine';

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grep-test-'));

  // Create test files
  fs.writeFileSync(path.join(tmpDir, 'hello.ts'), 'export function greet() {\n  return "hello world";\n}\n');
  fs.writeFileSync(path.join(tmpDir, 'main.ts'), 'import { greet } from "./hello";\nconsole.log(greet());\n');
  fs.writeFileSync(path.join(tmpDir, 'notes.txt'), 'This is a note.\nAnother line with hello in it.\n');

  // Create a subdirectory
  const sub = path.join(tmpDir, 'lib');
  fs.mkdirSync(sub);
  fs.writeFileSync(path.join(sub, 'util.ts'), 'export const VERSION = "1.0.0";\n');
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runGrep', () => {
  it('finds literal matches in files', async () => {
    const results = await runGrep('hello', { cwd: tmpDir, glob: '*.ts' });
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.some(r => r.matchText.includes('hello world'))).toBe(true);
    expect(results.some(r => r.matchText.includes('"./hello"'))).toBe(true);
  });

  it('returns file, line, column, matchText', async () => {
    const results = await runGrep('VERSION', { cwd: tmpDir, glob: '**/*.ts' });
    const version = results.find(r => r.matchText.includes('VERSION'));
    expect(version).toBeDefined();
    expect(version!.file.endsWith('util.ts')).toBe(true);
    expect(version!.line).toBe(1);
    expect(version!.column).toBeGreaterThanOrEqual(1);
  });

  it('regex mode works', async () => {
    const results = await runGrep('\\bhello\\b', { cwd: tmpDir, glob: '*.ts', regex: true });
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('maxResults caps output', async () => {
    // Write a file with many matching lines
    const manyLines = Array(100).fill('hello world').join('\n');
    fs.writeFileSync(path.join(tmpDir, 'many.txt'), manyLines);

    const results = await runGrep('hello', { cwd: tmpDir, glob: 'many.txt', maxResults: 5 });
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('returns empty array when no matches', async () => {
    const results = await runGrep('zzznotfound', { cwd: tmpDir, glob: '*.ts' });
    expect(results).toEqual([]);
  });
});

describe('runGlob', () => {
  it('returns matching file paths', async () => {
    const results = await runGlob('*.ts', tmpDir);
    const names = results.map(f => path.basename(f));
    expect(names).toContain('hello.ts');
    expect(names).toContain('main.ts');
  });

  it('supports recursive patterns', async () => {
    const results = await runGlob('**/*.ts', tmpDir);
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.some(f => f.includes('util.ts'))).toBe(true);
  });

  it('excludes node_modules and .git', async () => {
    // Create a fake node_modules dir with a ts file
    const nm = path.join(tmpDir, 'node_modules');
    fs.mkdirSync(nm);
    fs.writeFileSync(path.join(nm, 'fake.ts'), '// should be ignored');

    const results = await runGlob('**/*.ts', tmpDir);
    expect(results.some(f => f.includes('node_modules'))).toBe(false);

    fs.rmSync(nm, { recursive: true, force: true });
  });
});
