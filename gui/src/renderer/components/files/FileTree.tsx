import React from 'react';
import { useFiles, type TreeNode } from '../../store/files';
import { FileTreeNode } from './FileTreeNode';

interface Props { nodes: TreeNode[]; depth: number; }

export function FileTree({ nodes, depth }: Props): React.ReactElement {
  const { filter } = useFiles();
  return (
    <>
      {nodes.map(n => <FileTreeNode key={n.path} node={n} depth={depth} filter={filter} />)}
    </>
  );
}
