import React, { useState, useEffect, useRef } from 'react';
import { Incident, ServiceHealth, OnCallConfig } from './types.js';
import { Navbar } from './components/Navbar.js';
import { ChaosBar } from './components/ChaosBar.js';
import { ServiceClusterGrid } from './components/ServiceClusterGrid.js';
import { IncidentCard } from './components/IncidentCard.js';
import { LiveVoiceDrawer } from './components/LiveVoiceDrawer.js';
import { PostMortemModal } from './components/PostMortemModal.js';
import { SettingsModal } from './components/SettingsModal.js';


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
  const [chaosMenuOpen, setChaosMenuOpen] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!disposed) setWsConnected(true);
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!disposed) retry = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
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
      disposed = true;
      if (retry) clearTimeout(retry);
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

      case 'incidents_cleared': {
        const remaining: Incident[] = payload.data?.incidents || [];
        const removed: string[] = payload.data?.ids || [];
        setIncidents(remaining);
        setActiveVoiceIncident((current) =>
          current && removed.includes(current.id) ? null : current
        );
        setPostMortemIncident((current) =>
          current && removed.includes(current.id) ? null : current
        );
        break;
      }

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

  const handleClearIncidents = async (scope: 'resolved' | 'all') => {
    try {
      const res = await fetch(`/api/incidents?scope=${scope}`, { method: 'DELETE' });
      const data = await res.json();
      if (Array.isArray(data.services)) setServices(data.services);
      setIncidents((prev) =>
        scope === 'all'
          ? []
          : prev.filter((i) => i.status !== 'RESOLVED' && i.status !== 'ESCALATED')
      );
      if (scope === 'all') {
        setActiveVoiceIncident(null);
        setPostMortemIncident(null);
      }
    } catch (err) {
      console.error('Failed to clear incidents:', err);
    }
  };

  const handleDeleteIncident = async (id: string) => {
    try {
      await fetch(`/api/incidents/${id}`, { method: 'DELETE' });
      setIncidents((prev) => prev.filter((i) => i.id !== id));
      setActiveVoiceIncident((current) => (current?.id === id ? null : current));
      setPostMortemIncident((current) => (current?.id === id ? null : current));
    } catch (err) {
      console.error('Failed to delete incident:', err);
    }
  };

  const handleToggleMode = async () => {
    const nextMode = config.callMode === 'calle_live' ? 'voice_simulator' : 'calle_live';
    await handleSaveConfig({ callMode: nextMode });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setChaosMenuOpen((v) => !v);
      } else if (e.key === 'F2') {
        e.preventDefault();
        handleTriggerChaos('db_pool_exhaustion');
      } else if (e.key === 'F5') {
        e.preventDefault();
        handleClearIncidents(e.shiftKey ? 'all' : 'resolved');
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleToggleMode();
      } else if (e.key === 'F10') {
        e.preventDefault();
        setIsSettingsOpen(true);
      } else if (e.key === 'Escape') {
        setActiveVoiceIncident(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const resolvedIncidents = incidents.filter((i) => i.status === 'RESOLVED');

  return (
    <div className="h-screen bg-crt-bg text-phosphor font-mono flex flex-col overflow-hidden">
      <Navbar
        config={config}
        services={services}
        wsConnected={wsConnected}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleMode={handleToggleMode}
      />

      <ChaosBar open={chaosMenuOpen} onTriggerChaos={handleTriggerChaos} />

      <main className="flex-1 grid md:grid-cols-2 gap-1 p-1 min-h-0">
        <ServiceClusterGrid services={services} />
        <section className="border border-crt-line bg-crt-panel flex flex-col min-h-0 overflow-hidden">
          <div className="px-2 py-1 border-b border-crt-line text-phosphor-dim text-xs">
            INCIDENTS {activeIncidents.length} active / {incidents.length} total
          </div>
          <div className="flex-1 overflow-auto">
            {incidents.length === 0 ? (
              <div className="p-4 text-phosphor-dim text-xs">
                NO INCIDENTS. F1 CHAOS TO INJECT.
              </div>
            ) : (
              <>
                {activeIncidents.map((inc) => (
                  <IncidentCard
                    key={inc.id}
                    incident={inc}
                    onOpenVoiceDrawer={(i) => setActiveVoiceIncident(i)}
                    onOpenPostMortem={(i) => setPostMortemIncident(i)}
                    onDismiss={handleDeleteIncident}
                  />
                ))}
                {resolvedIncidents.map((inc) => (
                  <IncidentCard
                    key={inc.id}
                    incident={inc}
                    onOpenVoiceDrawer={(i) => setActiveVoiceIncident(i)}
                    onOpenPostMortem={(i) => setPostMortemIncident(i)}
                    onDismiss={handleDeleteIncident}
                  />
                ))}
              </>
            )}
          </div>
        </section>
      </main>

      <nav className="h-8 px-3 flex items-center gap-4 border-t border-crt-line bg-crt-bar text-xs font-mono text-phosphor-dim">
        <button type="button" onClick={() => setChaosMenuOpen((v) => !v)}>
          F1 Chaos
        </button>
        <button type="button" onClick={() => handleTriggerChaos('db_pool_exhaustion')}>
          F2 Voice test
        </button>
        <button type="button" onClick={() => handleClearIncidents('resolved')}>
          F5 Clear resolved
        </button>
        <button type="button" onClick={() => handleClearIncidents('all')}>
          Shift+F5 Clear all
        </button>
        <button type="button" onClick={handleToggleMode}>
          F9 {config.callMode === 'calle_live' ? 'LIVE' : 'SIM'}
        </button>
        <button type="button" onClick={() => setIsSettingsOpen(true)}>
          F10 Settings
        </button>
      </nav>

      <LiveVoiceDrawer
        incident={activeVoiceIncident}
        onClose={() => setActiveVoiceIncident(null)}
        onSubmitVoiceDecision={handleSubmitVoiceDecision}
      />

      <PostMortemModal
        incident={postMortemIncident}
        onClose={() => setPostMortemIncident(null)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
        onSaveApiKey={handleSaveApiKey}
      />
    </div>
  );
};
export default App;
