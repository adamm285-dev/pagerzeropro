import { Router, Request, Response } from 'express';
import { incidentManager } from '../services/incidents.js';
import { clusterSimulator } from '../services/cluster.js';
import { AlertPayload } from '../types.js';

export const alertsRouter = Router();

function normalizeWebhook(body: any): AlertPayload[] {
  if (Array.isArray(body?.alerts)) {
    return body.alerts
      .filter((a: any) => (a.status || 'firing') !== 'resolved')
      .map((a: any) => {
        const labels = a.labels || {};
        const annotations = a.annotations || {};
        return {
          id: a.fingerprint || `am-${Date.now()}`,
          source: 'alertmanager' as const,
          service: labels.service || labels.job || labels.instance || 'unknown-service',
          severity: (labels.severity === 'critical' ? 'P1' : labels.severity === 'warning' ? 'P2' : 'P1') as AlertPayload['severity'],
          title: annotations.summary || labels.alertname || 'Alertmanager firing',
          description: annotations.description || annotations.summary || 'Prometheus alert firing',
          metric: labels.metric || labels.alertname || 'alert',
          currentValue: Number(annotations.currentValue ?? annotations.value ?? 1),
          thresholdValue: Number(annotations.threshold ?? 0),
          timestamp: a.startsAt || new Date().toISOString(),
          labels,
        };
      });
  }

  return [
    {
      id: body.id || `alert-${Date.now()}`,
      source: body.source || 'alertmanager',
      service: body.service || body.labels?.service || 'unknown-service',
      severity: body.severity || 'P1',
      title: body.title || body.alertname || 'Service Health Degraded',
      description: body.description || body.message || 'Threshold exceeded',
      metric: body.metric || 'latency_ms',
      currentValue: body.currentValue ?? 1500,
      thresholdValue: body.thresholdValue ?? 500,
      timestamp: new Date().toISOString(),
      labels: body.labels || {},
    },
  ];
}

alertsRouter.post('/webhook', async (req: Request, res: Response) => {
  const alerts = normalizeWebhook(req.body);
  if (alerts.length === 0) {
    res.status(202).json({ status: 'ignored', reason: 'no firing alerts' });
    return;
  }

  const incidents = [];
  for (const alert of alerts) {
    incidents.push(await incidentManager.handleAlert(alert));
  }

  res.status(202).json({
    status: 'received',
    incidentIds: incidents.map((i) => i.id),
    count: incidents.length,
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
