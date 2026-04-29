import React from 'react';
import { Search, Regex, Filter, Loader2 } from 'lucide-react';
import { useSearch } from '../../store/search';
import { GrepResults } from './GrepResults';

const PROJECT_CWD = 'D:\\cleak2';

export function GrepPanel(): React.ReactElement {
  const {
    grepQuery, grepGlob, grepRegex, grepRunning,
    setGrepQuery, setGrepGlob, toggleGrepRegex, runGrep,
  } = useSearch();

  function handleRun() { void runGrep(PROJECT_CWD); }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleRun();
  }

  return (
    <div className="flex flex-col h-full bg-[#0b0b0b]">
      <div className="flex items-center gap-1.5 p-2 border-b border-border shrink-0">
        <div className="flex-1 flex items-center gap-1 bg-surface rounded border border-border px-2 py-1">
          <Search size={12} className="text-muted shrink-0" />
          <input
            className="flex-1 bg-transparent text-xs text-primary outline-none placeholder:text-muted"
            placeholder="Search..."
            value={grepQuery}
            onChange={e => setGrepQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="flex items-center bg-surface rounded border border-border px-2 py-1 w-28">
          <Filter size={11} className="text-muted shrink-0 mr-1" />
          <input
            className="flex-1 bg-transparent text-xs text-primary outline-none w-16 placeholder:text-muted"
            placeholder="*.ts"
            value={grepGlob}
            onChange={e => setGrepGlob(e.target.value)}
          />
        </div>
        <button
          className={`p-1.5 rounded border transition-colors ${
            grepRegex ? 'bg-accent/20 border-accent text-accent' : 'border-border text-muted hover:text-primary'
          }`}
          onClick={toggleGrepRegex}
          title="Regex"
        >
          <Regex size={12} />
        </button>
        <button
          className="p-1.5 rounded border border-border text-muted hover:text-primary transition-colors disabled:opacity-40"
          onClick={handleRun}
          disabled={!grepQuery || grepRunning}
        >
          {grepRunning ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <GrepResults />
      </div>
    </div>
  );
}
