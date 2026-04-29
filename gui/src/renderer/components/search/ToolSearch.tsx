import React from 'react';
import { FileText, Search } from 'lucide-react';
import { useSearch } from '../../store/search';
import { useUi } from '../../store/ui';
import { cn } from '../../lib/cn';

const PROJECT_CWD = 'D:\\cleak2';

export function ToolSearch(): React.ReactElement {
  const { globResults } = useSearch();
  const setMainTab = useUi(s => s.setMainTab);

  if (globResults.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-xs">
        No glob results
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full')}>
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border shrink-0">
        <Search size={12} className="text-muted" />
        <span className="text-xs text-muted">{globResults.length} files from agent</span>
      </div>
      <div className="flex-1 overflow-auto py-1">
        {globResults.map(p => (
          <button
            key={p}
            className="flex items-center gap-1.5 w-full px-3 py-1 text-xs text-primary hover:bg-active transition-colors"
            onClick={() => setMainTab('editor')}
          >
            <FileText size={11} className="text-muted" />
            <span className="truncate">{p.replace(new RegExp('^' + PROJECT_CWD.replace(/\\/g, '\\\\') + '\\\\'), '')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
