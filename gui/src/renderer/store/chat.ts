// src/renderer/store/chat.ts
import { create } from 'zustand';
import type { BridgeStatus } from '../../main/ipc';
import type { CleakInboundFrame } from '../../main/cleakProtocol';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  pending: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  status: BridgeStatus;
  errors: string[];
  appendUser(text: string): void;
  ingestFrame(frame: CleakInboundFrame): void;
  setStatus(s: BridgeStatus): void;
  pushError(message: string): void;
}

function nextId(): string {
  return Math.random().toString(36).slice(2);
}

function extractAssistantText(frame: CleakInboundFrame): string {
  if (frame.type !== 'assistant') return '';
  const c = frame.message.content;
  if (typeof c === 'string') return c;
  return c
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

export const useChat = create<ChatState>((set) => ({
  messages: [],
  status: { kind: 'starting' },
  errors: [],
  appendUser(text) {
    set((s) => ({
      messages: [
        ...s.messages,
        { id: nextId(), role: 'user', text, pending: false },
        { id: nextId(), role: 'assistant', text: '', pending: true },
      ],
    }));
  },
  ingestFrame(frame) {
    if (frame.type === 'assistant') {
      const piece = extractAssistantText(frame);
      set((s) => {
        const msgs = [...s.messages];
        const tail = msgs[msgs.length - 1];
        if (tail && tail.role === 'assistant' && tail.pending) {
          msgs[msgs.length - 1] = { ...tail, text: tail.text + piece };
        } else {
          msgs.push({ id: nextId(), role: 'assistant', text: piece, pending: true });
        }
        return { messages: msgs };
      });
    } else if (frame.type === 'result') {
      set((s) => {
        const msgs = [...s.messages];
        const tail = msgs[msgs.length - 1];
        if (tail && tail.role === 'assistant' && tail.pending) {
          msgs[msgs.length - 1] = { ...tail, pending: false };
        }
        return { messages: msgs };
      });
    }
  },
  setStatus(status) {
    set({ status });
  },
  pushError(message) {
    set((s) => ({ errors: [...s.errors.slice(-19), message] }));
  },
}));
