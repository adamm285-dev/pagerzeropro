import React, { useState } from 'react';

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
      title: 'Disk 96% full',
      service: 'log-ingestion-worker',
      fail: 'Log volume at 96.4%. Ingestion will halt.',
      repair: 'Logrotate / prune. No phone call.',
      tier: 'T1 AUTO',
      voice: false,
    },
    {
      id: 'db_pool_exhaustion',
      title: 'DB pool saturated',
      service: 'payments-api',
      fail: '198/200 connections. Checkout latency spikes.',
      repair: 'Recycle pool after spoken APPROVED.',
      tier: 'T2 VOICE',
      voice: true,
    },
    {
      id: 'redis_memory_saturation',
      title: 'Redis memory 94%',
      service: 'cache-redis-03',
      fail: 'Hot keys filling node. Cache evictions stall.',
      repair: 'Flush expired keys. No phone call.',
      tier: 'T1 AUTO',
      voice: false,
    },
    {
      id: 'memory_leak_oom',
      title: 'Auth pod OOM',
      service: 'auth-service',
      fail: 'RSS 97%. Process about to be killed.',
      repair: 'Rolling restart after spoken APPROVED.',
      tier: 'T2 VOICE',
      voice: true,
    },
    {
      id: 'upstream_502',
      title: 'Gateway 502',
      service: 'checkout-gateway',
      fail: 'Error rate 42%. Upstream dead.',
      repair: 'Circuit breaker after spoken APPROVED.',
      tier: 'T2 VOICE',
      voice: true,
    },
  ];

  return (
    <div className="border-b border-crt-line bg-crt-bar px-3 py-2 font-mono shrink-0">
      <div className="text-[10px] uppercase tracking-widest text-phosphor-dim mb-2">
        Chaos scenarios — each card is a real failure plus the runbook that repairs it
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {scenarios.map((sc) => {
          const isLoading = loadingScenario === sc.id;
          const border = sc.voice ? 'border-amber-term' : 'border-crt-line';
          const accent = sc.voice ? 'text-amber-term' : 'text-phosphor-bright';
          return (
            <button
              key={sc.id}
              type="button"
              disabled={Boolean(loadingScenario)}
              onClick={() => handleTrigger(sc.id)}
              className={`text-left border ${border} bg-crt-panel p-2 hover:bg-crt-bg disabled:opacity-50`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className={`text-[10px] tracking-widest ${accent}`}>{sc.tier}</span>
                <span className="text-[10px] text-phosphor-dim truncate">{sc.service}</span>
              </div>
              <div className="text-xs text-phosphor mb-2 leading-tight">{sc.title}</div>
              <div className="text-[10px] space-y-1 mb-2">
                <div>
                  <span className="text-red-term">FAIL </span>
                  <span className="text-phosphor-dim">{sc.fail}</span>
                </div>
                <div>
                  <span className="text-phosphor-bright">REPAIR </span>
                  <span className="text-phosphor-dim">{sc.repair}</span>
                </div>
              </div>
              <div className={`text-[10px] uppercase tracking-wide ${accent}`}>
                {isLoading ? '… injecting' : sc.voice ? 'Run — will ring' : 'Run — auto-fix'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
