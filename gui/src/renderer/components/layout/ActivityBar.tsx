import React from 'react';
import {
  MessageSquare,
  FolderOpen,
  Search,
  CheckSquare,
  Users,
  Plug,
  GitBranch,
  Settings,
} from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useUi, type Activity } from '../../store/ui';
import { cn } from '../../lib/cn';

const ITEMS: { id: Activity; icon: React.ElementType; label: string }[] = [
  { id: 'chat',     icon: MessageSquare, label: 'Chat'     },
  { id: 'files',    icon: FolderOpen,    label: 'Files'    },
  { id: 'search',   icon: Search,        label: 'Search'   },
  { id: 'tasks',    icon: CheckSquare,   label: 'Tasks'    },
  { id: 'agents',   icon: Users,         label: 'Agents'   },
  { id: 'mcp',      icon: Plug,          label: 'MCP'      },
  { id: 'git',      icon: GitBranch,     label: 'Git'      },
  { id: 'settings', icon: Settings,      label: 'Settings' },
];

export function ActivityBar(): React.ReactElement {
  const { activeActivity, setActivity } = useUi();
  return (
    <Tooltip.Provider delayDuration={400}>
      <div
        className="flex flex-col items-center py-2 gap-1 shrink-0"
        style={{ width: 'var(--activity-w)', background: 'var(--bg-panel)', borderRight: '1px solid var(--border)' }}
      >
        {ITEMS.map(({ id, icon: Icon, label }) => (
          <Tooltip.Root key={id}>
            <Tooltip.Trigger asChild>
              <button
                onClick={() => setActivity(id)}
                aria-label={label}
                className={cn(
                  'w-9 h-9 flex items-center justify-center rounded text-muted transition-colors',
                  activeActivity === id
                    ? 'text-primary bg-active'
                    : 'hover:text-primary hover:bg-hover',
                )}
              >
                <Icon size={18} strokeWidth={1.5} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="right"
                sideOffset={6}
                className="px-2 py-1 rounded text-xs bg-[#2a2a2a] text-primary border border-border shadow-lg z-50"
              >
                {label}
                <Tooltip.Arrow className="fill-[#2a2a2a]" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
      </div>
    </Tooltip.Provider>
  );
}
