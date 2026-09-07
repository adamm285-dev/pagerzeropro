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
      expect(diagnosis.voicePromptScript).toContain('No action needed from you');
    });

    it('categorizes Redis memory saturation as TIER_1_AUTO flush, not auth rolling restart', () => {
      const alert: AlertPayload = {
        id: 'test-redis-1',
        source: 'chaos_simulator',
        service: 'cache-redis-03',
        severity: 'P3',
        title: 'Redis Node 03 Memory Above 94%',
        description: 'Memory at 94.8%',
        metric: 'redis_memory_percent',
        currentValue: 94.8,
        thresholdValue: 90,
        timestamp: new Date().toISOString(),
      };

      const diagnosis = diagnosticsEngine.diagnose(alert, 'Adam');
      expect(diagnosis.riskTier).toBe('TIER_1_AUTO');
      expect(diagnosis.recommendedAction.id).toBe('flush_redis_expired_keys');
    });

    it('escalates unknown services without a runbook', () => {
      const alert: AlertPayload = {
        id: 'test-unknown-1',
        source: 'datadog',
        service: 'mystery-batch',
        severity: 'P1',
        title: 'Unknown failure',
        description: 'No runbook',
        metric: 'custom_gauge',
        currentValue: 1,
        thresholdValue: 0,
        timestamp: new Date().toISOString(),
      };

      const diagnosis = diagnosticsEngine.diagnose(alert, 'Adam');
      expect(diagnosis.riskTier).toBe('TIER_3_ESCALATE');
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

      // diagnostics 1s + remediation 1.2s + health poll ~2.5s
      await new Promise(r => setTimeout(r, 9000));

      const updated = incidentManager.getById(incident.id);
      expect(updated?.status).toBe('RESOLVED');
      expect(updated?.riskTier).toBe('TIER_1_AUTO');
      expect(updated?.remediation?.success).toBe(true);
      expect(updated?.postMortem).toContain('Autonomous Resolution');
    }, 15000);

    it('shadow mode resolves without mutating cluster health', async () => {
      incidentManager.config.shadowMode = true;
      clusterSimulator.resetHealthy();
      clusterSimulator.injectFault('log-ingestion-worker', 'disk_full');
      const before = clusterSimulator.getService('log-ingestion-worker');
      expect(before?.diskUsagePercent).toBeGreaterThan(90);

      const alert: AlertPayload = {
        id: 'shadow-test-1',
        source: 'chaos_simulator',
        service: 'log-ingestion-worker',
        severity: 'P2',
        title: 'Disk 96% full',
        description: 'Shadow dry-run',
        metric: 'disk_usage_percent',
        currentValue: 96.4,
        thresholdValue: 85,
        timestamp: new Date().toISOString(),
      };

      const incident = await incidentManager.handleAlert(alert);
      await new Promise((r) => setTimeout(r, 2500));
      const updated = incidentManager.getById(incident.id);
      const after = clusterSimulator.getService('log-ingestion-worker');

      expect(updated?.status).toBe('RESOLVED');
      expect(updated?.remediation?.logs.some((l) => l.includes('SHADOW'))).toBe(true);
      expect(after?.diskUsagePercent).toBeGreaterThan(90);
      incidentManager.config.shadowMode = false;
    }, 10000);

    it('voice gate on a Tier 1 service requires approval instead of auto-fix', async () => {
      incidentManager.config.shadowMode = false;
      incidentManager.config.autoApproveTier1 = true;
      incidentManager.config.serviceGates['log-ingestion-worker'] = 'voice';
      incidentManager.config.callMode = 'voice_simulator';

      const alert: AlertPayload = {
        id: 'gate-voice-1',
        source: 'chaos_simulator',
        service: 'log-ingestion-worker',
        severity: 'P2',
        title: 'Disk 96% full',
        description: 'Would auto-fix without gate',
        metric: 'disk_usage_percent',
        currentValue: 96.4,
        thresholdValue: 85,
        timestamp: new Date().toISOString(),
      };

      const incident = await incidentManager.handleAlert(alert);
      await new Promise((r) => setTimeout(r, 1500));
      const updated = incidentManager.getById(incident.id);
      expect(updated?.status).toBe('AWAITING_VOICE_APPROVAL');
      incidentManager.config.serviceGates['log-ingestion-worker'] = 'auto';
    }, 8000);

    it('rolls back and escalates when health worsens after a fix', async () => {
      incidentManager.config.shadowMode = false;
      clusterSimulator.failNextHealthCheck('log-ingestion-worker');

      const alert: AlertPayload = {
        id: 'rollback-test-1',
        source: 'chaos_simulator',
        service: 'log-ingestion-worker',
        severity: 'P2',
        title: 'Disk 96% full',
        description: 'Fix will fail canary',
        metric: 'disk_usage_percent',
        currentValue: 96.4,
        thresholdValue: 85,
        timestamp: new Date().toISOString(),
      };

      const incident = await incidentManager.handleAlert(alert);
      await new Promise((r) => setTimeout(r, 7000));
      const updated = incidentManager.getById(incident.id);
      expect(updated?.status).toBe('ESCALATED');
      expect(updated?.remediation?.success).toBe(false);
      expect(updated?.remediation?.logs.some((l) => l.includes('ROLLBACK'))).toBe(true);
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

      let updated = incidentManager.getById(incident.id);
      for (let i = 0; i < 25 && updated?.status !== 'AWAITING_VOICE_APPROVAL'; i++) {
        await new Promise((r) => setTimeout(r, 200));
        updated = incidentManager.getById(incident.id);
      }
      expect(updated?.status).toBe('AWAITING_VOICE_APPROVAL');

      await incidentManager.submitVoiceDecision(
        incident.id,
        'approved',
        'Yeah, I approve. Recycle the pool.'
      );

      for (let i = 0; i < 30 && updated?.status !== 'RESOLVED'; i++) {
        await new Promise((r) => setTimeout(r, 200));
        updated = incidentManager.getById(incident.id);
      }

      expect(updated?.status).toBe('RESOLVED');
      expect(updated?.riskTier).toBe('TIER_2_VOICE_APPROVAL');
      expect(updated?.voiceCall?.status).toBe('completed');
      expect(updated?.voiceCall?.result?.approvalStatus).toBe('approved');
      expect(updated?.remediation?.success).toBe(true);
      expect(updated?.postMortem).toContain('Voice Approval Call');
    }, 15000);
  });
});
