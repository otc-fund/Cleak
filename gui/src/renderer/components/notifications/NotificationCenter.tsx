import React from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Trash2 } from 'lucide-react';
import { useNotifications } from '../../store/notifications';
import { cn } from '../../lib/cn';

const ICONS = {
  info: <Info size={14} className="text-blue-400 shrink-0" />,
  success: <CheckCircle size={14} className="text-green-400 shrink-0" />,
  warning: <AlertTriangle size={14} className="text-amber-400 shrink-0" />,
  error: <AlertCircle size={14} className="text-red-400 shrink-0" />,
};

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationCenter({ open, onClose }: NotificationCenterProps): React.ReactElement | null {
  const { notifications, markRead, clearAll } = useNotifications();

  if (!open) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div className="absolute right-4 top-14 w-[360px] max-h-[70vh] bg-surface border rounded-lg shadow-2xl pointer-events-auto flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-primary">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </div>
          <button onClick={onClose} className="text-muted hover:text-primary" aria-label="Close notifications">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted text-xs">No notifications</div>
          ) : (
            <div className="divide-y divide-border/30">
              {notifications.map(n => (
                <div
                  key={n.id}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors',
                    !n.read && 'bg-white/[0.03]',
                  )}
                  onClick={() => markRead(n.id)}
                >
                  {ICONS[n.type]}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-primary font-medium">{n.title}</div>
                    <div className="text-[10px] text-muted mt-0.5">{n.message}</div>
                    <div className="text-[9px] text-muted/60 mt-1">
                      {new Date(n.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t">
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 text-[10px] text-muted hover:text-red-400 transition-colors"
              aria-label="Clear all notifications"
            >
              <Trash2 size={10} />
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
