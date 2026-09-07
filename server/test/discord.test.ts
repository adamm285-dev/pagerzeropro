import { describe, it, expect } from 'vitest';
import { isDiscordWebhookUrl, discordNotifier } from '../src/services/discord.js';
import { Incident } from '../src/types.js';

describe('Discord webhook', () => {
  it('accepts discord.com and discordapp.com webhook URLs', () => {
    expect(
      isDiscordWebhookUrl('https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz012345')
    ).toBe(true);
    expect(
      isDiscordWebhookUrl(
        'https://discordapp.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz012345'
      )
    ).toBe(true);
  });

  it('rejects non-webhook URLs', () => {
    expect(isDiscordWebhookUrl('https://example.com/hooks/1')).toBe(false);
    expect(isDiscordWebhookUrl('')).toBe(false);
  });

  it('builds an embed with diagnosis and call fields', () => {
    const incident = {
      id: 'inc-1',
      alert: {
        id: 'a1',
        source: 'chaos_simulator',
        service: 'payments-api',
        severity: 'P1',
        title: 'Pool saturated',
        description: '198/200',
        metric: 'db_connection_pool_active',
        currentValue: 198,
        thresholdValue: 170,
        timestamp: new Date().toISOString(),
      },
      status: 'AWAITING_VOICE_APPROVAL',
      riskTier: 'TIER_2_VOICE_APPROVAL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      diagnosis: {
        rootCause: 'Pool exhaustion',
        affectedComponents: ['payments-api'],
        evidence: ['198 connections'],
        confidence: 0.9,
        recommendedAction: {
          id: 'recycle',
          name: 'Recycle pool',
          description: 'recycle',
          risk: 'medium',
          estimatedRecoverySec: 20,
          command: 'pgbouncer recycle',
          rollbackPlan: 'none',
        },
        voicePromptScript: 'Approve recycle?',
      },
      timeline: [],
    } as Incident;

    const payload = discordNotifier.buildPayload(incident, 'Calling engineer');
    expect(payload.embeds[0].title).toContain('Pool saturated');
    expect(payload.embeds[0].fields.some((f) => f.name.includes('Remediation'))).toBe(true);
    expect(payload.embeds[0].fields.some((f) => f.name.includes('CALL-E'))).toBe(true);
  });
});
