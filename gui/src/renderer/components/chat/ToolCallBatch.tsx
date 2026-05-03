import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useUi } from '../../store/ui';
import type { ToolUseBlock, ToolResultBlock } from '../../store/chat';

interface Props {
  tools: ToolUseBlock[];
  resultMap: Map<string, ToolResultBlock>;
}

export function ToolCallBatch({ tools, resultMap }: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  const setSelectedToolCall = useUi((s) => s.setSelectedToolCall);

  const completedCount = tools.filter(t => resultMap.has(t.id)).length;
  const errorCount = tools.filter(t => resultMap.get(t.id)?.is_error).length;
  const hasRunning = completedCount < tools.length;

  const toolLabels = tools.map(t =>
    t.name.replace(/Tool$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  );

  return (
    <div className={cn(
      'my-1 rounded border text-xs border-border/50 bg-panel/20',
    )}>
      {/* Collapsible header */}
      <button
        className="w-full flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-hover/30 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        {open ? <ChevronDown size={11} className="text-accent/70 shrink-0" /> : <ChevronRight size={11} className="text-accent/70 shrink-0" />}
        <Wrench size={11} className="text-accent/70 shrink-0" />
        <span className="flex-1 text-left text-muted text-[10px] uppercase tracking-wide">
          {tools.length} tool{tools.length > 1 ? 's' : ''}{': '}
          {toolLabels.slice(0, 3).join(', ')}
          {toolLabels.length > 3 && <span className="text-muted/60"> +{toolLabels.length - 3} more</span>}
        </span>
        <span className="text-[10px] text-muted/60">
          {completedCount}/{tools.length}
        </span>
        {errorCount > 0 && <XCircle size={11} className="text-red-400" />}
        {hasRunning && <span className="text-muted/40 animate-pulse text-[10px]">running…</span>}
      </button>

      {/* Expanded list */}
      {open && (
        <div className="border-t border-border/30 divide-y divide-border/20">
          {tools.map((tu, i) => {
            const result = resultMap.get(tu.id);
            const resultText = result
              ? typeof result.content === 'string'
                ? result.content
                : JSON.stringify(result.content, null, 2)
              : null;
            const isError = result?.is_error;
            const name = tu.name.replace(/Tool$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
            const [detailOpen, setDetailOpen] = useState(false);

            return (
              <div key={i} className={cn(
                'px-2 py-1.5 hover:bg-hover/20 transition-colors',
                isError && 'bg-red-950/10',
              )}>
                <button
                  className="w-full flex items-center gap-1.5 text-[10px]"
                  onClick={() => setSelectedToolCall({
                    toolName: tu.name,
                    input: tu.input,
                    result: result?.content,
                    isError,
                  })}
                >
                  <span className="text-muted/60 w-4 text-right">{i + 1}</span>
                  <span className="text-primary/80 font-mono">{name}</span>
                  {result ? (
                    isError
                      ? <XCircle size={9} className="text-red-400 ml-auto" />
                      : <CheckCircle size={9} className="text-green-400 ml-auto" />
                  ) : (
                    <span className="ml-auto text-muted/40 animate-pulse">running…</span>
                  )}
                  <button
                    className="ml-2 text-muted/50 hover:text-primary"
                    onClick={(e) => { e.stopPropagation(); setDetailOpen(v => !v); }}
                  >
                    {detailOpen ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                  </button>
                </button>
                {detailOpen && (
                  <div className="pl-6 pt-1 space-y-1">
                    <details className="text-[10px] text-muted">
                      <summary className="cursor-pointer hover:text-primary">params</summary>
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(tu.input, null, 2)}</pre>
                    </details>
                    {resultText != null && (
                      <details className={cn('text-[10px]', isError ? 'text-red-300' : 'text-muted')}>
                        <summary className="cursor-pointer hover:text-primary">result</summary>
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap">{resultText.slice(0, 500)}{resultText.length > 500 ? '\n…(truncated)' : ''}</pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
