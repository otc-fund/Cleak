import React, { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { useAskUser } from '../../store/agents';
import { cn } from '../../lib/cn';

export function AskUserQuestionModal(): React.ReactElement | null {
  const { pending, setPending, submitAnswer } = useAskUser();
  const [textAnswer, setTextAnswer] = useState('');

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface border border-border rounded-lg max-w-md w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <HelpCircle size={14} className="text-amber-400 shrink-0" />
          <span className="text-sm font-medium text-primary">Agent Question</span>
          <button className="ml-auto text-muted hover:text-primary" onClick={() => setPending(null)}>
            <X size={14} />
          </button>
        </div>

        {/* Question */}
        <div className="px-4 py-3">
          <p className="text-xs text-primary mb-3">{pending.question}</p>

          {/* Options */}
          {pending.options.length > 0 && (
            <div className="space-y-1">
              {pending.options.map((opt, i) => (
                <button
                  key={i}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded text-xs border border-border hover:border-accent/50 transition-colors',
                  )}
                  onClick={() => submitAnswer(pending.id, opt.label)}
                >
                  <span className="text-primary font-medium">{opt.label}</span>
                  {opt.description && (
                    <span className="block text-muted text-[10px]">{opt.description}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Text input */}
          {pending.allowText && (
            <div className="mt-3">
              <input
                className="w-full bg-[#0b0b0b] border border-border rounded px-2 py-1.5 text-xs text-primary outline-none focus:border-accent/50"
                placeholder="Type your answer..."
                value={textAnswer}
                onChange={e => setTextAnswer(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && textAnswer.trim()) {
                    submitAnswer(pending.id, textAnswer.trim());
                  }
                }}
              />
              <button
                className="mt-1 w-full px-3 py-1 rounded text-xs bg-accent text-white hover:bg-accent/80 transition-colors"
                disabled={!textAnswer.trim()}
                onClick={() => {
                  if (textAnswer.trim()) {
                    submitAnswer(pending.id, textAnswer.trim());
                    setTextAnswer('');
                  }
                }}
              >
                Submit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
