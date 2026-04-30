import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { useChat } from '../store/chat';
import { AssistantMessage } from './chat/AssistantMessage';
import { UserMessage } from './chat/UserMessage';

export function ChatView(): React.ReactElement {
  const messages = useChat((s) => s.messages);
  const activeSessionId = useChat((s) => s.activeSessionId);
  const errors = useChat((s) => s.errors);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Only render messages for the active session (or untagged messages
  // that are waiting for the bridge to assign a session_id)
  const visibleMessages = activeSessionId
    ? messages.filter(m => !m.sessionId || m.sessionId === activeSessionId)
    : messages;

  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const isNearBottom = useCallback((): boolean => {
    const el = containerRef.current;
    if (!el) return true;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 0) return true; // no scrollable content
    return scrollable - el.scrollTop < 120;
  }, []);

  const handleScroll = useCallback(() => {
    setShowScrollButton(!isNearBottom());
  }, [isNearBottom]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    if (isNearBottom()) {
      scrollToBottom();
    }
  }, [visibleMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative flex-1 min-w-0" style={{ width: '100%' }}>
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 min-w-0 overflow-auto px-4 py-4 space-y-4" style={{ width: '100%' }}>
        {visibleMessages.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted text-sm">
            Start a conversation…
          </div>
        )}
        {visibleMessages.map((m) =>
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

      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 p-2 rounded-full bg-panel border border-border shadow-lg text-muted hover:text-primary hover:bg-active transition-colors"
          title="Scroll to bottom"
        >
          <ArrowDown size={18} />
        </button>
      )}
    </div>
  );
}
