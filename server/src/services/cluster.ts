import { ServiceHealth, MetricSnapshot } from '../types.js';

class ClusterSimulator {
  private services: Map<string, ServiceHealth> = new Map();
  private metricHistory: Map<string, MetricSnapshot[]> = new Map();

  constructor() {
    this.initServices();
    // Start background telemetry tick every 2 seconds
    setInterval(() => this.tick(), 2000);
  }

  private initServices() {
    const initialServices: ServiceHealth[] = [
      {
        id: 'auth-service',
        name: 'Auth Service (Go)',
        status: 'healthy',
        cpuPercent: 18,
        memoryPercent: 32,
        latencyMs: 14,
        errorRatePercent: 0.05,
        replicaCount: 3,
        lastRestartAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
      {
        id: 'payments-api',
        name: 'Payments API (Node/Postgres)',
        status: 'healthy',
        cpuPercent: 24,
        memoryPercent: 44,
        latencyMs: 28,
        errorRatePercent: 0.1,
        replicaCount: 4,
        activeConnections: 35,
        lastRestartAt: new Date(Date.now() - 3600000 * 48).toISOString(),
      },
      {
        id: 'cache-redis-03',
        name: 'Redis Cluster (Node 03)',
        status: 'healthy',
        cpuPercent: 12,
        memoryPercent: 48,
        latencyMs: 1.8,
        errorRatePercent: 0.0,
        replicaCount: 3,
        lastRestartAt: new Date(Date.now() - 3600000 * 72).toISOString(),
      },
      {
        id: 'log-ingestion-worker',
        name: 'Log Ingestion Worker',
        status: 'healthy',
        cpuPercent: 28,
        memoryPercent: 39,
        latencyMs: 8,
        errorRatePercent: 0.0,
        replicaCount: 2,
        diskUsagePercent: 42,
        lastRestartAt: new Date(Date.now() - 3600000 * 12).toISOString(),
      },
      {
        id: 'checkout-gateway',
        name: 'Checkout Gateway (Ingress)',
        status: 'healthy',
        cpuPercent: 22,
        memoryPercent: 36,
        latencyMs: 35,
        errorRatePercent: 0.08,
        replicaCount: 5,
        lastRestartAt: new Date(Date.now() - 3600000 * 30).toISOString(),
      }
    ];

    for (const s of initialServices) {
      this.services.set(s.id, s);
      this.metricHistory.set(s.id, []);
    }
  }

  private tick() {
    // Add minor natural jitter and record snapshot
    for (const [id, s] of this.services.entries()) {
      if (s.status === 'healthy') {
        const jitter = (Math.random() - 0.5) * 2;
        s.cpuPercent = Math.max(5, Math.min(60, Math.round(s.cpuPercent + jitter)));
        s.latencyMs = Math.max(1, Math.round(s.latencyMs + (Math.random() - 0.5) * 1.5));
      }

      const snapshot: MetricSnapshot = {
        timestamp: new Date().toISOString(),
        cpuPercent: s.cpuPercent,
        memoryPercent: s.memoryPercent,
        latencyMs: s.latencyMs,
        errorRatePercent: s.errorRatePercent,
        diskUsagePercent: s.diskUsagePercent,
        activeConnections: s.activeConnections,
      };

      const history = this.metricHistory.get(id) || [];
      history.push(snapshot);
      if (history.length > 60) {
        history.shift(); // Keep last 60 points (~2 mins)
      }
      this.metricHistory.set(id, history);
    }
  }

  public getAllServices(): ServiceHealth[] {
    return Array.from(this.services.values());
  }

  public getService(id: string): ServiceHealth | undefined {
    return this.services.get(id);
  }

  public getServiceMetrics(id: string): MetricSnapshot[] {
    return this.metricHistory.get(id) || [];
  }

  public getSnapshot(id: string): MetricSnapshot {
    const s = this.services.get(id);
    if (!s) {
      return {
        timestamp: new Date().toISOString(),
        cpuPercent: 0,
        memoryPercent: 0,
        latencyMs: 0,
        errorRatePercent: 0,
      };
    }
    return {
      timestamp: new Date().toISOString(),
      cpuPercent: s.cpuPercent,
      memoryPercent: s.memoryPercent,
      latencyMs: s.latencyMs,
      errorRatePercent: s.errorRatePercent,
      diskUsagePercent: s.diskUsagePercent,
      activeConnections: s.activeConnections,
    };
  }

  // Chaos triggers
  public injectFault(serviceId: string, faultType: string): ServiceHealth {
    const s = this.services.get(serviceId);
    if (!s) throw new Error(`Service ${serviceId} not found`);

    switch (faultType) {
      case 'disk_full':
        s.status = 'critical';
        s.diskUsagePercent = 96.4;
        s.errorRatePercent = 14.5;
        s.latencyMs = 850;
        break;
      case 'db_pool_exhaustion':
        s.status = 'critical';
        s.activeConnections = 198; // Limit is 200
        s.latencyMs = 4650;
        s.errorRatePercent = 28.2;
        s.cpuPercent = 88;
        break;
      case 'redis_memory_saturation':
        s.status = 'degraded';
        s.memoryPercent = 94.8;
        s.latencyMs = 180;
        s.errorRatePercent = 8.4;
        break;
      case 'memory_leak_oom':
        s.status = 'critical';
        s.memoryPercent = 97.2;
        s.cpuPercent = 92;
        s.errorRatePercent = 34.0;
        s.latencyMs = 2800;
        break;
      case 'upstream_502':
        s.status = 'degraded';
        s.errorRatePercent = 42.0;
        s.latencyMs = 5200;
        break;
      default:
        s.status = 'degraded';
        s.errorRatePercent = 15;
    }

    return s;
  }

  // Remediation actions
  public async executeRemediation(actionId: string, serviceId: string): Promise<{ success: boolean; logs: string[] }> {
    const s = this.services.get(serviceId);
    const logs: string[] = [];

    logs.push(`[${new Date().toISOString()}] Initiating remediation action: ${actionId} on target: ${serviceId}`);

    // Simulate action execution delay
    await new Promise(r => setTimeout(r, 1200));

    if (!s) {
      logs.push(`[ERROR] Target service ${serviceId} not found.`);
      return { success: false, logs };
    }

    switch (actionId) {
      case 'clean_disk_logrotate':
        logs.push(`[RUN] Executing: find /var/log/fluentbit -name "*.log.gz" -mtime +2 -delete`);
        logs.push(`[RUN] Executing: logrotate -f /etc/logrotate.d/ingest.conf`);
        s.diskUsagePercent = 28.4;
        s.errorRatePercent = 0.0;
        s.latencyMs = 12;
        s.status = 'healthy';
        logs.push(`[OK] Disk partition reclaimed: freed 84GB. Current usage: 28.4%. Health restored.`);
        break;

      case 'terminate_hung_queries_and_recycle_pool':
        logs.push(`[RUN] Executing: SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND state_change < NOW() - INTERVAL '5 minutes';`);
        logs.push(`[RUN] Terminated 4 zombie client connections.`);
        logs.push(`[RUN] Gracefully recycling connection pooler (PgBouncer)...`);
        s.activeConnections = 38;
        s.latencyMs = 24;
        s.errorRatePercent = 0.05;
        s.cpuPercent = 22;
        s.status = 'healthy';
        logs.push(`[OK] Active DB connections reduced from 198 to 38. Latency dropped to 24ms.`);
        break;

      case 'flush_redis_expired_keys':
        logs.push(`[RUN] Executing: redis-cli --eval /scripts/evict_expired_lru.lua`);
        logs.push(`[RUN] Pruning stale session cache keys older than 24h.`);
        s.memoryPercent = 42.1;
        s.latencyMs = 2.1;
        s.errorRatePercent = 0.0;
        s.status = 'healthy';
        logs.push(`[OK] Redis memory usage normalized to 42.1%. Eviction errors ceased.`);
        break;

      case 'rollout_restart_pod':
        logs.push(`[RUN] Executing: kubectl rollout restart deployment/${serviceId}`);
        logs.push(`[RUN] Waiting for rolling update pods to enter Running state...`);
        s.memoryPercent = 31.5;
        s.cpuPercent = 20;
        s.errorRatePercent = 0.02;
        s.latencyMs = 15;
        s.status = 'healthy';
        s.lastRestartAt = new Date().toISOString();
        logs.push(`[OK] Deployment rolled out successfully. Clean memory baseline established.`);
        break;

      case 'trip_circuit_breaker_and_fallback':
        logs.push(`[RUN] Tripping circuit breaker for external payment gateway.`);
        logs.push(`[RUN] Activating asynchronous queue fallback for checkout transactions.`);
        s.errorRatePercent = 0.0;
        s.latencyMs = 45;
        s.status = 'healthy';
        logs.push(`[OK] Circuit breaker active. Payment requests queuing safely to dead-letter storage.`);
        break;

      default:
        logs.push(`[RUN] Executing generic service recycle: ${actionId}`);
        s.status = 'healthy';
        s.errorRatePercent = 0.1;
        s.cpuPercent = 25;
        logs.push(`[OK] Service stabilized.`);
    }

    return { success: true, logs };
  }
}

export const clusterSimulator = new ClusterSimulator();
