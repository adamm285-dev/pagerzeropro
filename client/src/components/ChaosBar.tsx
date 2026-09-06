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
      hint: 'T1 auto-fix',
      accent: 'border-crt-line text-phosphor hover:bg-phosphor/10',
    },
    {
      id: 'db_pool_exhaustion',
      title: 'DB pool full',
      hint: 'T2 VOICE',
      accent: 'border-amber-term text-amber-term hover:bg-amber-term/10',
    },
    {
      id: 'redis_memory_saturation',
      title: 'Redis memory',
      hint: 'T1 auto-fix',
      accent: 'border-crt-line text-phosphor hover:bg-phosphor/10',
    },
    {
      id: 'memory_leak_oom',
      title: 'Auth OOM',
      hint: 'T2 VOICE',
      accent: 'border-amber-term text-amber-term hover:bg-amber-term/10',
    },
    {
      id: 'upstream_502',
      title: 'Gateway 502',
      hint: 'T2 VOICE',
      accent: 'border-amber-term text-amber-term hover:bg-amber-term/10',
    },
  ];

  return (
    <div className="border-b border-crt-line bg-crt-bar px-3 py-2 font-mono">
      <div className="text-[10px] uppercase tracking-widest text-phosphor-dim mb-1">
        Inject outage — click a scenario (T2 rings the phone)
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {scenarios.map((sc) => {
          const isLoading = loadingScenario === sc.id;
          return (
            <button
              key={sc.id}
              type="button"
              disabled={Boolean(loadingScenario)}
              onClick={() => handleTrigger(sc.id)}
              className={`border px-2 py-1 text-xs disabled:opacity-50 ${sc.accent}`}
            >
              {isLoading ? '… firing' : `${sc.title}  ${sc.hint}`}
            </button>
          );
        })}
      </div>
    </div>
  );
};
