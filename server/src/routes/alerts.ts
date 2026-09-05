import { Router, Request, Response } from 'express';
import { incidentManager } from '../services/incidents.js';
import { clusterSimulator } from '../services/cluster.js';
import { AlertPayload } from '../types.js';

export const alertsRouter = Router();

// Generic webhook for Alertmanager / Datadog / CloudWatch / PagerDuty
alertsRouter.post('/webhook', async (req: Request, res: Response) => {
  const body = req.body;
  const alert: AlertPayload = {
    id: body.id || `alert-${Date.now()}`,
    source: body.source || 'alertmanager',
    service: body.service || 'payments-api',
    severity: body.severity || 'P1',
    title: body.title || 'Service Health Degraded',
    description: body.description || 'Threshold exceeded on primary healthcheck',
    metric: body.metric || 'latency_ms',
    currentValue: body.currentValue || 1500,
    thresholdValue: body.thresholdValue || 500,
    timestamp: new Date().toISOString(),
    labels: body.labels || {},
  };

  const incident = await incidentManager.handleAlert(alert);
  res.status(202).json({
    status: 'received',
    incidentId: incident.id,
    alertTitle: alert.title,
  });
});

// Chaos simulator endpoint
alertsRouter.post('/chaos/trigger', async (req: Request, res: Response) => {
  const { scenario } = req.body;

  let alert: AlertPayload;

  switch (scenario) {
    case 'disk_full': {
      clusterSimulator.injectFault('log-ingestion-worker', 'disk_full');
      alert = {
        id: `chaos-disk-${Date.now()}`,
        source: 'chaos_simulator',
        service: 'log-ingestion-worker',
        severity: 'P2',
        title: 'Disk Usage Saturated (96.4%) on /var/log',
        description: 'Disk partition utilization exceeded critical watermark (85%). Log backpressure imminent.',
        metric: 'disk_usage_percent',
        currentValue: 96.4,
        thresholdValue: 85.0,
        timestamp: new Date().toISOString(),
      };
      break;
    }

    case 'db_pool_exhaustion': {
      clusterSimulator.injectFault('payments-api', 'db_pool_exhaustion');
      alert = {
        id: `chaos-db-${Date.now()}`,
        source: 'chaos_simulator',
        service: 'payments-api',
        severity: 'P1',
        title: 'PostgreSQL Connection Pool Saturated (198/200)',
        description: 'Connection pool exhausted due to 4 hung transactions holding row locks. Latency spiked to 4650ms.',
        metric: 'db_connection_pool_active',
        currentValue: 198,
        thresholdValue: 170,
        timestamp: new Date().toISOString(),
      };
      break;
    }

    case 'redis_memory_saturation': {
      clusterSimulator.injectFault('cache-redis-03', 'redis_memory_saturation');
      alert = {
        id: `chaos-redis-${Date.now()}`,
        source: 'chaos_simulator',
        service: 'cache-redis-03',
        severity: 'P3',
        title: 'Redis Node 03 Memory Above 94%',
        description: 'Key count reached 184,200 with high passive expiry backlog. Memory at 94.8%.',
        metric: 'redis_memory_percent',
        currentValue: 94.8,
        thresholdValue: 90.0,
        timestamp: new Date().toISOString(),
      };
      break;
    }

    case 'memory_leak_oom': {
      clusterSimulator.injectFault('auth-service', 'memory_leak_oom');
      alert = {
        id: `chaos-oom-${Date.now()}`,
        source: 'chaos_simulator',
        service: 'auth-service',
        severity: 'P1',
        title: 'Impending OOMKilled on auth-service',
        description: 'Resident memory at 97.2% of cgroup limit. Pod at risk of sudden CrashLoopBackoff.',
        metric: 'memory_rss_percent',
        currentValue: 97.2,
        thresholdValue: 90.0,
        timestamp: new Date().toISOString(),
      };
      break;
    }

    case 'upstream_502': {
      clusterSimulator.injectFault('checkout-gateway', 'upstream_502');
      alert = {
        id: `chaos-upstream-${Date.now()}`,
        source: 'chaos_simulator',
        service: 'checkout-gateway',
        severity: 'P1',
        title: 'Upstream Payment Provider 502 Bad Gateway Outage',
        description: 'External payment partner returning 502 errors on 42% of customer charges.',
        metric: 'upstream_error_rate',
        currentValue: 42.0,
        thresholdValue: 5.0,
        timestamp: new Date().toISOString(),
      };
      break;
    }

    default:
      res.status(400).json({ error: 'Unknown chaos scenario' });
      return;
  }

  const incident = await incidentManager.handleAlert(alert);
  res.status(200).json({
    status: 'triggered',
    scenario,
    incidentId: incident.id,
    alertTitle: alert.title,
    riskTier: incident.riskTier,
  });
});
