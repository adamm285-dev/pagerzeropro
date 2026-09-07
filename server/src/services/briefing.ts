import { Incident, MetricSnapshot } from '../types.js';

export function answerEngineerQuestion(
  question: string,
  incident: Incident,
  live: MetricSnapshot | null
): string {
  const q = question.toLowerCase();
  const svc = incident.alert.service;
  const d = incident.diagnosis;
  const m = live;

  if (/error|err%|failure rate/.test(q)) {
    const err = m?.errorRatePercent ?? incident.alert.currentValue;
    return `${svc} error rate is ${Number(err).toFixed(2)}% right now. Disk and pool are ${
      m?.diskUsagePercent !== undefined ? `disk ${m.diskUsagePercent.toFixed(1)}%` : 'stable on disk'
    }.`;
  }
  if (/latency|slow|p99|response time/.test(q)) {
    return `${svc} latency is ${m?.latencyMs ?? 'unknown'} milliseconds.`;
  }
  if (/disk|volume|storage|log/.test(q)) {
    const disk = m?.diskUsagePercent;
    return disk !== undefined
      ? `Disk on ${svc} is at ${disk.toFixed(1)}%.`
      : `${svc} is not a disk-bound alert. Current signal is ${incident.alert.metric} at ${incident.alert.currentValue}.`;
  }
  if (/pool|connection|postgres|db /.test(q)) {
    const pool = m?.activeConnections;
    return pool !== undefined
      ? `Active DB pool connections on ${svc}: ${pool}.`
      : `No pool metric on ${svc}.`;
  }
  if (/cpu|load/.test(q)) {
    return m ? `CPU on ${svc} is ${m.cpuPercent}%.` : `CPU snapshot unavailable.`;
  }
  if (/mem|rss|oom|memory/.test(q)) {
    return m ? `Memory on ${svc} is ${m.memoryPercent}%.` : `Memory snapshot unavailable.`;
  }
  if (/root cause|why|happen|diagnos/.test(q)) {
    return d?.rootCause || incident.alert.description;
  }
  if (/fix|action|runbook|do you|recommend|plan/.test(q)) {
    const a = d?.recommendedAction;
    return a
      ? `I would run ${a.name}: ${a.command}. ${a.description}`
      : `No runbook selected yet.`;
  }
  if (/service|which|what is down/.test(q)) {
    return `This is ${svc}. Alert: ${incident.alert.title}.`;
  }

  const bits = [
    m ? `error ${m.errorRatePercent}%` : null,
    m ? `latency ${m.latencyMs}ms` : null,
    m?.activeConnections !== undefined ? `pool ${m.activeConnections}` : null,
    m?.diskUsagePercent !== undefined ? `disk ${m.diskUsagePercent.toFixed(1)}%` : null,
  ].filter(Boolean);
  return `I have ${svc} at ${bits.join(', ') || incident.alert.title}. Ask error rate, latency, disk, pool, or the recommended fix. Then say Approved when ready.`;
}
