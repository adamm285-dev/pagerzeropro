import React from 'react';
import { ServiceHealth } from '../types.js';
import { Server } from 'lucide-react';

interface ServiceClusterGridProps {
  services: ServiceHealth[];
}

export const ServiceClusterGrid: React.FC<ServiceClusterGridProps> = ({ services }) => {
  return (
    <div className="bg-[#0e1626]/80 border border-slate-800 rounded-2xl p-5 mb-8 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Monitored Cluster Infrastructure</h2>
            <p className="text-xs text-slate-400">Live service telemetry stream updated every 2 seconds</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {services.map((s) => {
          const isCritical = s.status === 'critical';
          const isDegraded = s.status === 'degraded';

          const borderStyle = isCritical
            ? 'border-rose-500/50 bg-rose-950/10 shadow-lg shadow-rose-500/5'
            : isDegraded
            ? 'border-amber-500/50 bg-amber-950/10'
            : 'border-slate-800/90 bg-slate-900/80';

          return (
            <div
              key={s.id}
              className={`p-4 rounded-xl border transition-all ${borderStyle}`}
            >
              {/* Service Title and Status */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h4 className="text-xs font-bold text-white leading-tight">
                    {s.name}
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    {s.id}
                  </span>
                </div>
                <span
                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    isCritical
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : isDegraded
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {isCritical ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                      Critical
                    </>
                  ) : isDegraded ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Degraded
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Healthy
                    </>
                  )}
                </span>
              </div>

              {/* Metrics Grid */}
              <div className="space-y-2 text-xs">
                {/* Latency & Error Rate */}
                <div className="flex items-center justify-between text-slate-400">
                  <span>Latency:</span>
                  <span
                    className={`font-mono font-semibold ${
                      s.latencyMs > 1000 ? 'text-rose-400' : 'text-slate-200'
                    }`}
                  >
                    {s.latencyMs}ms
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span>Error Rate:</span>
                  <span
                    className={`font-mono font-semibold ${
                      s.errorRatePercent > 5 ? 'text-rose-400' : 'text-slate-200'
                    }`}
                  >
                    {s.errorRatePercent.toFixed(2)}%
                  </span>
                </div>

                {/* CPU Bar */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>CPU</span>
                    <span className="font-mono text-slate-300">{s.cpuPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        s.cpuPercent > 80 ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, s.cpuPercent)}%` }}
                    />
                  </div>
                </div>

                {/* Memory Bar */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Memory</span>
                    <span className="font-mono text-slate-300">{s.memoryPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        s.memoryPercent > 90 ? 'bg-rose-500' : 'bg-cyan-500'
                      }`}
                      style={{ width: `${Math.min(100, s.memoryPercent)}%` }}
                    />
                  </div>
                </div>

                {/* Specialized Metric (Connections / Disk) */}
                {s.activeConnections !== undefined && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                    <span>DB Pool:</span>
                    <span
                      className={`font-mono font-semibold ${
                        s.activeConnections > 170 ? 'text-rose-400' : 'text-slate-300'
                      }`}
                    >
                      {s.activeConnections}/200 conn
                    </span>
                  </div>
                )}

                {s.diskUsagePercent !== undefined && (
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                    <span>Disk Space:</span>
                    <span
                      className={`font-mono font-semibold ${
                        s.diskUsagePercent > 85 ? 'text-rose-400' : 'text-slate-300'
                      }`}
                    >
                      {s.diskUsagePercent.toFixed(1)}% used
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
