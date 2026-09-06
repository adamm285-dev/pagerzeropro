import React, { useState } from 'react';

interface ChaosBarProps {
  onTriggerChaos: (scenario: string) => Promise<void>;
  open: boolean;
}

export const ChaosBar: React.FC<ChaosBarProps> = ({ onTriggerChaos, open }) => {
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
    { id: 'disk_full', label: 'disk_full', tier: 'T1' },
    { id: 'db_pool_exhaustion', label: 'db_pool_exhaustion', tier: 'T2' },
    { id: 'redis_memory_saturation', label: 'redis_memory_saturation', tier: 'T1' },
    { id: 'memory_leak_oom', label: 'memory_leak_oom', tier: 'T2' },
    { id: 'upstream_502', label: 'upstream_502', tier: 'T2' },
  ];

  if (!open) return null;

  return (
    <div className="px-3 py-1 border-b border-crt-line bg-crt-bar text-xs font-mono text-phosphor flex flex-wrap items-center gap-2">
      {scenarios.map((sc) => {
        const isLoading = loadingScenario === sc.id;
        return (
          <button
            key={sc.id}
            type="button"
            disabled={Boolean(loadingScenario)}
            onClick={() => handleTrigger(sc.id)}
            className="border border-crt-line px-2 py-0.5 hover:bg-crt-panel disabled:opacity-50"
          >
            {isLoading ? '...' : `${sc.tier} ${sc.label}`}
          </button>
        );
      })}
    </div>
  );
};
