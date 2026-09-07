import { describe, it, expect } from 'vitest';
import { resolveAutonomyPath } from '../src/services/policy.js';

describe('per-service autonomy gates', () => {
  it('keeps Tier 1 auto when gate is auto', () => {
    expect(resolveAutonomyPath('TIER_1_AUTO', 'auto', true)).toBe('auto');
  });

  it('forces voice on production-core even for Tier 1 runbooks', () => {
    expect(resolveAutonomyPath('TIER_1_AUTO', 'voice', true)).toBe('voice');
  });

  it('forces escalate-only regardless of diagnosed tier', () => {
    expect(resolveAutonomyPath('TIER_1_AUTO', 'escalate', true)).toBe('escalate');
    expect(resolveAutonomyPath('TIER_2_VOICE_APPROVAL', 'escalate', true)).toBe('escalate');
  });

  it('never auto-fixes unknown/T3 runbooks', () => {
    expect(resolveAutonomyPath('TIER_3_ESCALATE', 'auto', true)).toBe('escalate');
  });
});
