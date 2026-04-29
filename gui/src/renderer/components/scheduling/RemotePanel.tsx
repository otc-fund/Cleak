import React, { useState } from 'react';
import { Radio, Bell } from 'lucide-react';

export function RemotePanel(): React.ReactElement {
  const [connected] = useState(true);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-medium text-primary">Remote Triggers</span>
        <div className="flex items-center gap-1 text-[10px]">
          <Radio size={10} className={connected ? 'text-green-500' : 'text-muted'} />
          <span className={connected ? 'text-green-500' : 'text-muted'}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto py-2 px-3">
        <div className="text-xs text-muted mb-3">
          Remote triggers allow scheduling agents from other devices and receiving push notifications when they complete.
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Bell size={11} />
            <span>Push notifications: {connected ? 'enabled' : 'disabled'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
