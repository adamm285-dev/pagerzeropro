import React, { useEffect, useState } from 'react';
import { OnCallConfig, ServiceHealth } from '../types.js';

interface NavbarProps {
  config: OnCallConfig;
  services: ServiceHealth[];
  wsConnected: boolean;
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function inQuietHours(now: Date, start: string, end: string): boolean {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const t = now.getHours() * 60 + now.getMinutes();
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (s === e) return true;
  if (s < e) return t >= s && t < e;
  return t >= s || t < e;
}

export const Navbar: React.FC<NavbarProps> = ({ config, services, wsConnected }) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const hasCritical = services.some((s) => s.status === 'critical');
  const hasDegraded = services.some((s) => s.status === 'degraded');
  const clusterState = hasCritical ? 'CRITICAL' : hasDegraded ? 'DEGRADED' : 'ALL OK';
  const clusterClass = hasCritical
    ? 'text-red-term'
    : hasDegraded
      ? 'text-amber-term'
      : 'text-phosphor-bright';
  const quietNow =
    config.quietHours.enabled &&
    inQuietHours(now, config.quietHours.start, config.quietHours.end);

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
        <time dateTime={now.toISOString()} className="tabular-nums tracking-wider">
          {formatClock(now)}
        </time>
      </div>

      <div className="flex items-center gap-3 text-phosphor-dim">
        <span className="hidden sm:inline text-phosphor truncate max-w-[12rem]">
          {config.engineerName}
        </span>
        {config.quietHours.enabled && (
          <span className={quietNow ? 'text-phosphor-bright' : ''}>
            {quietNow ? 'QUIET' : 'DAY'} {config.quietHours.start}–{config.quietHours.end}
          </span>
        )}
        <span className={clusterClass}>{clusterState}</span>
        {config.shadowMode && <span className="text-amber-term tracking-widest">SHADOW</span>}
        <span className={wsConnected ? 'text-phosphor-bright' : 'text-red-term'}>
          {wsConnected ? '● LIVE' : '○ LINK'}
        </span>
      </div>
    </header>
  );
};
