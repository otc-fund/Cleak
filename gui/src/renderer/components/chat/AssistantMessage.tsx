import React, { useMemo } from 'react';
import type { ChatMessage, ToolUseBlock, ToolResultBlock, TextBlock, ThinkingBlock as ThinkingBlockType } from '../../store/chat';
import { ThinkingRun } from './ThinkingRun';
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

  // Build render groups directly (no memo to avoid stale references during streaming)
  const renderGroups: Array<
    { type: 'thinking'; blocks: (ThinkingBlockType | ToolUseBlock)[] }
    | { type: 'text'; block: TextBlock }
    | { type: 'tool'; blocks: ToolUseBlock[] }
  > = [];
  for (const b of message.blocks) {
    if (b.type === 'tool_result') continue;
    if (b.type === 'thinking') {
      const last = renderGroups[renderGroups.length - 1];
      if (last && last.type === 'thinking') {
        last.blocks.push(b);
      } else {
        renderGroups.push({ type: 'thinking', blocks: [b] });
      }
    } else if (b.type === 'tool_use') {
      const last = renderGroups[renderGroups.length - 1];
      if (last && last.type === 'thinking') {
        // Attach tool_use to preceding thinking run
        last.blocks.push(b);
      } else if (last && last.type === 'tool') {
        // Merge consecutive standalone tool blocks
        last.blocks.push(b);
      } else {
        renderGroups.push({ type: 'tool', blocks: [b] });
      }
    } else if (b.type === 'text') {
      renderGroups.push({ type: 'text', block: b as TextBlock });
    }
  }

  return (
    <div className="group min-w-0" style={{ width: '100%', maxWidth: '100%' }}>
      {renderGroups.map((g, i) => {
        if (g.type === 'thinking') {
          return <ThinkingRun key={`g-${i}`} blocks={g.blocks} resultMap={resultMap} />;
        }
        if (g.type === 'tool') {
          // Multiple consecutive tools → compact inline list; single tool → full card
          return g.blocks.map((tu, j) => (
            <ToolCallCard key={`g-${i}-${j}`} toolUse={tu} result={resultMap.get(tu.id)} compact />
          ));
        }
        const txt = g.block.text;
        return txt ? <MarkdownBody key={`g-${i}`}>{txt}</MarkdownBody> : null;
      })}
      {message.pending && (
        <span className="inline-block w-2 h-3.5 bg-accent/60 animate-pulse rounded-sm" />
      )}
    </div>
  );
}
