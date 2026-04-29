import React from 'react';
import { Lightbulb, Check, X } from 'lucide-react';
import { useUi } from '../../store/ui';
import { cn } from '../../lib/cn';

export function PlanModeBanner(): React.ReactElement | null {
  const planMode = useUi(s => s.planMode);
  const setPlanMode = useUi(s => s.setPlanMode);

  if (!planMode) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-400 text-xs shrink-0">
      <Lightbulb size={12} className="shrink-0" />
      <span className="font-medium">Plan Mode</span>
      <span className="text-muted">— agent is proposing a plan. No code will be modified.</span>
      <div className="ml-auto flex gap-1">
        <button
          className={cn(
            'flex items-center px-2 py-0.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 text-[10px] transition-colors',
          )}
          title="Approve and let agent execute"
          onClick={() => setPlanMode(false)}
        >
          <Check size={10} className="mr-0.5" />
          Approve
        </button>
        <button
          className={cn(
            'flex items-center px-2 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-[10px] transition-colors',
          )}
          title="Reject plan"
          onClick={() => setPlanMode(false)}
        >
          <X size={10} className="mr-0.5" />
          Reject
        </button>
      </div>
    </div>
  );
}
