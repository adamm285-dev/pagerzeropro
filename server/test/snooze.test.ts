import { describe, it, expect } from 'vitest';
import { parseSnoozeMs, formatSnooze } from '../src/services/snooze.js';

describe('snooze parse', () => {
  it('defaults give-me-five-minutes to 5 minutes', () => {
    expect(parseSnoozeMs('Give me 5 minutes')).toBe(5 * 60 * 1000);
    expect(parseSnoozeMs('snooze')).toBe(5 * 60 * 1000);
    expect(formatSnooze(5 * 60 * 1000)).toBe('5m');
  });

  it('parses seconds for tests and short holds', () => {
    expect(parseSnoozeMs('call back in 30 seconds')).toBe(30_000);
  });

  it('ignores unrelated speech', () => {
    expect(parseSnoozeMs("what's the error rate")).toBeNull();
  });
});
