import React, { useEffect } from 'react';
import { Search, Filter } from 'lucide-react';
import { useMemory, MemoryType } from '../../store/memory';
import { MemoryCard } from './MemoryCard';

const TYPES: { key: MemoryType | 'all'; label: string; color: string }[] = [
  { key: 'all', label: 'All', color: '' },
  { key: 'user', label: 'User', color: 'text-blue-400' },
  { key: 'feedback', label: 'Feedback', color: 'text-amber-400' },
  { key: 'project', label: 'Project', color: 'text-green-400' },
  { key: 'reference', label: 'Reference', color: 'text-purple-400' },
];

export function MemoryBrowser(): React.ReactElement {
  const { index, filter, setFilter, loadMemories } = useMemory();
  const [query, setQuery] = React.useState('');

  useEffect(() => { void loadMemories(); }, []);

  const filtered = index.filter(entry => {
    const prefix = filter.split('_')[0] ?? '';
    if (filter !== 'all' && !entry.file.startsWith(prefix)) return false;
    if (query && !entry.title.toLowerCase().includes(query.toLowerCase())
        && !entry.summary.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border shrink-0">
        <Search size={11} className="text-muted" />
        <input
          className="flex-1 bg-transparent text-xs text-primary outline-none placeholder:text-muted"
          placeholder="Search memories..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="flex gap-0.5 text-[10px]">
          {TYPES.map(t => (
            <button
              key={t.key}
              className={`px-1.5 py-0.5 rounded ${filter === t.key ? 'bg-active' : 'text-muted hover:text-primary'}`}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto py-1">
        {filtered.map(entry => (
          <MemoryCard key={entry.file} entry={entry} />
        ))}
      </div>
    </div>
  );
}
