import React from 'react';
import { FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { useSearch, type GrepMatch } from '../../store/search';
import { useUi } from '../../store/ui';
import { useEditor } from '../../store/editor';

export function GrepResults(): React.ReactElement {
  const { grepResults } = useSearch();

  if (!grepResults.length) {
    return <div className="px-3 py-6 text-xs text-muted text-center">No results</div>;
  }

  return (
    <div className="py-1">
      {grepResults.map(group => (
        <FileGroup key={group.file} group={group} />
      ))}
    </div>
  );
}

function FileGroup({ group }: { group: { file: string; matches: GrepMatch[] } }): React.ReactElement {
  const [expanded, setExpanded] = React.useState(true);

  const basename = group.file.replace(/^.*[/\\]/, '');

  return (
    <div>
      <button
        className="flex items-center gap-1.5 w-full px-3 py-1 text-xs text-primary hover:bg-active transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <FileText size={11} className="text-muted" />
        <span className="truncate">{basename}</span>
        <span className="text-muted ml-auto">{group.matches.length}</span>
      </button>
      {expanded && group.matches.map(m => (
        <MatchRow key={`${m.line}-${m.column}`} match={m} />
      ))}
    </div>
  );
}

function MatchRow({ match }: { match: GrepMatch }): React.ReactElement {
  const setMainTab = useUi(s => s.setMainTab);

  async function handleClick() {
    try {
      const startLine = Math.max(1, match.line - 5);
      const endLine = match.line + 5;
      const lines = await window.bridge.searchReadLines(match.file, startLine, endLine) as string[];
      useEditor.getState().openFile(match.file, lines.join('\n'));
    } catch {
      useEditor.getState().openFile(match.file, match.matchText);
    }
    setMainTab('editor');
    useEditor.getState().addHighlight(match.file, match.line, match.line, 'read');
  }

  return (
    <button
      className="w-full text-left px-6 py-0.5 text-xs hover:bg-active transition-colors cursor-pointer"
      onClick={handleClick}
    >
      <span className="text-muted select-none mr-2">{match.line}</span>
      <span className="text-primary">{match.matchText}</span>
    </button>
  );
}
