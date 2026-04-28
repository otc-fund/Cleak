import React from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import { useFiles, type TreeNode } from '../../store/files';
import { useEditor } from '../../store/editor';
import { cn } from '../../lib/cn';

interface Props {
  node: TreeNode;
  depth: number;
  filter: string;
}

export function FileTreeNode({ node, depth, filter }: Props): React.ReactElement | null {
  const { expanded, toggleExpand } = useFiles();
  const { openFile, activeTab } = useEditor();
  const isOpen = expanded.has(node.path);
  const isActive = activeTab === node.path;

  // Filter: show file if name matches; show dir if any descendant matches
  if (filter) {
    const matches = (n: TreeNode): boolean => {
      if (n.name.toLowerCase().includes(filter.toLowerCase())) return true;
      return (n.children ?? []).some(matches);
    };
    if (!matches(node)) return null;
  }

  const handleClick = async (): Promise<void> => {
    if (node.kind === 'dir') { toggleExpand(node.path); return; }
    const content = await window.bridge.readFile(node.path) as string;
    openFile(node.path, content);
  };

  return (
    <>
      <button
        className={cn(
          'w-full flex items-center gap-1.5 px-2 py-0.5 text-xs text-left truncate hover:bg-active transition-colors',
          isActive && 'bg-active text-primary',
          !isActive && 'text-secondary',
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onClick={() => void handleClick()}
      >
        {node.kind === 'dir'
          ? isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />
          : <span className="w-[11px]" />}
        {node.kind === 'dir'
          ? isOpen ? <FolderOpen size={12} className="text-accent/70" /> : <Folder size={12} className="text-accent/70" />
          : <File size={12} className="text-muted" />}
        <span className="truncate">{node.name}</span>
      </button>
      {node.kind === 'dir' && isOpen && node.children?.map(child => (
        <FileTreeNode key={child.path} node={child} depth={depth + 1} filter={filter} />
      ))}
    </>
  );
}
