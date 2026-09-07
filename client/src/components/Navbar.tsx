import React from 'react';
import { OnCallConfig, ServiceHealth } from '../types.js';

interface NavbarProps {
  config: OnCallConfig;
  services: ServiceHealth[];
  wsConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ config, services, wsConnected }) => {
  const hasCritical = services.some((s) => s.status === 'critical');
  const hasDegraded = services.some((s) => s.status === 'degraded');
  const clusterState = hasCritical ? 'CRITICAL' : hasDegraded ? 'DEGRADED' : 'ALL OK';
  const clusterClass = hasCritical
    ? 'text-red-term'
    : hasDegraded
      ? 'text-amber-term'
      : 'text-phosphor-bright';

  return (
    <header className="h-8 shrink-0 border-b border-crt-line bg-crt-bar px-3 flex items-center justify-between text-xs font-mono text-phosphor">
      <div className="flex items-center gap-2 tracking-wide">
        <span className="text-phosphor-bright">PAGERZERO</span>
        <span aria-hidden="true" className="text-phosphor-dim">
          ·
        </span>
        <span>TTY-1</span>
        <span aria-hidden="true" className="text-phosphor-dim">
          ·
        </span>
        <span>CALL-E</span>
      </div>

      <div className="flex items-center gap-3 text-phosphor-dim">
        <span className="hidden sm:inline text-phosphor truncate max-w-[12rem]">
          {config.engineerName}
        </span>
        {config.quietHours.enabled && (
          <span>
            QUIET {config.quietHours.start}–{config.quietHours.end}
          </span>
        )}
        <span className={clusterClass}>{clusterState}</span>
        <span className={wsConnected ? 'text-phosphor-bright' : 'text-red-term'}>
          {wsConnected ? '● LIVE' : '○ LINK'}
        </span>
      </div>
    </header>
  );
};
