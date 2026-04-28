import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface Props {
  path: string;
  isDirty: boolean;
  isActive: boolean;
  onSelect(): void;
  onClose(): void;
}

export function EditorTab({ path, isDirty, isActive, onSelect, onClose }: Props): React.ReactElement {
  const name = path.split(/[\\/]/).pop() ?? path;
  return (
    <div
      className={cn(
        'flex items-center gap-1 px-3 py-1.5 text-xs border-r border-border cursor-pointer select-none shrink-0',
        isActive ? 'bg-surface text-primary border-b border-b-surface' : 'text-muted hover:text-primary',
      )}
      onClick={onSelect}
    >
      {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" title="Unsaved changes" />}
      <span className="max-w-[120px] truncate">{name}</span>
      <button
        className="ml-1 rounded hover:bg-active p-0.5"
        onClick={e => { e.stopPropagation(); onClose(); }}
        title="Close"
      >
        <X size={10} />
      </button>
    </div>
  );
}
