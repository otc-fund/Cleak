import React, { useState } from 'react';
import { Clock, Plus, Trash2, Play, Pause } from 'lucide-react';
import { useScheduling } from '../../store/scheduling';

export function CronManager(): React.ReactElement {
  const { cronJobs, addCronJob, deleteCronJob, toggleCronJob } = useScheduling();
  const [showAdd, setShowAdd] = useState(false);
  const [cron, setCron] = useState('0 9 * * *');
  const [prompt, setPrompt] = useState('');
  const [recurring, setRecurring] = useState(true);

  function handleAdd() {
    addCronJob({ cron, prompt, recurring, status: 'active' });
    setShowAdd(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-medium text-primary">Cron Jobs</span>
        <button className="p-1 rounded hover:bg-active text-muted hover:text-primary" onClick={() => setShowAdd(v => !v)}>
          <Plus size={12} />
        </button>
      </div>

      {showAdd && (
        <div className="flex flex-col gap-1.5 p-2 border-b border-border bg-surface/50">
          <input className="bg-[#0b0b0b] text-xs font-mono px-2 py-1 rounded border border-border text-primary" value={cron} onChange={e => setCron(e.target.value)} placeholder="0 9 * * *" />
          <textarea className="bg-[#0b0b0b] text-xs px-2 py-1 rounded border border-border text-primary resize-none h-12" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Prompt..." />
          <label className="flex items-center gap-1 text-xs text-muted">
            <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} /> Recurring
          </label>
          <button className="px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent/80" onClick={handleAdd}>Create</button>
        </div>
      )}

      <div className="flex-1 overflow-auto py-1">
        {cronJobs.map(j => (
          <div key={j.id} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-active">
            <Clock size={11} className={j.status === 'active' ? 'text-green-500' : 'text-muted'} />
            <div className="flex-1">
              <div className="text-primary font-mono text-[10px]">{j.cron}</div>
              <div className="text-muted truncate">{j.prompt}</div>
            </div>
            <button className="text-muted hover:text-primary p-0.5" onClick={() => toggleCronJob(j.id)}>
              {j.status === 'active' ? <Pause size={10} /> : <Play size={10} />}
            </button>
            <button className="text-muted hover:text-red-400 p-0.5" onClick={() => deleteCronJob(j.id)}>
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
