import React from 'react';
import { Pencil, Trash2, BookOpen } from 'lucide-react';
import { useMemory, MemoryIndexEntry } from '../../store/memory';

interface Props {
  entry: MemoryIndexEntry;
}

const TYPE_COLORS: Record<string, string> = {
  user: 'border-l-blue-500',
  feedback: 'border-l-amber-500',
  project: 'border-l-green-500',
  reference: 'border-l-purple-500',
};

export function MemoryCard({ entry }: Props): React.ReactElement {
  const { selectMemory, deleteMemory } = useMemory();
  const [expanded, setExpanded] = React.useState(false);

  const typeKey = entry.file.split('_')[0] ?? '';
  return (
    <div className={`border-l-2 ${TYPE_COLORS[typeKey] ?? 'border-border'} px-3 py-1.5 text-xs hover:bg-active`}>
      <div className="flex items-center gap-2">
        <BookOpen size={10} className="text-muted shrink-0" />
        <span
          className="flex-1 text-primary cursor-pointer truncate"
          onClick={() => { setExpanded(v => !v); void selectMemory(entry.file); }}
        >
          {entry.title}
        </span>
        <button className="text-muted hover:text-primary p-0.5" title="Edit">
          <Pencil size={10} />
        </button>
        <button className="text-muted hover:text-red-400 p-0.5" onClick={() => deleteMemory(entry.file)}>
          <Trash2 size={10} />
        </button>
      </div>
      <div className="text-muted text-[10px] mt-0.5 truncate">{entry.summary}</div>
    </div>
  );
}
