import React, { useEffect } from 'react';
import { useContextUsage } from '../../store/contextUsage';

export function ContextUsageGrid(): React.ReactElement {
  const { usage, loading, refresh } = useContextUsage();

  useEffect(() => { refresh(); }, [refresh]);

  if (loading || !usage) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted">
        Loading context usage…
      </div>
    );
  }

  const pctColor =
    usage.percentage >= 85
      ? 'bg-red-500'
      : usage.percentage >= 60
        ? 'bg-amber-500'
        : 'bg-green-500';

  const fmt = (n: number): string =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div className="flex flex-col gap-3 p-3 text-xs bg-[#0b0b0b] rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-primary font-medium">Context Usage</span>
        <span className="text-muted">
          {fmt(usage.totalTokens)} / {fmt(usage.maxTokens)}
          {' '}
          <span className="text-muted">
            ({usage.percentage.toFixed(0)}%)
          </span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pctColor}`}
          style={{ width: `${Math.min(usage.percentage, 100)}%` }}
        />
      </div>

      {/* Categories */}
      <div className="flex flex-col gap-1.5">
        {usage.categories.map((c) => (
          <div key={c.name} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: c.color }}
            />
            <span className="flex-1 text-primary">{c.name}</span>
            <span className="text-muted">
              {fmt(c.tokens)}
              {c.isDeferred ? ' (deferred)' : ''}
            </span>
          </div>
        ))}
      </div>

      {/* Auto-compact threshold */}
      {usage.percentage >= 85 && (
        <div className="text-[10px] text-red-400">
          Near context limit — auto-compaction may trigger
        </div>
      )}

      {/* API usage summary */}
      {usage.apiUsage && (
        <div className="grid grid-cols-2 gap-2 text-[10px] text-muted pt-1 border-t border-border">
          <div>
            <span className="text-muted">Requests</span>
            <div className="text-primary">{usage.apiUsage.requests}</div>
          </div>
          <div>
            <span className="text-muted">Tokens</span>
            <div className="text-primary">{fmt(usage.apiUsage.tokens)}</div>
          </div>
          <div className="col-span-2 text-center text-muted">
            {usage.apiUsage.period}
          </div>
        </div>
      )}
    </div>
  );
}
