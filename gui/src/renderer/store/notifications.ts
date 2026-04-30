import { create } from 'zustand';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

interface NotificationState {
  notifications: Notification[];
  toasts: Notification[];
  addNotification(n: Omit<Notification, 'id' | 'timestamp' | 'read'>, persistent?: boolean): void;
  markRead(id: string): void;
  dismissToast(id: string): void;
  clearAll(): void;
}

let counter = 0;
export const useNotifications = create<NotificationState>((set) => ({
  notifications: [],
  toasts: [],

  addNotification(n, persistent = true) {
    const id = `notif-${++counter}`;
    const entry = { ...n, id, timestamp: Date.now(), read: false };
    set(s => ({
      notifications: [...s.notifications, entry],
      toasts: persistent ? [...s.toasts, entry] : s.toasts,
    }));
    if (!persistent) {
      setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 5000);
    }
  },
  markRead(id) {
    set(s => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
    }));
  },
  dismissToast(id) {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
  },
  clearAll() { set({ notifications: [], toasts: [] }); },
}));
