import React from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useNotifications } from '../../store/notifications';
import { cn } from '../../lib/cn';

const ICONS = {
  info: <Info size={14} className="text-blue-400" />,
  success: <CheckCircle size={14} className="text-green-400" />,
  warning: <AlertTriangle size={14} className="text-amber-400" />,
  error: <AlertCircle size={14} className="text-red-400" />,
};

const BORDER_COLORS = {
  info: 'border-blue-500/50',
  success: 'border-green-500/50',
  warning: 'border-amber-500/50',
  error: 'border-red-500/50',
};

export function ToastContainer(): React.ReactElement {
  const { toasts, dismissToast } = useNotifications();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-[320px]">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'flex items-start gap-2 p-3 bg-surface border rounded-lg shadow-lg animate-slide-in',
            BORDER_COLORS[t.type],
          )}
        >
          {ICONS[t.type]}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-primary font-medium">{t.title}</div>
            <div className="text-[10px] text-muted">{t.message}</div>
          </div>
          <button className="text-muted hover:text-primary shrink-0" onClick={() => dismissToast(t.id)}>
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
