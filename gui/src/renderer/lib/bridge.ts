import { useEffect, useRef } from 'react';
import { useChat } from '../store/chat';
import { useSessions } from '../store/sessions';

export function useBridgeWiring(): void {
  const setStatus = useChat((s) => s.setStatus);
  const setActiveSessionId = useChat((s) => s.setActiveSessionId);
  const ingest = useChat((s) => s.ingestFrame);
  const pushError = useChat((s) => s.pushError);
  useEffect(() => {
    if (!window.bridge) return; // not running inside Electron (e.g. browser dev preview)
    const offS = window.bridge.onStatus(async (s) => {
      setStatus(s);
      // When the bridge reports a session_id, set it as the active session.
      // This handles both the initial app startup and session switches.
      if (s.kind === 'running' && s.sessionId) {
        setActiveSessionId(s.sessionId);
      }
      // On app startup (first status event), load messages from JSONL (source of truth).
      // Session switches are handled by switchSession() directly to avoid race conditions.
      if (s.kind === 'running' && (s as any).reloadMessages && s.sessionId) {
        const chat = useChat.getState();
        // Only reload if we haven't already loaded messages (prevents double-load race with switchSession)
        if (chat.messages.length === 0) {
          chat.setFramesBlocked(true);
          chat.resetForNewSession();
          chat.setActiveSessionId(s.sessionId);

          const sessions = useSessions.getState();
          sessions.selectSessionInList(s.sessionId);

          const messages = await window.bridge.loadSessionMessages(s.sessionId);
          chat.setStateForSession(messages as any, s.sessionId);
          chat.setFramesBlocked(false);
        }
      }
    });
    const offF = window.bridge.onFrame((f) => {
      ingest(f);
    });
    const offE = window.bridge.onError((e) => pushError(e.message));

    return () => {
      offS();
      offF();
      offE();
    };
  }, [setStatus, setActiveSessionId, ingest, pushError]);
}

/** Auto-save chat messages to disk when they change for the current session. */
export function useMessagePersistence(): void {
  const messages = useChat((s) => s.messages);
  const currentSession = useSessions((s) => s.currentSession);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (!currentSession?.id || messages.length === 0) return;
    // Only save when message count actually changes (avoids infinite loops from block updates)
    if (messages.length === prevCountRef.current) return;
    prevCountRef.current = messages.length;
    useSessions.getState().persistMessages(currentSession.id, messages);
  }, [messages, currentSession]);
}

/**
 * Create a fresh session: spawn a new Claude process and clear the chat store.
 * The old session's Claude process keeps running — sessions are truly isolated.
 */
export async function restartBridgeForNewSession(): Promise<void> {
  const chat = useChat.getState();
  const sessions = useSessions.getState();

  // Save current session's messages synchronously
  const currentSession = sessions.currentSession;
  if (currentSession?.id) {
    void window.bridge.saveSessionMessages(currentSession.id, chat.messages);
  }

  // Spawn a new Claude process for the new session — returns our stable session UUID
  const sessionId = await window.bridge.createNewSession();

  // Clear chat state and wire to the new session
  chat.resetForNewSession();
  chat.setActiveSessionId(sessionId);
  sessions.clearSessions();
  void sessions.loadSessions();
}

/**
 * Switch to a different session: save current messages, activate the target
 * session's bridge (or spawn a fresh Claude process if it's not running),
 * then load the target session's history.
 */
export async function switchSession(sessionId: string): Promise<void> {
  const chat = useChat.getState();
  const sessions = useSessions.getState();

  // 1. Save current session's messages synchronously
  const currentSession = sessions.currentSession;
  if (currentSession?.id) {
    void window.bridge.saveSessionMessages(currentSession.id, chat.messages);
  }

  // 2. Ensure the side panel stays open during session switch
  const ui = (await import('../store/ui')).useUi.getState();
  if (!ui.sidePanelOpen) ui.setSidePanelOpen(true);

  // 3. Activate the target session's bridge (creates a new Claude process if needed)
  await window.bridge.activateSession(sessionId);

  // 4. Load target session's messages from disk
  const messages = await sessions.loadMessages(sessionId);

  // 5. Update session state and chat messages
  sessions.selectSessionInList(sessionId);
  chat.setStateForSession(messages, sessionId);
}

export function sendUser(text: string): void {
  window.bridge.sendUserMessage(text);
}
