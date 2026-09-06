import React from 'react';
import { ServiceHealth } from '../types.js';

interface ServiceClusterGridProps {
  services: ServiceHealth[];
}

function primaryMetric(s: ServiceHealth): { label: string; value: string } {
  if (s.diskUsagePercent !== undefined) {
    return { label: 'DISK', value: `${s.diskUsagePercent.toFixed(1)}%` };
  }
  if (s.memoryPercent !== undefined) {
    return { label: 'MEM', value: `${s.memoryPercent}%` };
  }
  return { label: 'CPU', value: `${s.cpuPercent}%` };
}

function statusLabel(status: ServiceHealth['status']): { text: string; className: string } {
  if (status === 'critical') {
    return { text: 'CRIT', className: 'text-red-term' };
  }
  if (status === 'degraded') {
    return { text: 'DEGRADED', className: 'text-amber-term' };
  }
  return { text: 'OK', className: 'text-phosphor-bright' };
}

export const ServiceClusterGrid: React.FC<ServiceClusterGridProps> = ({ services }) => {
  return (
    <div className="border border-crt-line bg-crt-panel h-full flex flex-col overflow-hidden">
      <div className="px-2 py-1 border-b border-crt-line text-phosphor-dim text-[10px] uppercase tracking-widest">
        SERVICES
      </div>
      <div className="flex-1 overflow-auto font-mono text-[11px]">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-phosphor-dim text-left">
              <th className="px-2 py-1 font-normal border-b border-crt-line">ID</th>
              <th className="px-2 py-1 font-normal border-b border-crt-line">METRIC</th>
              <th className="px-2 py-1 font-normal border-b border-crt-line">LAT</th>
              <th className="px-2 py-1 font-normal border-b border-crt-line">ERR</th>
              <th className="px-2 py-1 font-normal border-b border-crt-line">STS</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => {
              const metric = primaryMetric(s);
              const status = statusLabel(s.status);
              return (
                <tr key={s.id} className="border-b border-crt-line/60">
                  <td className="px-2 py-0.5 text-phosphor">{s.id}</td>
                  <td className="px-2 py-0.5 text-phosphor">
                    {metric.label} {metric.value}
                  </td>
                  <td className="px-2 py-0.5 text-phosphor">{s.latencyMs}ms</td>
                  <td className="px-2 py-0.5 text-phosphor">{s.errorRatePercent.toFixed(2)}%</td>
                  <td className={`px-2 py-0.5 ${status.className}`}>{status.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
