import React from 'react';
import { Server, Network, Users, CheckCircle, XCircle } from 'lucide-react';

interface ServiceStatus {
  name: string;
  running: boolean;
  pid?: number;
  uptime?: string;
}

const SERVICES: ServiceStatus[] = [
  { name: 'Daemon', running: true, pid: 1234, uptime: '2h 15m' },
  { name: 'Bridge', running: true, pid: 1235, uptime: '2h 15m' },
  { name: 'Coordinator', running: false },
  { name: 'KAIROS', running: false },
];

export function DaemonStatus(): React.ReactElement {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <Server size={12} className="text-primary" />
        <span className="text-xs font-medium text-primary">System Status</span>
      </div>

      <div className="flex-1 overflow-auto py-1">
        {SERVICES.map(svc => (
          <div key={svc.name} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-active">
            {svc.running ? (
              <CheckCircle size={12} className="text-green-500 shrink-0" />
            ) : (
              <XCircle size={12} className="text-muted shrink-0" />
            )}
            <span className="flex-1 text-primary">{svc.name}</span>
            {svc.running ? (
              <span className="text-muted text-[10px]">
                PID {svc.pid} · {svc.uptime}
              </span>
            ) : (
              <span className="text-muted text-[10px]">Stopped</span>
            )}
          </div>
        ))}

        <div className="px-3 py-2 mt-2 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Network size={12} />
            <span>Bridge: connected</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted mt-1">
            <Users size={12} />
            <span>Agents: 0 active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
