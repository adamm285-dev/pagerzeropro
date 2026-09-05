import React, { useState } from 'react';
import { Flame, Database, HardDrive, Cpu, RefreshCw, Zap } from 'lucide-react';

interface ChaosBarProps {
  onTriggerChaos: (scenario: string) => Promise<void>;
}

export const ChaosBar: React.FC<ChaosBarProps> = ({ onTriggerChaos }) => {
  const [loadingScenario, setLoadingScenario] = useState<string | null>(null);

  const handleTrigger = async (scenario: string) => {
    setLoadingScenario(scenario);
    try {
      await onTriggerChaos(scenario);
    } finally {
      setTimeout(() => setLoadingScenario(null), 800);
    }
  };

  const scenarios = [
    {
      id: 'disk_full',
      title: 'Disk 96% Full',
      service: 'log-ingestion-worker',
      tier: 'Tier 1: Safe Auto-Fix',
      tierColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      icon: HardDrive,
      desc: 'Reclaims logs without waking engineer',
      tag: 'Stay in Bed 😴',
    },
    {
      id: 'db_pool_exhaustion',
      title: 'DB Connection Pool Saturated',
      service: 'payments-api',
      tier: 'Tier 2: Voice Approval',
      tierColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      icon: Database,
      desc: 'CALL-E rings phone for spoken "Approve"',
      tag: 'Phone Rings 📞',
    },
    {
      id: 'redis_memory_saturation',
      title: 'Redis Node 03 >94% Mem',
      service: 'cache-redis-03',
      tier: 'Tier 1: Safe Auto-Fix',
      tierColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      icon: Cpu,
      desc: 'Evicts expired keys autonomously',
      tag: 'Stay in Bed 😴',
    },
    {
      id: 'memory_leak_oom',
      title: 'Auth Pod OOM Impending',
      service: 'auth-service',
      tier: 'Tier 2: Voice Approval',
      tierColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      icon: Flame,
      desc: 'Calls for rolling restart approval',
      tag: 'Phone Rings 📞',
    },
    {
      id: 'upstream_502',
      title: 'Checkout Gateway 502 Outage',
      service: 'checkout-gateway',
      tier: 'Tier 2: Voice Approval',
      tierColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      icon: Zap,
      desc: 'Calls to confirm circuit breaker fallback',
      tag: 'Phone Rings 📞',
    },
  ];

  return (
    <div className="bg-[#0e1626]/80 border border-slate-800/80 rounded-2xl p-5 mb-8 shadow-xl shadow-black/20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Chaos Outage Simulator
              <span className="text-[11px] font-normal text-slate-400">(Simulate real production failures)</span>
            </h2>
            <p className="text-xs text-slate-400">
              Trigger scenarios to see PagerZero auto-remediate safe alerts or place an interactive CALL-E phone call for approval.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {scenarios.map((sc) => {
          const Icon = sc.icon;
          const isLoading = loadingScenario === sc.id;

          return (
            <button
              key={sc.id}
              disabled={Boolean(loadingScenario)}
              onClick={() => handleTrigger(sc.id)}
              className="group relative flex flex-col justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-500/5"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300 group-hover:text-emerald-400 transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.tierColor}`}>
                    {sc.tag}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-200 group-hover:text-white mb-1 leading-snug">
                  {sc.title}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mb-2">
                  {sc.service}
                </div>
                <p className="text-[11px] text-slate-400/90 leading-relaxed mb-3">
                  {sc.desc}
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 group-hover:text-emerald-300 mt-auto pt-2 border-t border-slate-800/80">
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Triggering Alert...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Inject Chaos</span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
