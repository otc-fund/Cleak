import React, { useEffect, useRef } from 'react';
import { useChat } from '../store/chat';
import { AssistantMessage } from './chat/AssistantMessage';
import { UserMessage } from './chat/UserMessage';

export function ChatView(): React.ReactElement {
  const messages = useChat((s) => s.messages);
  const errors = useChat((s) => s.errors);
  const bottomRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isNearBottom = (): boolean => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useEffect(() => {
    if (isNearBottom()) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  return (
    <div ref={containerRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-muted text-sm">
          Start a conversation…
        </div>
      )}
      {messages.map((m) =>
        m.role === 'user'
          ? <UserMessage key={m.id} message={m} />
          : <AssistantMessage key={m.id} message={m} />,
      )}
      {errors.length > 0 && (
        <div className="text-xs text-red-400/80 border border-red-900/30 rounded px-3 py-2 bg-red-950/20">
          {errors[errors.length - 1]}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
