import React, { useEffect, useRef } from 'react';
import { useChat } from '../store/chat';

export function ChatView(): React.ReactElement {
  const messages = useChat((s) => s.messages);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [messages]);
  return (
    <div ref={ref} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
      {messages.map((m) => (
        <div
          key={m.id}
          className={
            m.role === 'user'
              ? 'whitespace-pre-wrap text-blue-300'
              : 'whitespace-pre-wrap text-zinc-100'
          }
        >
          <span className="text-xs uppercase tracking-wider text-zinc-500 mr-2">
            {m.role}
          </span>
          {m.text}
          {m.pending && <span className="animate-pulse">▍</span>}
        </div>
      ))}
    </div>
  );
}
