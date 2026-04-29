import { describe, it, expect } from 'vitest';
import { useContextUsage } from '../../src/renderer/store/contextUsage';

describe('useContextUsage', () => {
  it('initializes with null usage and not loading', () => {
    const s = useContextUsage.getState();
    expect(s.usage).toBeNull();
    expect(s.loading).toBe(false);
  });

  it('refresh is async and does not throw', async () => {
    await expect(useContextUsage.getState().refresh()).resolves.toBeUndefined();
  });
});
