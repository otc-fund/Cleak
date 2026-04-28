import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { useTerminals } from '../../store/terminals';

interface Props {
  id: string;
  cwd: string;
  isActive: boolean;
}

export function TerminalPane({ id, cwd, isActive }: Props): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const startedRef = useRef(false);
  const fitRef_safe = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (startedRef.current || !containerRef.current) return;
    startedRef.current = true;

    const term = new Terminal({
      theme: {
        background: '#0b0b0b',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
      },
      fontSize: 13,
      fontFamily: '"Cascadia Code", "JetBrains Mono", monospace',
      cursorBlink: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    const safeFit = () => { try { fit.fit(); } catch { /* terminal not ready */ } };
    requestAnimationFrame(safeFit);
    termRef.current = term;
    fitRef.current = fit;
    fitRef_safe.current = safeFit;

    // Subscribe to agent output writes
    const offOutput = useTerminals.getState().onOutput(id, (text) => {
      term.write(text);
    });

    let offData: (() => void) | undefined;
    let offExit: (() => void) | undefined;

    // Spawn pty in main
    void window.bridge.ptyCreate(id, undefined, cwd).then(() => {
      // Data from pty → terminal
      offData = window.bridge.onPtyData((tabId, data) => {
        if (tabId === id) term.write(data);
      });
      // Terminal input → pty
      term.onData(data => window.bridge.ptyInput(id, data));
      // Pty exit
      offExit = window.bridge.onPtyExit((tabId) => {
        if (tabId === id) {
          term.writeln('\r\n[Process exited]');
          useTerminals.getState().markDead(id);
        }
      });
    });

    return () => {
      offOutput();
      offData?.();
      offExit?.();
      window.bridge.ptyKill(id);
      term.dispose();
    };
  }, []);

  // Resize when tab becomes active
  useEffect(() => {
    if (isActive) fitRef_safe.current?.();
  }, [isActive]);

  // ResizeObserver for container size changes
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => fitRef_safe.current?.());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ display: isActive ? 'block' : 'none' }}
    />
  );
}
