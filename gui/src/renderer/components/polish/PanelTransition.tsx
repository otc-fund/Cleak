import React from 'react';
import { cn } from '../../lib/cn';

export function PanelTransition({ show, children }: {
  show: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className={cn(
      'transition-all duration-200',
      show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none absolute',
    )}>
      {children}
    </div>
  );
}
