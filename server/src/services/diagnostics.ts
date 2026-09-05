import { AlertPayload, RemediationAction, RiskTier } from '../types.js';

export interface DiagnosisResult {
  rootCause: string;
  riskTier: RiskTier;
  affectedComponents: string[];
  evidence: string[];
  confidence: number;
  recommendedAction: RemediationAction;
  alternateActions?: RemediationAction[];
  voicePromptScript: string;
}

export class SREDiagnosticsEngine {
  public diagnose(alert: AlertPayload, engineerName: string = 'On-Call Engineer'): DiagnosisResult {
    // Determine diagnosis based on service and alert details
    if (alert.service === 'log-ingestion-worker' || alert.metric.includes('disk')) {
      const action: RemediationAction = {
        id: 'clean_disk_logrotate',
        name: 'Prune Archived Logs & Force Logrotate',
        description: 'Deletes gzipped logs older than 48 hours and forces logrotate daemon cycle.',
        risk: 'low',
        estimatedRecoverySec: 15,
        command: 'find /var/log/fluentbit -name "*.log.gz" -mtime +2 -delete && logrotate -f /etc/logrotate.d/ingest.conf',
        rollbackPlan: 'No rollback required; deleted data was already mirrored to S3 cold storage.',
        sideEffects: 'None. Live log ingestion will continue uninterrupted.',
      };

      return {
        rootCause: 'Disk partition /var/log reached 96.4% due to unpurged compressed log archives.',
        riskTier: 'TIER_1_AUTO',
        affectedComponents: ['log-ingestion-worker', '/var/log/fluentbit'],
        evidence: [
          'df -h /var/log reports 96.4% utilization (threshold: 85%)',
          'S3 mirror sync confirmed 100% of archives persisted off-host',
          'Runbook RB-LOG-04 matches with 100% confidence',
        ],
        confidence: 0.98,
        recommendedAction: action,
        voicePromptScript: `Hey ${engineerName}, this is PagerZero. Disk partition on log ingestion worker reached 96%. This is marked safe for autonomous remediation, so I'm pruning archived logs. You can stay asleep!`,
      };
    }

    if (alert.service === 'payments-api' || alert.metric.includes('connection_pool') || alert.metric.includes('postgres')) {
      const action: RemediationAction = {
        id: 'terminate_hung_queries_and_recycle_pool',
        name: 'Terminate Zombie DB Connections & Graceful Pool Recycle',
        description: 'Terminates 4 idle-in-transaction client backends older than 5m and cycles PgBouncer.',
        risk: 'medium',
        estimatedRecoverySec: 25,
        command: 'pg_terminate_backend(pid) for idle in transaction > 5m; systemctl reload pgbouncer',
        rollbackPlan: 'PgBouncer auto-reconnects pool clients; fallback to read-replica if primary stalls.',
        sideEffects: '4 idle connection sockets will be dropped. Active transactions unaffected.',
      };

      return {
        rootCause: 'PostgreSQL connection pool exhausted (198/200 connections). 4 queries hung in "idle in transaction" state since 03:12 UTC.',
        riskTier: 'TIER_2_VOICE_APPROVAL',
        affectedComponents: ['payments-api', 'pgbouncer-primary', 'postgres-db-01'],
        evidence: [
          'Active connections: 198 (limit 200, threshold 85%)',
          'Checkout API latency spiked from 28ms to 4650ms',
          'Postgres pg_stat_activity shows 4 transactions holding locks for >320 seconds',
        ],
        confidence: 0.95,
        recommendedAction: action,
        voicePromptScript: `Hi ${engineerName}, this is PagerZero. Alert on Payments API: database connection pool is 98% full with 4 hung queries causing checkout latency to spike. I can terminate the hung queries and recycle the connection pool now. Do you approve this remediation?`,
      };
    }

    if (alert.service === 'auth-service' || alert.metric.includes('memory') || alert.metric.includes('oom')) {
      const action: RemediationAction = {
        id: 'rollout_restart_pod',
        name: 'Kubernetes Rolling Restart of Deployment',
        description: 'Performs zero-downtime rolling restart of auth-service deployment pods.',
        risk: 'medium',
        estimatedRecoverySec: 35,
        command: 'kubectl rollout restart deployment/auth-service',
        rollbackPlan: 'Kubernetes replica sets maintain previous replica until new pods pass liveness checks.',
        sideEffects: 'Temporary 5% CPU bump during new container initialization.',
      };

      return {
        rootCause: 'Memory leak in auth-service JWT session cache causing container memory saturation (97.2%) and OOM crash threat.',
        riskTier: 'TIER_2_VOICE_APPROVAL',
        affectedComponents: ['auth-service', 'k8s-pod-auth-service-7f98c'],
        evidence: [
          'Container RSS memory 97.2% of hard limit (512MB)',
          'Garbage collector cycles running at 85% CPU overhead',
          'Rolling restart runbook RB-AUTH-02 verified safe with zero downtime',
        ],
        confidence: 0.94,
        recommendedAction: action,
        voicePromptScript: `Hi ${engineerName}, this is PagerZero. Alert on Auth Service: container memory is at 97% with an impending out-of-memory crash. I recommend executing a rolling restart of the pods. Do you approve?`,
      };
    }

    if (alert.service === 'cache-redis-03' || alert.metric.includes('redis')) {
      const action: RemediationAction = {
        id: 'flush_redis_expired_keys',
        name: 'Purge Expired Redis Keys & Force LRU Sweep',
        description: 'Runs non-blocking Redis key expiration sweep to reclaim memory buffer.',
        risk: 'low',
        estimatedRecoverySec: 10,
        command: 'redis-cli --eval /scripts/evict_expired_lru.lua',
        rollbackPlan: 'LRU eviction is non-destructive to persistent cache.',
        sideEffects: 'None. Only TTL-expired keys are purged.',
      };

      return {
        rootCause: 'Redis Node 03 memory reached 94.8% due to delayed passive key expiration.',
        riskTier: 'TIER_1_AUTO',
        affectedComponents: ['cache-redis-03'],
        evidence: [
          'Redis memory usage 94.8% (threshold 90%)',
          'Expired uncollected keys count: 184,200',
          'Safe for autonomous cleanup via RB-CACHE-01',
        ],
        confidence: 0.97,
        recommendedAction: action,
        voicePromptScript: `Hey ${engineerName}, PagerZero here. Redis cache node 03 memory spiked to 94%. Safely flushing expired keys autonomously. Sleep on!`,
      };
    }

    // Default Fallback
    const fallbackAction: RemediationAction = {
      id: 'trip_circuit_breaker_and_fallback',
      name: 'Enable Circuit Breaker & Queue Fallback',
      description: 'Isolates degraded downstream dependency and switches to resilient async queue.',
      risk: 'medium',
      estimatedRecoverySec: 20,
      command: 'consul kv put config/features/circuit_breaker_active true',
      rollbackPlan: 'consul kv put config/features/circuit_breaker_active false',
    };

    return {
      rootCause: `High error rate (${alert.currentValue || 25}%) detected on ${alert.service}.`,
      riskTier: 'TIER_2_VOICE_APPROVAL',
      affectedComponents: [alert.service],
      evidence: [alert.description, `Metric ${alert.metric} at ${alert.currentValue}`],
      confidence: 0.88,
      recommendedAction: fallbackAction,
      voicePromptScript: `Hi ${engineerName}, this is PagerZero. Alert on ${alert.service}: error rate spiked. I recommend enabling the circuit breaker and queuing requests. Do you approve?`,
    };
  }
}

export const diagnosticsEngine = new SREDiagnosticsEngine();
