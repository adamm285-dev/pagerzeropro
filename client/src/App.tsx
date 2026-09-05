import React, { useState, useEffect, useRef } from 'react';
import { Incident, ServiceHealth, OnCallConfig } from './types.js';
import { Navbar } from './components/Navbar.js';
import { ChaosBar } from './components/ChaosBar.js';
import { ServiceClusterGrid } from './components/ServiceClusterGrid.js';
import { IncidentCard } from './components/IncidentCard.js';
import { LiveVoiceDrawer } from './components/LiveVoiceDrawer.js';
import { PostMortemModal } from './components/PostMortemModal.js';
import { SettingsModal } from './components/SettingsModal.js';
import { PhoneCall, ShieldCheck, Activity, BedDouble } from 'lucide-react';

export const App: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [config, setConfig] = useState<OnCallConfig>({
    engineerName: 'Adam (Primary SRE)',
    phoneNumber: '+15551234567',
    callMode: 'voice_simulator',
    autoApproveTier1: true,
    quietHours: { enabled: true, start: '22:00', end: '07:00' },
    escalationTimeoutSeconds: 45,
    hasCalleApiKey: false,
  });

  const [activeVoiceIncident, setActiveVoiceIncident] = useState<Incident | null>(null);
  const [postMortemIncident, setPostMortemIncident] = useState<Incident | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onclose = () => {
        setWsConnected(false);
        // Reconnect after delay
        setTimeout(connect, 3000);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          handleWebSocketMessage(payload);
        } catch (err) {
          console.error('Error parsing WS message:', err);
        }
      };
    };

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, []);

  const handleWebSocketMessage = (payload: any) => {
    switch (payload.type) {
      case 'initial_state':
        setIncidents(payload.incidents || []);
        setServices(payload.services || []);
        if (payload.config) setConfig(payload.config);
        break;

      case 'telemetry_tick':
        if (payload.services) {
          setServices(payload.services);
        }
        break;

      case 'incident_created':
        setIncidents((prev) => [payload.incident, ...prev.filter((i) => i.id !== payload.incident.id)]);
        break;

      case 'incident_diagnosed':
      case 'incident_updated':
      case 'incident_resolved':
        setIncidents((prev) => [
          payload.incident,
          ...prev.filter((i) => i.id !== payload.incident.id),
        ]);
        setActiveVoiceIncident((current) => (current?.id === payload.incident.id ? payload.incident : current));
        break;

      case 'voice_call_started':
        setIncidents((prev) => [
          payload.incident,
          ...prev.filter((i) => i.id !== payload.incident.id),
        ]);
        // Automatically pop up voice drawer when phone starts ringing!
        setActiveVoiceIncident(payload.incident);
        break;

      case 'voice_call_turn':
        setIncidents((prev) => [
          payload.incident,
          ...prev.filter((i) => i.id !== payload.incident.id),
        ]);
        setActiveVoiceIncident((current) => (current?.id === payload.incident.id ? payload.incident : current));
        break;

      default:
        break;
    }
  };

  // Trigger chaos outage scenario
  const handleTriggerChaos = async (scenario: string) => {
    try {
      const res = await fetch('/api/alerts/chaos/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      const data = await res.json();
      console.log('Chaos triggered:', data);
    } catch (err) {
      console.error('Failed to trigger chaos:', err);
    }
  };

  // Submit voice approval/rejection
  const handleSubmitVoiceDecision = async (
    incidentId: string,
    decision: 'approved' | 'rejected' | 'escalate',
    notes: string
  ) => {
    try {
      await fetch(`/api/incidents/${incidentId}/voice-decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes }),
      });
    } catch (err) {
      console.error('Failed to submit voice decision:', err);
    }
  };

  // Save config changes
  const handleSaveConfig = async (updated: Partial<OnCallConfig>) => {
    try {
      const res = await fetch('/api/incidents/config/oncall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      console.error('Failed to save on-call config:', err);
    }
  };

  // Save CALL-E API key
  const handleSaveApiKey = async (apiKey: string) => {
    try {
      await fetch('/api/incidents/config/calle-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      setConfig((prev) => ({ ...prev, hasCalleApiKey: Boolean(apiKey) }));
    } catch (err) {
      console.error('Failed to save CALL-E API key:', err);
    }
  };

  const handleToggleMode = async () => {
    const nextMode = config.callMode === 'calle_live' ? 'voice_simulator' : 'calle_live';
    await handleSaveConfig({ callMode: nextMode });
  };

  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const resolvedIncidents = incidents.filter((i) => i.status === 'RESOLVED');

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <Navbar
        config={config}
        services={services}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleMode={handleToggleMode}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Hero Banner / Problem Statement */}
        <div className="mb-6 p-6 rounded-2xl bg-gradient-to-r from-emerald-950/30 via-slate-900/60 to-indigo-950/30 border border-emerald-500/20 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1">
                <BedDouble className="w-3.5 h-3.5" /> Sleep-First On-Call Architecture
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {wsConnected ? '● Live WebSocket Connected' : '○ Connecting...'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              The Intelligent Pager Replacement That Lets You Stay in Bed.
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl mt-1 leading-relaxed">
              When alerts fire, PagerZero diagnoses root cause in seconds. Safe issues (disk full, cache expiration) are auto-remediated without waking you. High-impact fixes place a CALL-E voice call so you can approve with a single spoken word: <span className="text-emerald-400 font-semibold font-mono">"Approved"</span>.
            </p>
          </div>

          <button
            onClick={() => handleTriggerChaos('db_pool_exhaustion')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition transform hover:-translate-y-0.5 whitespace-nowrap"
          >
            <PhoneCall className="w-4 h-4 animate-bounce" />
            <span>Test Voice Call Outage</span>
          </button>
        </div>

        {/* Chaos Outage Simulator Bar */}
        <ChaosBar onTriggerChaos={handleTriggerChaos} />

        {/* Live Cluster Health Grid */}
        <ServiceClusterGrid services={services} />

        {/* Incidents Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Incident Stream</h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {incidents.length} total ({activeIncidents.length} active)
              </span>
            </div>
          </div>

          {/* Active Incidents Feed */}
          {activeIncidents.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Active / In Progress Incidents
              </h3>
              {activeIncidents.map((inc) => (
                <IncidentCard
                  key={inc.id}
                  incident={inc}
                  onOpenVoiceDrawer={(i) => setActiveVoiceIncident(i)}
                  onOpenPostMortem={(i) => setPostMortemIncident(i)}
                />
              ))}
            </div>
          )}

          {/* Resolved Incidents Feed */}
          {resolvedIncidents.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Auto-Remediated & Resolved Incidents
              </h3>
              {resolvedIncidents.map((inc) => (
                <IncidentCard
                  key={inc.id}
                  incident={inc}
                  onOpenVoiceDrawer={(i) => setActiveVoiceIncident(i)}
                  onOpenPostMortem={(i) => setPostMortemIncident(i)}
                />
              ))}
            </div>
          )}

          {incidents.length === 0 && (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                Zero Incidents Active
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                The cluster is running smoothly and the on-call engineer is fast asleep. Use the chaos simulator above to inject an outage.
              </p>
              <button
                onClick={() => handleTriggerChaos('disk_full')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              >
                Trigger Test Alert (Disk Full - Tier 1 Auto-Fix)
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Voice Call Drawer / Modal */}
      <LiveVoiceDrawer
        incident={activeVoiceIncident}
        onClose={() => setActiveVoiceIncident(null)}
        onSubmitVoiceDecision={handleSubmitVoiceDecision}
      />

      {/* Post-Mortem Report Modal */}
      <PostMortemModal
        incident={postMortemIncident}
        onClose={() => setPostMortemIncident(null)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
        onSaveApiKey={handleSaveApiKey}
      />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500 bg-[#080d16]">
        PagerZero · Autonomous SRE & Voice-Approved Incident Remediation · Built on CALL-E Developer SDK
      </footer>
    </div>
  );
};
export default App;
