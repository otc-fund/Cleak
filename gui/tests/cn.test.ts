import { describe, expect, it } from 'vitest';
import { cn } from '../src/renderer/lib/cn';

describe('cn', () => {
  it('merges class strings', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('resolves tailwind conflicts (last wins)', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });

  it('strips falsy values', () => {
    expect(cn('a', false, undefined, 'b')).toBe('a b');
  });
});
