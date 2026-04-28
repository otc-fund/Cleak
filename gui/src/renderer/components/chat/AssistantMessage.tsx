import React, { useMemo } from 'react';
import type { ChatMessage, ToolUseBlock, ToolResultBlock } from '../../store/chat';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallCard } from './ToolCallCard';
import { MarkdownBody } from './MarkdownBody';

interface Props {
  message: ChatMessage;
}

export function AssistantMessage({ message }: Props): React.ReactElement {
  const resultMap = useMemo(() => {
    const m = new Map<string, ToolResultBlock>();
    for (const b of message.blocks) {
      if (b.type === 'tool_result') m.set(b.tool_use_id, b);
    }
    return m;
  }, [message.blocks]);

  const thinkingRun = useMemo(() => {
    const runs = new Map<number, number>();
    let run = 0;
    for (let i = message.blocks.length - 1; i >= 0; i--) {
      const block = message.blocks[i];
      if (block && block.type === 'thinking') { run++; runs.set(i, run); }
      else run = 0;
    }
    return runs;
  }, [message.blocks]);

  const renderBlocks = message.blocks.filter((b) => b.type !== 'tool_result');

  return (
    <div className="group flex flex-col gap-0.5">
      {renderBlocks.map((block, i) => {
        if (block.type === 'thinking') {
          const run = thinkingRun.get(i) ?? 1;
          return <ThinkingBlock key={i} thinking={block.thinking} forceCollapse={run >= 3} />;
        }
        if (block.type === 'tool_use') {
          const result = resultMap.get(block.id);
          return <ToolCallCard key={i} toolUse={block as ToolUseBlock} result={result} />;
        }
        if (block.type === 'text') {
          return block.text ? <MarkdownBody key={i}>{block.text}</MarkdownBody> : null;
        }
        return null;
      })}
      {message.pending && (
        <span className="inline-block w-2 h-3.5 bg-accent/60 animate-pulse rounded-sm" />
      )}
    </div>
  );
}
