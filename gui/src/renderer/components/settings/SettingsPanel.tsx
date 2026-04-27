import React, { useState, useEffect } from 'react';
import { useSettings } from '../../store/settings';
import { useUi, type Theme } from '../../store/ui';
import { cn } from '../../lib/cn';

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mb-6">
      <h3 className="text-xs uppercase tracking-widest text-muted mb-3 px-4">{title}</h3>
      <div className="px-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-muted">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded px-2 py-1.5 text-xs bg-base border border-border text-primary focus:outline-none focus:border-accent placeholder-subtle';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'dark',           label: 'Dark'           },
  { value: 'light',          label: 'Light'          },
  { value: 'high-contrast',  label: 'High Contrast'  },
];

export function SettingsPanel(): React.ReactElement {
  const settings = useSettings();
  const { theme: uiTheme, setTheme } = useUi();

  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [model,   setModel]   = useState(settings.model);
  const [apiKey,  setApiKey]  = useState(settings.apiKey);
  const [showKey, setShowKey] = useState(false);
  const [saved,   setSaved]   = useState(false);

  const savedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  // Keep local form in sync when store loads from IPC
  useEffect(() => {
    if (!settings.loaded) return;
    setBaseUrl(settings.baseUrl);
    setModel(settings.model);
    setApiKey(settings.apiKey);
  }, [settings.loaded, settings.baseUrl, settings.model, settings.apiKey]);

  async function handleSave(): Promise<void> {
    await settings.save({ baseUrl, model, apiKey, theme: uiTheme });
    setSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
  }

  function handleThemeChange(t: Theme): void {
    setTheme(t);
    void settings.save({ baseUrl, model, apiKey, theme: t });
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto py-4" style={{ color: 'var(--text-primary)' }}>
      <div className="px-4 mb-4 text-sm font-medium">Settings</div>

      <Section title="API Configuration">
        <Field label="Base URL">
          <input
            className={inputCls}
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:3003/v1"
          />
        </Field>
        <Field label="Model">
          <input
            className={inputCls}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="qwen3.6-plus"
          />
        </Field>
        <Field label="API Key">
          <div className="flex gap-1">
            <input
              type={showKey ? 'text' : 'password'}
              className={cn(inputCls, 'flex-1')}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="pk_…"
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              className="px-2 rounded border border-border text-[10px] text-muted hover:text-primary transition-colors"
            >
              {showKey ? 'hide' : 'show'}
            </button>
          </div>
          <p className="text-[10px] text-muted mt-1">
            Stored encrypted via OS keychain. Never written as plaintext.
          </p>
        </Field>
        <button
          onClick={() => void handleSave()}
          className="w-full py-1.5 rounded bg-accent text-accent-fg text-xs font-medium hover:opacity-90 transition-opacity"
        >
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </Section>

      <Section title="Appearance">
        <Field label="Theme">
          <div className="flex gap-2">
            {THEMES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleThemeChange(value)}
                className={cn(
                  'flex-1 py-1 rounded border text-xs transition-colors',
                  uiTheme === value
                    ? 'border-accent text-primary bg-active'
                    : 'border-border text-muted hover:border-accent hover:text-primary',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="About">
        <p className="text-[11px] text-muted">
          Cleak GUI — Sprint 2<br />
          SDK backend: claude.exe (Claude Code CLI)
        </p>
      </Section>
    </div>
  );
}
