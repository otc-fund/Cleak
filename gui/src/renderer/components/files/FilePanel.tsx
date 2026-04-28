import React, { useEffect } from 'react';
import { useFiles } from '../../store/files';
import { useEditor } from '../../store/editor';
import { FileTree } from './FileTree';

const PROJECT_ROOT = 'D:\\cleak2'; // TODO: expose from bridge as cwd

export function FilePanel(): React.ReactElement {
  const { loadTree, tree, filter, setFilter, loading } = useFiles();

  useEffect(() => { void loadTree(PROJECT_ROOT); }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-2">
        <input
          className="w-full text-xs px-2 py-1 rounded bg-base border border-border
                     text-primary placeholder-subtle focus:outline-none focus:border-accent"
          placeholder="Filter files…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>
      {loading && <div className="px-3 text-xs text-muted">Loading…</div>}
      <div className="flex-1 overflow-y-auto">
        <FileTree nodes={tree} depth={0} />
      </div>
    </div>
  );
}
