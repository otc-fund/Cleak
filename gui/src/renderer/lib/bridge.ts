import { useEffect } from 'react';
import { useChat } from '../store/chat';

export function useBridgeWiring(): void {
  const setStatus = useChat((s) => s.setStatus);
  const ingest = useChat((s) => s.ingestFrame);
  const pushError = useChat((s) => s.pushError);
  useEffect(() => {
    if (!window.bridge) return; // not running inside Electron (e.g. browser dev preview)
    const offS = window.bridge.onStatus(setStatus);
    const offF = window.bridge.onFrame((f) => {
      ingest(f);
    });
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
