import { describe, it, expect, beforeEach } from 'vitest';
import { diagnosticsEngine } from '../src/services/diagnostics.js';
import { clusterSimulator } from '../src/services/cluster.js';
import { incidentManager } from '../src/services/incidents.js';
import { AlertPayload } from '../src/types.js';

describe('PagerZero Core Logic', () => {
  describe('SRE Diagnostics & Risk Tiering', () => {
    it('categorizes disk full on ingestion worker as TIER_1_AUTO', () => {
      const alert: AlertPayload = {
        id: 'test-disk-1',
        source: 'alertmanager',
        service: 'log-ingestion-worker',
        severity: 'P2',
        title: 'Disk 96% full',
        description: 'Disk partition is full',
        metric: 'disk_usage_percent',
        currentValue: 96.4,
        thresholdValue: 85,
        timestamp: new Date().toISOString(),
      };

      const diagnosis = diagnosticsEngine.diagnose(alert, 'Adam');
      expect(diagnosis.riskTier).toBe('TIER_1_AUTO');
      expect(diagnosis.recommendedAction.id).toBe('clean_disk_logrotate');
      expect(diagnosis.recommendedAction.risk).toBe('low');
      expect(diagnosis.voicePromptScript).toContain('stay asleep');
    });

    it('categorizes PostgreSQL pool exhaustion on payments-api as TIER_2_VOICE_APPROVAL', () => {
      const alert: AlertPayload = {
        id: 'test-db-1',
        source: 'datadog',
        service: 'payments-api',
        severity: 'P1',
        title: 'Postgres Connection Pool Saturated',
        description: 'Pool exhausted',
        metric: 'db_connection_pool_active',
        currentValue: 198,
        thresholdValue: 170,
        timestamp: new Date().toISOString(),
      };

      const diagnosis = diagnosticsEngine.diagnose(alert, 'Adam');
      expect(diagnosis.riskTier).toBe('TIER_2_VOICE_APPROVAL');
      expect(diagnosis.recommendedAction.id).toBe('terminate_hung_queries_and_recycle_pool');
      expect(diagnosis.recommendedAction.risk).toBe('medium');
      expect(diagnosis.voicePromptScript).toContain('Do you approve this remediation?');
    });
  });

  describe('Cluster Simulation & Remediation Actions', () => {
    it('injects fault and remediates disk space successfully', async () => {
      clusterSimulator.injectFault('log-ingestion-worker', 'disk_full');
      const degraded = clusterSimulator.getService('log-ingestion-worker');
      expect(degraded?.status).toBe('critical');
      expect(degraded?.diskUsagePercent).toBeGreaterThan(90);

      const result = await clusterSimulator.executeRemediation('clean_disk_logrotate', 'log-ingestion-worker');
      expect(result.success).toBe(true);

      const recovered = clusterSimulator.getService('log-ingestion-worker');
      expect(recovered?.status).toBe('healthy');
      expect(recovered?.diskUsagePercent).toBeLessThan(35);
    });

    it('recovers payments-api latency when pool is recycled', async () => {
      clusterSimulator.injectFault('payments-api', 'db_pool_exhaustion');
      const degraded = clusterSimulator.getService('payments-api');
      expect(degraded?.status).toBe('critical');
      expect(degraded?.latencyMs).toBeGreaterThan(2000);

      const result = await clusterSimulator.executeRemediation(
        'terminate_hung_queries_and_recycle_pool',
        'payments-api'
      );
      expect(result.success).toBe(true);

      const recovered = clusterSimulator.getService('payments-api');
      expect(recovered?.status).toBe('healthy');
      expect(recovered?.latencyMs).toBeLessThan(50);
    });
  });

  describe('Incident Manager Autonomous Lifecycle', () => {
    it('automatically remediates Tier 1 incidents without waking engineer', async () => {
      const alert: AlertPayload = {
        id: 'auto-test-1',
        source: 'chaos_simulator',
        service: 'log-ingestion-worker',
        severity: 'P2',
        title: 'Disk 96% full',
        description: 'Auto-fixable log accumulation',
        metric: 'disk_usage_percent',
        currentValue: 96.4,
        thresholdValue: 85,
        timestamp: new Date().toISOString(),
      };

      const incident = await incidentManager.handleAlert(alert);
      expect(['FIRING', 'INVESTIGATING']).toContain(incident.status);

      // Wait for async processing (diagnostics 1s + remediation 1.2s + verification 1.2s)
      await new Promise(r => setTimeout(r, 4000));

      const updated = incidentManager.getById(incident.id);
      expect(updated?.status).toBe('RESOLVED');
      expect(updated?.riskTier).toBe('TIER_1_AUTO');
      expect(updated?.remediation?.success).toBe(true);
      expect(updated?.postMortem).toContain('Autonomous Resolution');
    }, 10000);

    it('awaits voice approval and resolves upon receiving spoken approval', async () => {
      incidentManager.config.callMode = 'voice_simulator';

      const alert: AlertPayload = {
        id: 'voice-test-1',
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
      
      // Wait for diagnosis and call simulation completion (diagnostics 1s + call turns ~3.5s + remediation 1.2s + verification 1.2s)
      await new Promise(r => setTimeout(r, 7500));

      const updated = incidentManager.getById(incident.id);
      expect(updated?.status).toBe('RESOLVED');
      expect(updated?.riskTier).toBe('TIER_2_VOICE_APPROVAL');
      expect(updated?.voiceCall?.status).toBe('completed');
      expect(updated?.voiceCall?.result?.approvalStatus).toBe('approved');
      expect(updated?.remediation?.success).toBe(true);
      expect(updated?.postMortem).toContain('Voice Approval Call');
    }, 15000);
  });
});
