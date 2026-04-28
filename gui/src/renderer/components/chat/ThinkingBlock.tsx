import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';

interface Props {
  thinking: string;
  forceCollapse?: boolean;
}

export function ThinkingBlock({ thinking, forceCollapse = false }: Props): React.ReactElement {
  const defaultOpen = !forceCollapse && thinking.length <= 200;
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="my-1 rounded border border-border/50 bg-panel/30 text-xs">
      <button
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-muted hover:text-primary transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <Brain size={12} className="text-accent/70 shrink-0" />
        <span className="flex-1 text-left truncate">
          {open ? 'Thinking' : `Thinking: ${thinking.slice(0, 60)}…`}
        </span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="px-3 pb-2 text-muted whitespace-pre-wrap leading-relaxed border-t border-border/30">
          {thinking}
        </div>
      )}
    </div>
  );
}
