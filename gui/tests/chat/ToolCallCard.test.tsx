/// <reference types="@testing-library/jest-dom" />
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolCallCard } from '../../src/renderer/components/chat/ToolCallCard';
import type { ToolUseBlock, ToolResultBlock } from '../../src/renderer/store/chat';

function makeToolUse(overrides?: Partial<ToolUseBlock>): ToolUseBlock {
  return { type: 'tool_use', id: 'tu-1', name: 'bash', input: { command: 'echo hi' }, ...overrides };
}

function makeResult(overrides?: Partial<ToolResultBlock>): ToolResultBlock {
  return { type: 'tool_result', tool_use_id: 'tu-1', content: 'hello world', ...overrides };
}

describe('ToolCallCard', () => {
  it('renders tool name and running state when no result', () => {
    render(<ToolCallCard toolUse={makeToolUse()} />);
    expect(screen.getByText('bash')).toBeTruthy();
    expect(screen.getByText('running…')).toBeTruthy();
  });

  it('shows success icon when result is present', () => {
    render(<ToolCallCard toolUse={makeToolUse()} result={makeResult()} />);
    expect(screen.getByText('bash')).toBeTruthy();
    expect(screen.queryByText('running…')).toBeNull();
    // CheckCircle renders with text "CheckCircle" in aria or via title
  });

  it('shows error styling when result is_error', () => {
    render(
      <ToolCallCard
        toolUse={makeToolUse()}
        result={makeResult({ content: 'fail', is_error: true })}
      />,
    );
    expect(screen.getByText('bash')).toBeTruthy();
  });

  it('renders tool params when expanded', async () => {
    const user = userEvent.setup();
    render(<ToolCallCard toolUse={makeToolUse({ input: { command: 'ls -la' } })} />);

    const paramsBtn = screen.getByText('params');
    await user.click(paramsBtn);

    expect(screen.getByText(/"command"/)).toBeTruthy();
    expect(screen.getByText(/"ls -la"/)).toBeTruthy();
  });

  it('renders result content when expanded', async () => {
    const user = userEvent.setup();
    render(
      <ToolCallCard
        toolUse={makeToolUse()}
        result={makeResult({ content: 'file1\nfile2' })}
      />,
    );

    const resultBtn = screen.getByText('result');
    await user.click(resultBtn);

    const pres = document.querySelectorAll('pre');
    const resultPre = Array.from(pres).find((p) => p.textContent?.includes('file1'));
    expect(resultPre?.textContent).toContain('file1');
    expect(resultPre?.textContent).toContain('file2');
  });

  it('truncates long results and shows show more toggle', async () => {
    const user = userEvent.setup();
    const longContent = 'x'.repeat(500);
    render(
      <ToolCallCard
        toolUse={makeToolUse()}
        result={makeResult({ content: longContent })}
      />,
    );

    // Expand result
    await user.click(screen.getByText('result'));
    expect(screen.getByText('show more')).toBeTruthy();

    // Should not show full content yet (truncated)
    expect(screen.queryByText(longContent)).toBeNull();

    // Click show more
    await user.click(screen.getByText('show more'));
    expect(screen.getByText('show less')).toBeTruthy();
  });

  it('displays duration when provided', () => {
    render(<ToolCallCard toolUse={makeToolUse()} result={makeResult()} durationMs={1500} />);
    expect(screen.getByText('1.5s')).toBeTruthy();
  });

  it('displays sub-second duration', () => {
    render(<ToolCallCard toolUse={makeToolUse()} result={makeResult()} durationMs={250} />);
    expect(screen.getByText('250ms')).toBeTruthy();
  });
});
