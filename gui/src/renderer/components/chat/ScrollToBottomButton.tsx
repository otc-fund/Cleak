import { ChevronDown } from 'lucide-react';

interface ScrollToBottomButtonProps {
  visible: boolean;
  newMessageCount: number;
  onClick: () => void;
}

export function ScrollToBottomButton({ visible, newMessageCount, onClick }: ScrollToBottomButtonProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 right-4 z-10 p-2.5 rounded-full bg-panel border border-border/50 shadow-lg
                 hover:bg-hover hover:border-border transition-all group"
      title="Scroll to bottom"
    >
      <ChevronDown size={18} className="text-muted group-hover:text-primary transition-colors" />
      {newMessageCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent
                         text-[10px] font-medium text-accent-fg flex items-center justify-center shadow">
          {newMessageCount > 9 ? '9+' : newMessageCount}
        </span>
      )}
    </button>
  );
}
