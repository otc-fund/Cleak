import React from 'react';
import { Plus, Pin, PinOff, Trash2 } from 'lucide-react';
import { useSessions } from '../../store/sessions';

function SectionHeader({ label }: { label: string }): React.ReactElement {
  return <div className="px-3 pt-3 pb-1 text-[11px] font-medium text-muted">{label}</div>;
}

function SessionRow({
  id, name, active, pinned,
  onClick, onPin, onDelete,
}: {
  id: string;
  name: string;
  active: boolean;
  pinned?: boolean;
  onClick(): void;
  onPin(): void;
  onDelete(): void;
}): React.ReactElement {
  const isPinned = pinned === true;
  return (
    <div
      className={`group flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors ${
        active ? 'bg-active text-primary' : 'text-muted hover:bg-hover hover:text-primary'
      }`}
      onClick={onClick}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-primary' : 'bg-muted'}`} />
      <span className="flex-1 truncate">{name}</span>
      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
        <button
          className="p-0.5 rounded text-muted hover:text-primary transition-colors"
          onClick={e => { e.stopPropagation(); onPin(); }}
          title={isPinned ? 'Unpin' : 'Pin'}
        >
          {isPinned ? <PinOff size={10} /> : <Pin size={10} />}
        </button>
        <button
          className="p-0.5 rounded text-muted hover:text-red-400 transition-colors"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Delete"
        >
          <Trash2 size={10} />
        </button>
      </div>
    </div>
  );
}

export function SessionManager(): React.ReactElement {
  const { sessions, currentSession, selectSession, togglePin, deleteSession } = useSessions();
  const [query, setQuery] = React.useState('');

  const filtered = query
    ? sessions.filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
    : sessions;

  const pinned = filtered.filter(s => s.pinned === true);
  const recents = filtered.filter(s => s.pinned !== true).sort((a, b) => b.lastActive - a.lastActive);

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-1.5 border-b border-border shrink-0">
        <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-primary bg-hover rounded hover:bg-active transition-colors">
          <Plus size={14} />
          <span>New session</span>
        </button>
      </div>

      <div className="px-2 py-1 border-b border-border shrink-0">
        <input
          className="w-full bg-[#0b0b0b] text-xs text-primary px-2 py-1.5 rounded border border-border outline-none placeholder:text-muted"
          placeholder="Search sessions..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-auto">
        {pinned.length > 0 && (
          <>
            <SectionHeader label="Pinned" />
            {pinned.map(s => (
              <SessionRow
                key={s.id}
                id={s.id}
                name={s.name}
                active={s.id === currentSession?.id}
                pinned={s.pinned}
                onClick={() => selectSession(s.id)}
                onPin={() => togglePin(s.id)}
                onDelete={() => void deleteSession(s.id)}
              />
            ))}
          </>
        )}
        <SectionHeader label="Recents" />
        {recents.length === 0 && pinned.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted text-center">No sessions yet</div>
        )}
        {recents.map(s => (
          <SessionRow
            key={s.id}
            id={s.id}
            name={s.name}
            active={s.id === currentSession?.id}
            pinned={s.pinned}
            onClick={() => selectSession(s.id)}
            onPin={() => togglePin(s.id)}
            onDelete={() => void deleteSession(s.id)}
          />
        ))}
      </div>
    </div>
  );
}
