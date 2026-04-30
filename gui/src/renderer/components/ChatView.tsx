import React from 'react';
import { useChat } from '../store/chat';
import { AssistantMessage } from './chat/AssistantMessage';
import { UserMessage } from './chat/UserMessage';

export function ChatView(): React.ReactElement {
  const messages = useChat((s) => s.messages);
  const activeSessionId = useChat((s) => s.activeSessionId);
  const errors = useChat((s) => s.errors);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Only render messages for the active session (or untagged messages
  // that are waiting for the bridge to assign a session_id)
  const visibleMessages = activeSessionId
    ? messages.filter(m => !m.sessionId || m.sessionId === activeSessionId)
    : messages;

  return (
    <div className="flex flex-col min-h-0 overflow-hidden" style={{ width: '100%' }}>
      <div ref={containerRef} className="flex-1 min-h-0 overflow-auto px-4 py-4 space-y-4" style={{ width: '100%' }}>
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
      </div>
    </div>
  );
}
