import React from 'react';
import type { ChatMessage } from '../../store/chat';

interface Props {
  message: ChatMessage;
}

export function UserMessage({ message }: Props): React.ReactElement {
  const text = message.blocks.find((b) => b.type === 'text')?.text ?? '';
  const time = new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex justify-end gap-2 group">
      <div className="max-w-[80%]">
        <div className="rounded-lg px-3 py-2 bg-accent/15 border border-accent/20 text-sm text-primary whitespace-pre-wrap">
          {text}
        </div>
        <div className="text-right text-[10px] text-muted mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {time}
        </div>
      </div>
    </div>
  );
}
