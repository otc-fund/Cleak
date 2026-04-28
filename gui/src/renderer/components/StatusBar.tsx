import React from 'react';
import { PanelRight } from 'lucide-react';
import { useChat } from '../store/chat';
import { useSettings } from '../store/settings';
import { useUi } from '../store/ui';
import type { BridgeStatus } from '../../main/ipc';
import { cn } from '../lib/cn';
import { CostMeter } from './chat/CostMeter';

function describeBridgeStatus(s: BridgeStatus): { text: string; dot: string } {
  switch (s.kind) {
    case 'starting':    return { text: 'starting…',     dot: 'bg-yellow-500' };
    case 'running':     return { text: s.protocolOk ? 'connected' : 'protocol error', dot: s.protocolOk ? 'bg-green-500' : 'bg-red-500' };
    case 'restarting':  return { text: `restarting (${s.attempt})`, dot: 'bg-yellow-500' };
    case 'stopped':     return { text: 'stopped',        dot: 'bg-red-500'    };
  }
}

export function StatusBar(): React.ReactElement {
  const status = useChat((s) => s.status);
  const model  = useSettings((s) => s.model);
  const lastError = useChat((s) => s.errors[s.errors.length - 1]);
  const { rightPanelOpen, setRightPanelOpen } = useUi();

  const { text, dot } = describeBridgeStatus(status);

  return (
    <div
      className="flex items-center justify-between px-3 shrink-0 text-[11px]"
      style={{
        height: 'var(--status-h)',
        background: 'var(--bg-panel)',
        borderTop: '1px solid var(--border)',
        color: 'var(--text-muted)',
      }}
    >
      {/* Left: bridge status */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
        <span className="truncate">{text}</span>
        {lastError && (
          <span className="truncate text-red-400 ml-2" title={lastError}>
            ⚠ {lastError}
          </span>
        )}
      </div>

      {/* Right: model + cost + right-panel toggle */}
      <div className="flex items-center gap-3 shrink-0 ml-3">
        <CostMeter />
        <span style={{ color: 'var(--text-subtle)' }}>{model}</span>
        <button
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          aria-label="Toggle right panel"
          className={cn(
            'hover:text-primary transition-colors',
            rightPanelOpen && 'text-primary',
          )}
        >
          <PanelRight size={12} />
        </button>
      </div>
    </div>
  );
}
