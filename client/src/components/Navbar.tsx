import React from 'react';
import { OnCallConfig, ServiceHealth } from '../types.js';

interface NavbarProps {
  config: OnCallConfig;
  services: ServiceHealth[];
  wsConnected: boolean;
  onOpenSettings: () => void;
  onToggleMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  config,
  services,
  wsConnected,
  onOpenSettings,
  onToggleMode,
}) => {
  const hasCritical = services.some((s) => s.status === 'critical');
  const hasDegraded = services.some((s) => s.status === 'degraded');
  const clusterState = hasCritical ? 'CRITICAL' : hasDegraded ? 'DEGRADED' : 'ALL OK';

  return (
    <header className="h-8 border-b border-crt-line bg-crt-bar text-phosphor text-xs font-mono sticky top-0 z-40 px-3 flex items-center justify-between">
      <div className="flex items-center gap-2 tracking-wide">
        <span>PAGERZERO</span>
        <span aria-hidden="true">·</span>
        <span>TTY-1</span>
        <span aria-hidden="true">·</span>
        <span>CALL-E</span>
      </div>

      <div className="flex items-center gap-3">
        {config.quietHours.enabled && (
          <span>
            QUIET {config.quietHours.start}–{config.quietHours.end}
          </span>
        )}
        <span>{clusterState}</span>
        <span>{wsConnected ? '● LIVE' : '○ LINK'}</span>
        <button type="button" onClick={onToggleMode} className="hover:underline">
          [F9 MODE]
        </button>
        <button type="button" onClick={onOpenSettings} className="hover:underline">
          [F10 CFG]
        </button>
      </div>
    </header>
  );
};
