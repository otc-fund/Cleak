import React, { useState } from 'react';
import { useChat } from '../store/chat';
import { sendUser } from '../lib/bridge';

export function MessageInput(): React.ReactElement {
  const [text, setText] = useState('');
  const status = useChat((s) => s.status);
  const appendUser = useChat((s) => s.appendUser);
  const disabled = status.kind !== 'running';
  const submit = (): void => {
    const t = text.trim();
    if (!t || disabled) return;
    appendUser(t);
    sendUser(t);
    setText('');
  };
  return (
    <div className="border-t border-zinc-800 p-3 flex gap-2">
      <textarea
        className="flex-1 bg-zinc-900 rounded px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-zinc-700"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={disabled ? 'Bridge not ready…' : 'Message cleak (Enter to send)'}
        disabled={disabled}
      />
      <button
        onClick={submit}
        disabled={disabled || !text.trim()}
        className="px-3 py-2 rounded bg-zinc-800 disabled:opacity-50 hover:bg-zinc-700"
      >
        Send
      </button>
    </div>
  );
}
