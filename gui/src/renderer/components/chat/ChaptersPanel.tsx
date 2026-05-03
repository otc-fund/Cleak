import { X } from 'lucide-react';
import { useUi } from '../../store/ui';

export interface Chapter {
  id: string;
  title: string;
  subChapters: {
    id: string;
    title: string;
    level: number;
  }[];
}

interface ChaptersPanelProps {
  chapters: Chapter[];
  activeChapter: string | null;
  onNavigate: (id: string, subId?: string) => void;
}

export function ChaptersPanel({ chapters, activeChapter, onNavigate }: ChaptersPanelProps) {
  const { setChaptersPanelOpen } = useUi();

  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden border-l border-border/50"
      style={{ width: '220px', background: 'var(--bg-panel, #1a1a2e)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 shrink-0">
        <span className="text-xs font-semibold text-primary flex-1">Chapters</span>
        <button
          onClick={() => setChaptersPanelOpen(false)}
          className="p-1 rounded hover:bg-hover transition-colors text-muted hover:text-primary"
        >
          <X size={14} />
        </button>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto py-1 scrollbar-thin">
        {chapters.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted text-center">No chapters yet</div>
        )}
        {chapters.map((ch) => {
          const isActive = ch.id === activeChapter;
          return (
            <div key={ch.id}>
              <button
                className={`w-full text-left px-3 py-1.5 text-xs truncate transition-colors flex items-center gap-2
                  ${isActive
                    ? 'text-primary bg-active/50 border-l-2 border-accent'
                    : 'text-muted hover:text-primary hover:bg-hover border-l-2 border-transparent'
                  }`}
                onClick={() => onNavigate(ch.id)}
                title={ch.title}
              >
                <span className={`shrink-0 w-1.5 h-1.5 rounded-full transition-colors ${
                  isActive ? 'bg-accent' : 'bg-muted/40'
                }`} />
                {ch.title}
              </button>
              {ch.subChapters.map((sub) => {
                const subActive = sub.id === activeChapter;
                return (
                  <button
                    key={sub.id}
                    className={`w-full text-left px-3 py-1 truncate transition-colors text-[11px]
                      ${subActive
                        ? 'text-primary bg-active/50'
                        : 'text-muted/70 hover:text-primary hover:bg-hover'
                      }`}
                    style={{ paddingLeft: `${12 + sub.level * 8}px` }}
                    onClick={() => onNavigate(ch.id, sub.id)}
                    title={sub.title}
                  >
                    {sub.title}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
