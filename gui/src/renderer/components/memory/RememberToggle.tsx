import React from 'react';
import { Brain } from 'lucide-react';
import { useMemory, MemoryType } from '../../store/memory';

const ALL_TYPES: { key: MemoryType; label: string }[] = [
  { key: 'user', label: 'User' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'project', label: 'Project' },
  { key: 'reference', label: 'Reference' },
];

export function RememberToggle(): React.ReactElement {
  const { rememberConfig, updateRememberConfig } = useMemory();

  return (
    <div className="flex flex-col gap-2 px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <Brain size={12} className="text-muted" />
        <span className="text-primary font-medium">Auto-Memory</span>
        <label className="flex items-center gap-1 ml-auto">
          <input
            type="checkbox"
            checked={rememberConfig.enabled}
            onChange={e => updateRememberConfig({ enabled: e.target.checked })}
          />
          <span className="text-muted">Enabled</span>
        </label>
      </div>
      <div className="flex flex-wrap gap-1">
        {ALL_TYPES.map(t => (
          <label
            key={t.key}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#0b0b0b] text-muted cursor-pointer"
          >
            <input
              type="checkbox"
              checked={rememberConfig.types.includes(t.key)}
              onChange={e => {
                const types = e.target.checked
                  ? [...rememberConfig.types, t.key]
                  : rememberConfig.types.filter(k => k !== t.key);
                updateRememberConfig({ types });
              }}
            />
            {t.label}
          </label>
        ))}
      </div>
    </div>
  );
}
