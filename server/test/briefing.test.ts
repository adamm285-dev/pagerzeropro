import { describe, it, expect } from 'vitest';
import { answerEngineerQuestion } from '../src/services/briefing.js';
import { Incident } from '../src/types.js';

const incident = {
  id: 'inc-1',
  alert: {
    id: 'a',
    source: 'chaos_simulator',
    service: 'checkout-gateway',
    severity: 'P1',
    title: '502 storm',
    description: 'Upstream 502',
    metric: 'error_rate',
    currentValue: 42,
    thresholdValue: 5,
    timestamp: new Date().toISOString(),
  },
  status: 'AWAITING_VOICE_APPROVAL',
  riskTier: 'TIER_2_VOICE_APPROVAL',
  createdAt: '',
  updatedAt: '',
  diagnosis: {
    rootCause: 'Upstream payment gateway returning 502s',
    affectedComponents: ['checkout-gateway'],
    evidence: ['error rate 42%'],
    confidence: 0.9,
    recommendedAction: {
      id: 'trip',
      name: 'Trip circuit breaker',
      description: 'fail closed to queue',
      risk: 'medium',
      estimatedRecoverySec: 20,
      command: 'cb trip checkout',
      rollbackPlan: 'cb reset',
    },
    voicePromptScript: 'Approve breaker?',
  },
  timeline: [],
} as Incident;

const live = {
  timestamp: new Date().toISOString(),
  cpuPercent: 40,
  memoryPercent: 55,
  latencyMs: 5200,
  errorRatePercent: 14,
  diskUsagePercent: 22,
};

describe('interactive call briefing', () => {
  it('answers error rate from live telemetry', () => {
    const a = answerEngineerQuestion("What's the error rate right now?", incident, live);
    expect(a).toMatch(/14/);
    expect(a.toLowerCase()).toContain('error');
  });

  it('answers recommended fix', () => {
    const a = answerEngineerQuestion('What is the recommended fix?', incident, live);
    expect(a.toLowerCase()).toContain('circuit breaker');
  });
});
