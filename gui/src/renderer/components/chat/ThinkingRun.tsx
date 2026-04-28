import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';
import type { ThinkingBlock as ThinkingBlockType, ToolUseBlock } from '../../store/chat';
import { ToolCallCard } from './ToolCallCard';
import type { ToolResultBlock } from '../../store/chat';

interface Props {
  blocks: (ThinkingBlockType | ToolUseBlock)[];
  resultMap: Map<string, ToolResultBlock>;
}

export function ThinkingRun({ blocks, resultMap }: Props): React.ReactElement {
  const thinkingText = blocks
    .filter((b): b is ThinkingBlockType => b.type === 'thinking')
    .map(b => b.thinking)
    .join('\n\n');

  const toolBlocks = blocks.filter((b): b is ToolUseBlock => b.type === 'tool_use');
  const toolLabels = toolBlocks.map(b => b.name.replace(/Tool$/, '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase());

  const defaultOpen = thinkingText.length <= 200 && toolBlocks.length === 0;
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="my-0.5 text-xs min-w-0 w-full overflow-x-hidden" style={{ color: '#a3a3a3' }}>
      <button
        className="w-full flex items-center gap-1.5 py-1 text-muted hover:text-primary transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <Brain size={11} className="text-accent/50 shrink-0" />
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span className="text-[10px] uppercase tracking-wide">
          thinking
          {toolLabels.length > 0 && <span className="ml-1 text-muted/60">· {toolLabels.join(', ')}</span>}
        </span>
      </button>
      {open && (
        <div className="pl-4 py-1 space-y-1">
          {thinkingText && (
            <div style={{ color: '#a3a3a3', fontSize: '11px', fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace', lineHeight: '1.45', minHeight: '16px' }}>
              {thinkingText}
            </div>
          )}
          {toolBlocks.map((tu, i) => (
            <ToolCallCard key={i} toolUse={tu} result={resultMap.get(tu.id)} compact />
          ))}
        </div>
      )}
    </div>
  );
}
