import React, { useCallback } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { useEditor } from '../../store/editor';
import { EditorTab } from './EditorTab';
import { useUi } from '../../store/ui';

export function EditorArea(): React.ReactElement {
  const { tabs, activeTab, closeTab, setContent, saveTab, discardTab } = useEditor();
  const { theme } = useUi();
  const monacoTheme = theme === 'light' ? 'vs' : 'vs-dark';

  const activeTabData = tabs.find(t => t.path === activeTab);

  const handleMount: OnMount = (editor, monaco) => {
    // Ctrl+S to save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeTab) void saveTab(activeTab);
    });
  };

  if (tabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm">
        Open a file from the file panel
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab strip */}
      <div className="flex border-b border-border overflow-x-auto shrink-0 bg-surface/50">
        {tabs.map(t => (
          <EditorTab
            key={t.path}
            path={t.path}
            isDirty={t.content !== t.savedContent}
            isActive={t.path === activeTab}
            onSelect={() => useEditor.setState({ activeTab: t.path })}
            onClose={() => {
              if (t.content !== t.savedContent) {
                if (!confirm(`Discard changes to ${t.path.split(/[\\/]/).pop()}?`)) return;
              }
              closeTab(t.path);
            }}
          />
        ))}
      </div>

      {/* Editor */}
      {activeTabData && (
        <div className="flex-1 min-h-0">
          <Editor
            path={activeTabData.path}
            value={activeTabData.content}
            language={activeTabData.language}
            theme={monacoTheme}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              tabSize: 2,
            }}
            onChange={v => { if (v != null) setContent(activeTabData.path, v); }}
            onMount={handleMount}
          />
        </div>
      )}
    </div>
  );
}
