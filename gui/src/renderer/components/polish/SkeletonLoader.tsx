import React from 'react';
import { cn } from '../../lib/cn';

export function SkeletonLoader({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={cn('animate-pulse bg-surface rounded', className)} />
  );
}
