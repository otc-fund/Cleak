import React, { useState } from 'react';

export function AgentConfigEditor(): React.ReactElement {
  const [json, setJson] = useState('{}');
  const [error, setError] = useState<string | null>(null);

  function handleApply() {
    try {
      JSON.parse(json);
      setError(null);
      // TODO: send config to bridge
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <textarea
        className="flex-1 bg-[#0b0b0b] text-xs text-primary font-mono p-2 resize-none outline-none"
        value={json}
        onChange={e => setJson(e.target.value)}
        spellCheck={false}
      />
      {error && <div className="text-red-400 text-xs px-2 py-1">{error}</div>}
      <button className="px-3 py-1 text-xs bg-accent text-white hover:bg-accent/80" onClick={handleApply}>
        Apply Config
      </button>
    </div>
  );
}
