import React from 'react';
import { useChat } from '../store/chat';
import { useUi } from '../store/ui';
import { ListTree } from 'lucide-react';
import { ChatTurn } from './chat/ChatTurn';
import { ScrollToBottomButton } from './chat/ScrollToBottomButton';
import { ChaptersPanel } from './chat/ChaptersPanel';
import type { ChatMessage } from '../store/chat';
import type { Chapter } from './chat/ChaptersPanel';

const SCROLL_THRESHOLD = 200; // px from bottom to consider "near bottom"

interface Turn {
  id: string;
  userMessage: ChatMessage | null;
  assistantMessage: ChatMessage | null;
  isStreaming: boolean;
}

export function ChatView(): React.ReactElement {
  const messages = useChat((s) => s.messages);
  const activeSessionId = useChat((s) => s.activeSessionId);
  const errors = useChat((s) => s.errors);
  const chaptersPanelOpen = useUi((s) => s.chaptersPanelOpen);
  const activeChapter = useUi((s) => s.activeChapter);
  const setActiveChapter = useUi((s) => s.setActiveChapter);
  const setChaptersPanelOpen = useUi((s) => s.setChaptersPanelOpen);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = React.useState(true);
  const [newMessagesBelow, setNewMessagesBelow] = React.useState(0);
  const prevMessageCount = React.useRef(0);

  // Only render messages for the active session
  const visibleMessages: ChatMessage[] = activeSessionId
    ? messages.filter(m => !m.sessionId || m.sessionId === activeSessionId)
    : messages;

  // Group messages into turns (user + assistant pair)
  const turns = React.useMemo<Turn[]>(() => {
    const result: Turn[] = [];
    for (let i = 0; i < visibleMessages.length; i++) {
      const msg = visibleMessages[i]!;
      if (msg.role === 'user') {
        const next = visibleMessages[i + 1];
        const assistant = next?.role === 'assistant' ? next : null;
        result.push({
          id: msg.id,
          userMessage: msg,
          assistantMessage: assistant,
          isStreaming: assistant?.pending ?? false,
        });
        if (assistant) i++;
      } else if (msg.role === 'assistant') {
        // Orphaned assistant message
        result.push({
          id: `orphan-${msg.id}`,
          userMessage: null,
          assistantMessage: msg,
          isStreaming: msg.pending,
        });
      }
    }
    return result;
  }, [visibleMessages]);

  // Extract chapter data from turns
  const chapters = React.useMemo<Chapter[]>(() => {
    return turns.map(turn => {
      const userText = turn.userMessage?.blocks.find(b => b.type === 'text')?.text ?? '';
      const title = userText.length > 60 ? userText.slice(0, 57) + '…' : (userText || '(empty)');

      const subChapters: Chapter['subChapters'] = [];
      if (turn.assistantMessage) {
        for (const block of turn.assistantMessage.blocks) {
          if (block.type === 'text') {
            const lines = block.text.split('\n');
            for (const line of lines) {
              const match = line.match(/^(#{1,6})\s+(.+)$/);
              if (match) {
                subChapters.push({
                  id: `heading-${turn.id}-${subChapters.length}`,
                  title: match[2]!.trim(),
                  level: match[1]!.length,
                });
              }
            }
          }
        }
      }

      return { id: turn.id, title: title.replace(/\n/g, ' ').trim(), subChapters };
    });
  }, [turns]);

  // Scroll handler: detect if near bottom
  const handleScroll = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
    setIsNearBottom(near);
    if (near) {
      setNewMessagesBelow(0);
    }
  }, []);

  // Auto-scroll when new messages arrive and we're near bottom
  React.useEffect(() => {
    const count = visibleMessages.length;
    const hasNew = count > prevMessageCount.current;
    if (hasNew && isNearBottom) {
      requestAnimationFrame(() => {
        const el = containerRef.current;
        if (el) {
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }
      });
    }
    prevMessageCount.current = count;
  }, [visibleMessages.length, isNearBottom]);

  // IntersectionObserver for active chapter detection
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let topMost: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!topMost || entry.boundingClientRect.top < topMost.boundingClientRect.top) {
              topMost = entry;
            }
          }
        }
        if (topMost) {
          const turnId = topMost.target.id.replace('turn-', '');
          setActiveChapter(turnId);
        }
      },
      {
        root: container,
        rootMargin: '-10% 0px -60% 0px',
        threshold: 0,
      }
    );

    return () => observer.disconnect();
  }, [setActiveChapter]);

  // Observe turn elements
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let topMost: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!topMost || entry.boundingClientRect.top < topMost.boundingClientRect.top) {
              topMost = entry;
            }
          }
        }
        if (topMost) {
          const turnId = topMost.target.id.replace('turn-', '');
          setActiveChapter(turnId);
        }
      },
      {
        root: container,
        rootMargin: '-10% 0px -60% 0px',
        threshold: 0,
      }
    );

    // Observe current turn elements
    for (const turn of turns) {
      const el = document.getElementById(`turn-${turn.id}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [turns, setActiveChapter]);

  const scrollToBottom = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setNewMessagesBelow(0);
  }, []);

  const navigateToChapter = React.useCallback((id: string, subId?: string) => {
    const targetId = subId || `turn-${id}`;
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Track new messages below when messages change and we're not at bottom
  React.useEffect(() => {
    const count = visibleMessages.length;
    if (count > prevMessageCount.current && !isNearBottom) {
      setNewMessagesBelow(prev => prev + (count - prevMessageCount.current));
    }
  }, [visibleMessages.length, isNearBottom]);

  return (
    <div className="flex flex-col min-h-0 overflow-hidden" style={{ width: '100%' }}>
      <div className="flex flex-1 min-h-0 relative">
        {/* Chat area */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-auto px-4 py-4 space-y-4 relative"
          style={{ width: chaptersPanelOpen ? undefined : '100%' }}
        >
          {/* Chapter toggle button */}
          <button
            onClick={() => setChaptersPanelOpen(!chaptersPanelOpen)}
            className={`absolute top-2 right-2 z-10 p-1.5 rounded transition-colors
              ${chaptersPanelOpen ? 'bg-active text-primary' : 'text-muted hover:text-primary hover:bg-hover'}`}
            title="Toggle chapters"
          >
            <ListTree size={16} />
          </button>

          {visibleMessages.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted text-sm">
              Start a conversation…
            </div>
          )}
          {turns.map((turn) => (
            <ChatTurn
              key={turn.id}
              turnId={turn.id}
              userMessage={turn.userMessage}
              assistantMessage={turn.assistantMessage}
              isStreaming={turn.isStreaming}
            />
          ))}
          {errors.length > 0 && (
            <div className="text-xs text-red-400/80 border border-red-900/30 rounded px-3 py-2 bg-red-950/20">
              {errors[errors.length - 1]}
            </div>
          )}

          <ScrollToBottomButton
            visible={!isNearBottom}
            newMessageCount={newMessagesBelow}
            onClick={scrollToBottom}
          />
        </div>

        {/* Chapters sidebar */}
        {chaptersPanelOpen && (
          <ChaptersPanel
            chapters={chapters}
            activeChapter={activeChapter}
            onNavigate={navigateToChapter}
          />
        )}
      </div>
    </div>
  );
}
