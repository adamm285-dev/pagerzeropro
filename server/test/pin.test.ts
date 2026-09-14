import { describe, it, expect, beforeEach } from 'vitest';
import { calleService } from '../src/services/calle.js';
import { incidentManager } from '../src/services/incidents.js';
import { AlertPayload } from '../src/types.js';

describe('Voice Security PIN Authorization', () => {
  beforeEach(() => {
    incidentManager.updateConfig({
      securityPin: '4321',
      requirePin: true,
      callMode: 'voice_simulator',
    });
  });

  it('simulateCall includes security PIN prompt and verification', async () => {
    const result = await calleService.simulateCall(
      'Adam',
      'Database connection pool saturated.',
      'Recycle PostgreSQL pool',
      '4321',
      true
    );

    expect(result.pinVerified).toBe(true);
    expect(result.spokenPin).toBe('4321');
    expect(result.approvalStatus).toBe('approved');
    expect(result.transcript[0].text).toContain('4321');
    expect(result.transcript[1].text).toContain('4321');
    expect(result.transcript[2].text).toContain('4321');
  });

  it('approves when matching PIN is provided in submitVoiceDecision', async () => {
    const alert: AlertPayload = {
      id: 'pin-auth-ok-1',
      source: 'chaos_simulator',
      service: 'payments-api',
      severity: 'P1',
      title: 'DB Pool Saturated',
      description: 'Hung connections',
      metric: 'db_connection_pool_active',
      currentValue: 198,
      thresholdValue: 170,
      timestamp: new Date().toISOString(),
    };

    const incident = await incidentManager.handleAlert(alert);

    let updated = incidentManager.getById(incident.id);
    for (let i = 0; i < 25 && updated?.status !== 'AWAITING_VOICE_APPROVAL'; i++) {
      await new Promise((r) => setTimeout(r, 200));
      updated = incidentManager.getById(incident.id);
    }
    expect(updated?.status).toBe('AWAITING_VOICE_APPROVAL');

    // Submit with correct PIN
    await incidentManager.submitVoiceDecision(
      incident.id,
      'approved',
      'Approved: Execute remediation',
      undefined,
      '4321'
    );

    for (let i = 0; i < 30 && updated?.status !== 'RESOLVED'; i++) {
      await new Promise((r) => setTimeout(r, 200));
      updated = incidentManager.getById(incident.id);
    }

    expect(updated?.status).toBe('RESOLVED');
    expect(updated?.voiceCall?.result?.pinVerified).toBe(true);
    expect(updated?.voiceCall?.result?.spokenPin).toBe('4321');
  }, 15000);

  it('escalates when wrong PIN is provided', async () => {
    const alert: AlertPayload = {
      id: 'pin-auth-bad-1',
      source: 'chaos_simulator',
      service: 'payments-api',
      severity: 'P1',
      title: 'DB Pool Saturated',
      description: 'Hung connections',
      metric: 'db_connection_pool_active',
      currentValue: 198,
      thresholdValue: 170,
      timestamp: new Date().toISOString(),
    };

    const incident = await incidentManager.handleAlert(alert);

    let updated = incidentManager.getById(incident.id);
    for (let i = 0; i < 25 && updated?.status !== 'AWAITING_VOICE_APPROVAL'; i++) {
      await new Promise((r) => setTimeout(r, 200));
      updated = incidentManager.getById(incident.id);
    }
    expect(updated?.status).toBe('AWAITING_VOICE_APPROVAL');

    // Submit with WRONG PIN
    await incidentManager.submitVoiceDecision(
      incident.id,
      'approved',
      'Approved: Execute fix',
      undefined,
      '0000'
    );

    for (let i = 0; i < 20 && updated?.status !== 'ESCALATED'; i++) {
      await new Promise((r) => setTimeout(r, 200));
      updated = incidentManager.getById(incident.id);
    }

    expect(updated?.status).toBe('ESCALATED');
    expect(updated?.voiceCall?.result?.pinVerified).toBe(false);
    expect(updated?.remediation).toBeUndefined();
  }, 15000);

  it('rejects spoken approval when engineer says approved without the PIN', async () => {
    const alert: AlertPayload = {
      id: 'pin-missing-speech',
      source: 'chaos_simulator',
      service: 'payments-api',
      severity: 'P1',
      title: 'DB Pool Saturated',
      description: 'Hung connections',
      metric: 'db_connection_pool_active',
      currentValue: 198,
      thresholdValue: 170,
      timestamp: new Date().toISOString(),
    };

    const incident = await incidentManager.handleAlert(alert);

    let updated = incidentManager.getById(incident.id);
    for (let i = 0; i < 25 && updated?.status !== 'AWAITING_VOICE_APPROVAL'; i++) {
      await new Promise((r) => setTimeout(r, 200));
      updated = incidentManager.getById(incident.id);
    }
    expect(updated?.status).toBe('AWAITING_VOICE_APPROVAL');

    // Submit with NO PIN provided and text that doesn't contain PIN
    await incidentManager.submitVoiceDecision(
      incident.id,
      'approved',
      'approved go ahead',
      undefined,
      undefined
    );

    for (let i = 0; i < 20 && updated?.status !== 'ESCALATED'; i++) {
      await new Promise((r) => setTimeout(r, 200));
      updated = incidentManager.getById(incident.id);
    }

    expect(updated?.status).toBe('ESCALATED');
    expect(updated?.voiceCall?.result?.pinVerified).toBe(false);
    expect(updated?.remediation).toBeUndefined();
  }, 15000);

  it('accepts spoken approval when engineer speaks PIN as digits or number words', async () => {
    const alert: AlertPayload = {
      id: 'pin-spoken-words',
      source: 'chaos_simulator',
      service: 'payments-api',
      severity: 'P1',
      title: 'DB Pool Saturated',
      description: 'Hung connections',
      metric: 'db_connection_pool_active',
      currentValue: 198,
      thresholdValue: 170,
      timestamp: new Date().toISOString(),
    };

    const incident = await incidentManager.handleAlert(alert);

    let updated = incidentManager.getById(incident.id);
    for (let i = 0; i < 25 && updated?.status !== 'AWAITING_VOICE_APPROVAL'; i++) {
      await new Promise((r) => setTimeout(r, 200));
      updated = incidentManager.getById(incident.id);
    }
    expect(updated?.status).toBe('AWAITING_VOICE_APPROVAL');

    // Spoken PIN as words: "four three two one"
    await incidentManager.submitVoiceDecision(
      incident.id,
      'approved',
      'Yes I approve four three two one',
      undefined,
      undefined
    );

    for (let i = 0; i < 30 && updated?.status !== 'RESOLVED'; i++) {
      await new Promise((r) => setTimeout(r, 200));
      updated = incidentManager.getById(incident.id);
    }

    expect(updated?.status).toBe('RESOLVED');
    expect(updated?.voiceCall?.result?.pinVerified).toBe(true);
    expect(updated?.voiceCall?.result?.spokenPin).toBe('4321');
  }, 15000);
});

