import React from 'react';
import { useChat } from '../store/chat';
import type { BridgeStatus } from '../../main/ipc';

function describeStatus(s: BridgeStatus): string {
  switch (s.kind) {
    case 'starting':
      return 'starting…';
    case 'running':
      return s.protocolOk
        ? `running (session ${s.sessionId ?? '—'})`
        : 'running — protocol mismatch';
    case 'restarting':
      return `restarting (attempt ${s.attempt}): ${s.reason}`;
    case 'stopped':
      return `stopped: ${s.reason}`;
  }
}

export function StatusBar(): React.ReactElement {
  const status = useChat((s) => s.status);
  const lastError = useChat((s) => s.errors[s.errors.length - 1]);
  return (
    <div className="border-t border-zinc-800 px-3 py-1 text-xs flex justify-between text-zinc-400">
      <span>cleak: {describeStatus(status)}</span>
      <span className="truncate max-w-[60%] text-right">
        {lastError ? `⚠ ${lastError}` : 'qwen3.6-plus @ localhost:3003'}
      </span>
    </div>
  );
}
