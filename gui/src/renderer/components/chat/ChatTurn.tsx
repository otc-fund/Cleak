import React from 'react';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';
import type { ChatMessage } from '../../store/chat';

interface ChatTurnProps {
  turnId: string;
  userMessage: ChatMessage | null;
  assistantMessage: ChatMessage | null;
  isStreaming: boolean;
}

export const ChatTurn = React.memo(function ChatTurn({
  turnId,
  userMessage,
  assistantMessage,
  isStreaming,
}: ChatTurnProps) {
  return (
    <div id={`turn-${turnId}`} className="scroll-mt-4 group">
      {userMessage && <UserMessage message={userMessage} />}
      {assistantMessage && <AssistantMessage message={assistantMessage} />}
      {!assistantMessage && isStreaming && (
        <div className="flex items-center gap-2 py-2 text-muted text-xs">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          Thinking…
        </div>
      )}
    </div>
  );
});
