import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import ignore from 'ignore';

export interface TreeNode {
  name: string;
  path: string;   // absolute
  kind: 'file' | 'dir';
  children?: TreeNode[];
}

const ALWAYS_IGNORE = ['.git', 'node_modules', 'out', 'dist', '.vite'];

async function buildTree(dir: string, root: string, ig: ReturnType<typeof ignore>): Promise<TreeNode[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nodes: TreeNode[] = [];
  for (const e of entries) {
    if (ALWAYS_IGNORE.includes(e.name)) continue;
    const abs = join(dir, e.name);
    const rel = relative(root, abs);
    if (ig.ignores(rel)) continue;
    if (e.isDirectory()) {
      const children = await buildTree(abs, root, ig);
      nodes.push({ name: e.name, path: abs, kind: 'dir', children });
    } else {
      nodes.push({ name: e.name, path: abs, kind: 'file' });
    }
  }
  return nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function getFileTree(root: string): Promise<TreeNode[]> {
  const ig = ignore();
  const gitignorePath = join(root, '.gitignore');
  if (existsSync(gitignorePath)) {
    ig.add(readFileSync(gitignorePath, 'utf8'));
  }
  return buildTree(root, root, ig);
}
