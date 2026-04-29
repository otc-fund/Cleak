import { create } from 'zustand';

export interface CronJob {
  id: string;
  cron: string;
  prompt: string;
  recurring: boolean;
  nextRun?: string;
  status: 'active' | 'paused' | 'expired';
}

export interface Monitor {
  id: string;
  description: string;
  running: boolean;
  events: number;
}

interface SchedulingState {
  cronJobs: CronJob[];
  monitors: Monitor[];
  addCronJob(job: Omit<CronJob, 'id'>): void;
  deleteCronJob(id: string): void;
  toggleCronJob(id: string): void;
}

export const useScheduling = create<SchedulingState>((set) => ({
  cronJobs: [],
  monitors: [],
  addCronJob(job) {
    const id = `cron-${Date.now()}`;
    set(s => ({ cronJobs: [...s.cronJobs, { ...job, id }] }));
  },
  deleteCronJob(id) {
    set(s => ({ cronJobs: s.cronJobs.filter(j => j.id !== id) }));
  },
  toggleCronJob(id) {
    set(s => ({
      cronJobs: s.cronJobs.map(j =>
        j.id === id ? { ...j, status: j.status === 'active' ? 'paused' as const : 'active' as const } : j,
      ),
    }));
  },
}));
