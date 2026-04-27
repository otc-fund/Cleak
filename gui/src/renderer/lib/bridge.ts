import { useEffect } from 'react';
import { useChat } from '../store/chat';

export function useBridgeWiring(): void {
  const setStatus = useChat((s) => s.setStatus);
  const ingest = useChat((s) => s.ingestFrame);
  const pushError = useChat((s) => s.pushError);
  useEffect(() => {
    const offS = window.bridge.onStatus(setStatus);
    const offF = window.bridge.onFrame(ingest);
    const offE = window.bridge.onError((e) => pushError(e.message));
    return () => {
      offS();
      offF();
      offE();
    };
  }, [setStatus, ingest, pushError]);
}

export function sendUser(text: string): void {
  window.bridge.sendUserMessage(text);
}
