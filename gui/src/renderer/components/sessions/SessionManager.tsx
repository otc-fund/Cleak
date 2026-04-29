import React, { useEffect } from 'react';
import { Search } from 'lucide-react';
import { useSessions } from '../../store/sessions';
import { SessionCard } from './SessionCard';

export function SessionManager(): React.ReactElement {
  const { sessions, loadSessions, currentSession, selectSession } = useSessions();
  const [query, setQuery] = React.useState('');

  useEffect(() => { void loadSessions(); }, []);

  const filtered = query
    ? sessions.filter(s => s.name.toLowerCase().includes(query.toLowerCase()))
    : sessions;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border shrink-0">
        <Search size={11} className="text-muted" />
        <input
          className="flex-1 bg-transparent text-xs text-primary outline-none placeholder:text-muted"
          placeholder="Search sessions..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-auto py-1">
        {filtered.map(s => (
          <SessionCard
            key={s.id}
            session={s}
            active={s.id === currentSession?.id}
            onClick={() => selectSession(s.id)}
          />
        ))}
      </div>
    </div>
  );
}
