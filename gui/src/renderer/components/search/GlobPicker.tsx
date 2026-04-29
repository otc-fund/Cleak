import React from 'react';
import { Search, FileText } from 'lucide-react';
import { useSearch } from '../../store/search';

const PROJECT_CWD = 'D:\\cleak2';

export function GlobPicker(): React.ReactElement {
  const { globResults, runGlob } = useSearch();
  const [pattern, setPattern] = React.useState('**/*.ts');

  function handleRun() { void runGlob(pattern, PROJECT_CWD); }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 p-2 border-b border-border shrink-0">
        <input
          className="flex-1 bg-surface text-xs text-primary outline-none px-2 py-1 rounded border border-border"
          value={pattern}
          onChange={e => setPattern(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleRun()}
        />
        <button
          className="p-1.5 rounded border border-border text-muted hover:text-primary"
          onClick={handleRun}
        >
          <Search size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-auto py-1">
        {globResults.map(p => (
          <div key={p} className="flex items-center gap-1.5 px-3 py-1 text-xs text-primary hover:bg-active">
            <FileText size={11} className="text-muted" />
            <span className="truncate">{p.replace(PROJECT_CWD + '\\', '')}</span>
          </div>
        ))}
        {globResults.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted text-center">No files match</div>
        )}
      </div>
    </div>
  );
}
