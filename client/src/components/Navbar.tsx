import React from 'react';
import { OnCallConfig, ServiceHealth } from '../types.js';
import { ShieldCheck, AlertTriangle, PhoneCall, Volume2, Settings, Moon, Sparkles } from 'lucide-react';

interface NavbarProps {
  config: OnCallConfig;
  services: ServiceHealth[];
  onOpenSettings: () => void;
  onToggleMode: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ config, services, onOpenSettings, onToggleMode }) => {
  const hasCritical = services.some(s => s.status === 'critical');
  const hasDegraded = services.some(s => s.status === 'degraded');

  return (
    <header className="border-b border-slate-800/80 bg-[#0d131f]/90 backdrop-blur sticky top-0 z-40 px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
              <PhoneCall className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                Pager<span className="text-emerald-400">Zero</span>
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> CALL-E Powered
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium hidden sm:block">
              Stay in bed while your AI agent investigates, fixes, or calls for one-word approval
            </p>
          </div>
        </div>

        {/* Status and Actions */}
        <div className="flex items-center gap-3">
          {/* Cluster Status */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
            {hasCritical ? (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                <span className="text-rose-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Incidents Active
                </span>
              </>
            ) : hasDegraded ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-amber-400 font-medium">Degraded Services</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> All Services Normal
                </span>
              </>
            )}
          </div>

          {/* Sleep / On-Call Status Banner */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-300">
            <Moon className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span className="font-semibold">{config.engineerName}</span>
            <span className="hidden lg:inline text-indigo-400/80 font-mono text-[11px]">(In Bed 🛏️)</span>
          </div>

          {/* Mode Switcher Button */}
          <button
            onClick={onToggleMode}
            title={config.callMode === 'calle_live' ? 'Switch to Voice Simulator' : 'Switch to Live CALL-E Dialing'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              config.callMode === 'calle_live'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/20'
            }`}
          >
            {config.callMode === 'calle_live' ? (
              <>
                <PhoneCall className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mode:</span> Live Call ({config.phoneNumber})
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mode:</span> Voice Simulator
              </>
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
            title="Configure On-Call Roster & CALL-E API"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
