import { RiskTier } from '../types.js';

export type AutonomyGate = 'auto' | 'voice' | 'escalate';

export const DEFAULT_SERVICE_GATES: Record<string, AutonomyGate> = {
  'log-ingestion-worker': 'auto',
  'cache-redis-03': 'auto',
  'auth-service': 'voice',
  'payments-api': 'voice',
  'checkout-gateway': 'voice',
};

export function resolveAutonomyPath(
  diagnosed: RiskTier,
  gate: AutonomyGate | undefined,
  autoApproveTier1: boolean
): 'auto' | 'voice' | 'escalate' {
  const g = gate || 'auto';
  if (diagnosed === 'TIER_3_ESCALATE' || g === 'escalate') return 'escalate';
  if (g === 'voice') return 'voice';
  if (diagnosed === 'TIER_1_AUTO' && autoApproveTier1) return 'auto';
  return 'voice';
}
