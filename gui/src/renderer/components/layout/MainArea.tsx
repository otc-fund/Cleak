import React from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useUi } from '../../store/ui';
import { ChatView } from '../ChatView';
import { MessageInput } from '../MessageInput';

export function MainArea(): React.ReactElement {
  const { activeMainTab, setMainTab } = useUi();
  return (
    <Tabs.Root
      value={activeMainTab}
      onValueChange={(v) => setMainTab(v as 'chat' | 'editor' | 'terminal')}
      className="flex flex-col flex-1 min-w-0"
    >
      <Tabs.List
        className="flex shrink-0 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-panel)' }}
      >
        {(['chat'] as const).map((tab) => (
          <Tabs.Trigger
            key={tab}
            value={tab}
            className="px-4 py-1.5 text-xs capitalize text-muted border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:text-primary transition-colors hover:text-primary"
          >
            {tab}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      <Tabs.Content value="chat" className="flex flex-col flex-1 min-h-0">
        <ChatView />
        <MessageInput />
      </Tabs.Content>
    </Tabs.Root>
  );
}
