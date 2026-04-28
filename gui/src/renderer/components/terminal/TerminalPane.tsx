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
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    // Subscribe to agent output writes
    const offOutput = useTerminals.getState().onOutput(id, (text) => {
      term.write(text);
    });

    // Spawn pty in main
    void window.bridge.ptyCreate(id, undefined, cwd).then(() => {
      // Data from pty → terminal
      const offData = window.bridge.onPtyData((tabId, data) => {
        if (tabId === id) term.write(data);
      });
      // Terminal input → pty
      term.onData(data => window.bridge.ptyInput(id, data));
      // Pty exit
      const offExit = window.bridge.onPtyExit((tabId) => {
        if (tabId === id) {
          term.writeln('\r\n[Process exited]');
          useTerminals.getState().markDead(id);
        }
      });
      return () => { offData(); offExit(); };
    });

    return () => {
      offOutput();
      window.bridge.ptyKill(id);
      term.dispose();
    };
  }, []);

  // Resize when tab becomes active
  useEffect(() => {
    if (isActive && fitRef.current) fitRef.current.fit();
  }, [isActive]);

  // ResizeObserver for container size changes
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(() => fitRef.current?.fit());
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
