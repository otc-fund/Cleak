import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useMemory, MemoryType, MemoryFile } from '../../store/memory';

interface Props {
  memory: MemoryFile | null;
  onClose(): void;
}

export function MemoryEditor({ memory, onClose }: Props): React.ReactElement {
  const { createMemory, updateMemory } = useMemory();
  const [name, setName] = useState(memory?.name ?? '');
  const [description, setDescription] = useState(memory?.description ?? '');
  const [type, setType] = useState<MemoryType>(memory?.type ?? 'user');
  const [body, setBody] = useState(memory?.body ?? '');

  function handleSave() {
    if (!name || !body) return;
    if (memory) {
      updateMemory(memory.file, { name, description, type, body });
    } else {
      const file = `${type}_${name.toLowerCase().replace(/\s+/g, '_')}.md`;
      createMemory(file, { name, description, type, body });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-border rounded-lg w-[520px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-sm font-medium">{memory ? 'Edit Memory' : 'New Memory'}</span>
          <button className="text-muted hover:text-primary" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="p-4 flex flex-col gap-2 overflow-auto">
          <input className="bg-[#0b0b0b] text-xs px-2 py-1.5 rounded border border-border" value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. User role)" />
          <input className="bg-[#0b0b0b] text-xs px-2 py-1.5 rounded border border-border" value={description} onChange={e => setDescription(e.target.value)} placeholder="One-line description" />
          <select className="bg-[#0b0b0b] text-xs px-2 py-1.5 rounded border border-border" value={type} onChange={e => setType(e.target.value as MemoryType)}>
            <option value="user">user</option>
            <option value="feedback">feedback</option>
            <option value="project">project</option>
            <option value="reference">reference</option>
          </select>
          <textarea
            className="bg-[#0b0b0b] text-xs px-2 py-1.5 rounded border border-border font-mono resize-none h-40"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={"Rule/fact\n\n**Why:** ...\n**How to apply:** ..."}
          />
        </div>
        <div className="flex justify-end gap-2 px-4 py-2 border-t border-border">
          <button className="px-3 py-1 text-xs text-muted hover:text-primary" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1 text-xs bg-accent text-white rounded hover:bg-accent/80" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
