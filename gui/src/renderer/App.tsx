import React from 'react';
import { ChatView } from './components/ChatView';
import { MessageInput } from './components/MessageInput';
import { StatusBar } from './components/StatusBar';
import { useBridgeWiring } from './lib/bridge';

export default function App(): React.ReactElement {
  useBridgeWiring();
  return (
    <div className="flex flex-col h-full">
      <ChatView />
      <MessageInput />
      <StatusBar />
    </div>
  );
}
