import React from 'react';
import { useContextUsage, ContextUsage } from '../../store/contextUsage';

function usageColor(pct: number): string {
  if (pct >= 85) return 'text-red-400';
  if (pct >= 60) return 'text-amber-400';
  return 'text-green-400';
}

function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function ContextStatusBar(): React.ReactElement {
  const { usage, refresh } = useContextUsage();

  if (!usage) {
    return (
      <div
        className="flex items-center gap-2 px-2 text-[10px] text-muted cursor-pointer select-none"
        onClick={() => refresh()}
        title="Click to refresh context usage"
      >
        Context: —
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 px-2 text-[10px] cursor-pointer select-none"
      onClick={() => refresh()}
      title="Click to refresh context usage"
    >
      <span className={usageColor(usage.percentage)}>
        Context: {fmt(usage.totalTokens)} ({usage.percentage.toFixed(0)}%)
      </span>
      <span className="text-muted">{usage.model}</span>
    </div>
  );
}
