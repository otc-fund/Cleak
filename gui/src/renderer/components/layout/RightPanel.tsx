import React from 'react';
import { useUi } from '../../store/ui';

export function RightPanel(): React.ReactElement | null {
  const { rightPanelOpen } = useUi();
  if (!rightPanelOpen) return null;
  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: 'var(--right-w)',
        background: 'var(--bg-panel)',
        borderLeft: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Context panel — coming soon
      </div>
    </div>
  );
}
