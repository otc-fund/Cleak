import React from 'react';
import { useChat } from '../../store/chat';

export function CostMeter(): React.ReactElement | null {
  const cost = useChat((s) => s.cost);
  if (!cost) return null;

  const fmt = (n: number): string =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div className="flex items-center gap-2 text-[10px] text-muted font-mono">
      <span title="Input tokens">↑{fmt(cost.inputTokens)}</span>
      <span title="Output tokens">↓{fmt(cost.outputTokens)}</span>
      {cost.cacheReadTokens > 0 && (
        <span title="Cache read tokens" className="text-green-600">⚡{fmt(cost.cacheReadTokens)}</span>
      )}
      {cost.totalCostUsd > 0 && (
        <span title="Total cost" className="text-amber-500/70">
          ${cost.totalCostUsd < 0.01 ? cost.totalCostUsd.toFixed(4) : cost.totalCostUsd.toFixed(3)}
        </span>
      )}
    </div>
  );
}
