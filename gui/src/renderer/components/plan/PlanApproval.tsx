import React from 'react';
import { Check, X } from 'lucide-react';
import { useUi } from '../../store/ui';
import { cn } from '../../lib/cn';

export function PlanApproval(): React.ReactElement | null {
  const planMode = useUi(s => s.planMode);
  const setPlanMode = useUi(s => s.setPlanMode);

  if (!planMode) return null;

  return (
    <div className="flex flex-col h-full p-4">
      <h3 className="text-sm font-medium text-primary mb-2">Plan Approval</h3>
      <p className="text-xs text-muted mb-4">
        The agent has proposed a plan. Review it and decide whether to proceed.
      </p>
      <div className="flex gap-2 mt-auto">
        <button
          className={cn(
            'flex items-center px-3 py-1.5 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs transition-colors',
          )}
          onClick={() => setPlanMode(false)}
        >
          <Check size={12} className="mr-1" />
          Approve
        </button>
        <button
          className={cn(
            'flex items-center px-3 py-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs transition-colors',
          )}
          onClick={() => setPlanMode(false)}
        >
          <X size={12} className="mr-1" />
          Request Changes
        </button>
      </div>
    </div>
  );
}
