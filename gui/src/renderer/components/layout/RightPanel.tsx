import React from 'react';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { useUi } from '../../store/ui';
import { useSearch } from '../../store/search';
import { ProcessList } from '../terminal/ProcessList';
import { GlobPicker } from '../search/GlobPicker';
import { ToolSearch } from '../search/ToolSearch';
import { TodoPanel } from '../todos/TodoPanel';
import { TaskPanel } from '../tasks/TaskPanel';
import { TaskOutput } from '../tasks/TaskOutput';
import { useTasks } from '../../store/tasks';
import { useTodos } from '../../store/todos';

function ToolCallPanel(): React.ReactElement {
  const selected = useUi((s) => s.selectedToolCall)!;
  const clear = () => useUi.getState().setSelectedToolCall(null);
  const [paramsOpen, setParamsOpen] = React.useState(true);
  const [resultOpen, setResultOpen] = React.useState(true);

  const resultText = selected.result != null
    ? typeof selected.result === 'string'
      ? selected.result
      : JSON.stringify(selected.result, null, 2)
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs font-medium flex-1 truncate">Tool: {selected.toolName}</span>
        <button className="p-0.5 hover:text-primary transition-colors" onClick={clear}>
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {selected.input != null && (
          <div>
            <button
              className="flex items-center gap-1 w-full py-1 text-xs text-muted hover:text-primary transition-colors"
              onClick={() => setParamsOpen((v) => !v)}
            >
              {paramsOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              <span>Input</span>
            </button>
            {paramsOpen && (
              <pre className="ml-3 text-[10px] leading-relaxed overflow-x-auto whitespace-pre-wrap" style={{ color: 'var(--text-muted)' }}>
                {JSON.stringify(selected.input, null, 2)}
              </pre>
            )}
          </div>
        )}

        {resultText != null && (
          <div>
            <button
              className="flex items-center gap-1 w-full py-1 text-xs text-muted hover:text-primary transition-colors"
              onClick={() => setResultOpen((v) => !v)}
            >
              {resultOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              <span className={selected.isError ? 'text-red-400' : ''}>Result</span>
            </button>
            {resultOpen && (
              <pre className="ml-3 text-[10px] leading-relaxed overflow-x-auto whitespace-pre-wrap" style={{ color: selected.isError ? '#f87171' : 'var(--text-muted)' }}>
                {resultText}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function RightPanel(): React.ReactElement | null {
  const { rightPanelOpen, selectedToolCall, activeActivity } = useUi();
  const { globResults } = useSearch();
  const { tasks, activeTaskId } = useTasks();
  const { todos } = useTodos();
  if (!rightPanelOpen) return null;

  let content: React.ReactNode;
  if (selectedToolCall) {
    content = <ToolCallPanel />;
  } else if (activeActivity === 'processes') {
    content = <ProcessList />;
  } else if (activeActivity === 'search') {
    content = globResults.length > 0 ? <ToolSearch /> : <GlobPicker />;
  } else if (activeActivity === 'tasks') {
    content = activeTaskId ? <TaskOutput /> : <TaskPanel />;
  } else if (todos.length > 0) {
    content = <TodoPanel />;
  } else if (tasks.length > 0) {
    content = activeTaskId ? <TaskOutput /> : <TaskPanel />;
  } else {
    content = (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Context panel — coming soon
      </div>
    );
  }

  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: 'var(--right-w)',
        background: 'var(--bg-panel)',
        borderLeft: '1px solid var(--border)',
      }}
    >
      {content}
    </div>
  );
}
