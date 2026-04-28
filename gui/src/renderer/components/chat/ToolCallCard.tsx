import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useUi } from '../../store/ui';
import type { ToolUseBlock, ToolResultBlock } from '../../store/chat';

interface Props {
  toolUse: ToolUseBlock;
  result?: ToolResultBlock;
  durationMs?: number;
  /** Compact inline style for embedding in thinking runs */
  compact?: boolean;
}

export function ToolCallCard({ toolUse, result, durationMs, compact }: Props): React.ReactElement {
  const [paramsOpen, setParamsOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const setSelectedToolCall = useUi((s) => s.setSelectedToolCall);

  const resultText = result
    ? typeof result.content === 'string'
      ? result.content
      : JSON.stringify(result.content, null, 2)
    : null;

  const TRUNCATE = 300;
  const resultTruncated = resultText != null && resultText.length > TRUNCATE;
  const [resultExpanded, setResultExpanded] = useState(false);

  const isError = result?.is_error;

  const toolName = toolUse.name.replace(/Tool$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

  if (compact) {
    return (
      <button
        className="my-0.5 flex items-center gap-1.5 text-[10px] cursor-pointer hover:text-primary transition-colors"
        onClick={() => setSelectedToolCall({
          toolName: toolUse.name,
          input: toolUse.input,
          result: result?.content,
          isError,
        })}
      >
        <Wrench size={9} className="text-accent/50 shrink-0" />
        <span className="text-muted/60">{toolName}</span>
        {result ? (
          isError
            ? <XCircle size={9} className="text-red-400" />
            : <CheckCircle size={9} className="text-green-400" />
        ) : (
          <span className="text-muted/40 animate-pulse">running…</span>
        )}
        {resultText && (
          <span className="text-muted/40 truncate max-w-[200px]">{resultText.slice(0, 100)}</span>
        )}
      </button>
    );
  }

  return (
    <div className={cn(
      'my-1 rounded border text-xs',
      isError ? 'border-red-900/50 bg-red-950/20' : 'border-border/50 bg-panel/20',
    )} style={{ color: '#a3a3a3' }}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-hover/30 transition-colors"
        onClick={() => setSelectedToolCall({
          toolName: toolUse.name,
          input: toolUse.input,
          result: result?.content,
          isError,
        })}
      >
        <Wrench size={11} className="text-accent/70 shrink-0" />
        <span className="font-mono font-medium text-primary/80">{toolUse.name}</span>
        {result ? (
          isError
            ? <XCircle size={11} className="text-red-400 ml-auto" />
            : <CheckCircle size={11} className="text-green-400 ml-auto" />
        ) : (
          <span className="ml-auto text-muted animate-pulse">running…</span>
        )}
        {durationMs != null && (
          <span className="text-muted">{durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}</span>
        )}
      </div>

      {/* Params */}
      <div className="border-t border-border/30">
        <button
          className="w-full flex items-center gap-1 px-2 py-1 text-muted hover:text-primary transition-colors"
          onClick={() => setParamsOpen((v) => !v)}
        >
          {paramsOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <span>params</span>
        </button>
        {paramsOpen && (
          <pre className="px-3 pb-2 text-muted overflow-x-auto text-[10px] leading-relaxed">
            {JSON.stringify(toolUse.input, null, 2)}
          </pre>
        )}
      </div>

      {/* Result */}
      {resultText != null && (
        <div className="border-t border-border/30">
          <button
            className="w-full flex items-center gap-1 px-2 py-1 text-muted hover:text-primary transition-colors"
            onClick={() => setResultOpen((v) => !v)}
          >
            {resultOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            <span className={isError ? 'text-red-400' : ''}>result</span>
          </button>
          {resultOpen && (
            <div className="px-3 pb-2">
              <pre className={cn(
                'text-[10px] leading-relaxed overflow-x-auto whitespace-pre-wrap',
                isError ? 'text-red-300' : 'text-muted',
              )}>
                {resultExpanded || !resultTruncated ? resultText : resultText.slice(0, TRUNCATE) + '…'}
              </pre>
              {resultTruncated && (
                <button
                  className="text-accent text-[10px] mt-1 hover:underline"
                  onClick={() => setResultExpanded((v) => !v)}
                >
                  {resultExpanded ? 'show less' : 'show more'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
