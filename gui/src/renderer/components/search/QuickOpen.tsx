import React, { useEffect, useRef, useState } from 'react';
import { Search, FileText } from 'lucide-react';
import { useSearch, type QuickOpenEntry } from '../../store/search';
import { useUi } from '../../store/ui';
import { useEditor } from '../../store/editor';
import { cn } from '../../lib/cn';

export function QuickOpen(): React.ReactElement | null {
  const { quickOpenOpen, quickOpenQuery, quickOpenMatches, setQuickOpen, setQuickOpenQuery } = useSearch();
  const setMainTab = useUi(s => s.setMainTab);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selectedIdxRef = useRef(0);
  selectedIdxRef.current = selectedIdx;

  function openEntry(entry: QuickOpenEntry) {
    void window.bridge.readFile(entry.path).then((content: string) => {
      useEditor.getState().openFile(entry.path, content);
    }).catch(() => {
      useEditor.getState().openFile(entry.path, '');
    });
    setMainTab('editor');
    setQuickOpen(false);
  }

  useEffect(() => {
    if (quickOpenOpen) {
      inputRef.current?.focus();
      setSelectedIdx(0);
    }
  }, [quickOpenOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p' && !e.shiftKey) {
        e.preventDefault();
        setQuickOpen(true);
        return;
      }
      if (e.key === 'Escape' && quickOpenOpen) {
        e.preventDefault();
        setQuickOpen(false);
        return;
      }
      const matches = useSearch.getState().quickOpenMatches;
      if (!quickOpenOpen || matches.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx(i => Math.min(i + 1, matches.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const entry = matches[selectedIdxRef.current];
        if (entry) openEntry(entry);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quickOpenOpen, quickOpenMatches.length]);

  if (!quickOpenOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setQuickOpen(false)}>
      <div
        className="w-[520px] max-h-[40vh] bg-surface border border-border rounded-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Search size={14} className="text-muted" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-muted"
            placeholder="Type to search files..."
            value={quickOpenQuery}
            onChange={e => setQuickOpenQuery(e.target.value)}
          />
        </div>
        <div className="overflow-auto max-h-[32vh]">
          {quickOpenMatches.map((entry, i) => (
            <button
              key={entry.path}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-active transition-colors',
                i === selectedIdx && 'bg-active',
              )}
              onClick={() => openEntry(entry)}
            >
              <FileText size={11} className="text-muted shrink-0" />
              <span className="truncate text-primary">{entry.label}</span>
              <span className="text-muted ml-auto truncate max-w-[200px] text-[10px]">{entry.path}</span>
            </button>
          ))}
          {quickOpenMatches.length === 0 && (
            <div className="px-3 py-4 text-xs text-muted text-center">No files match</div>
          )}
        </div>
      </div>
    </div>
  );
}
