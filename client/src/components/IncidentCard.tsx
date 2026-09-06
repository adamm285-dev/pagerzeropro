import React, { useState } from 'react';
import { Incident, IncidentStatus, RiskTier } from '../types.js';

interface IncidentCardProps {
  incident: Incident;
  onOpenVoiceDrawer: (incident: Incident) => void;
  onOpenPostMortem: (incident: Incident) => void;
  onDismiss?: (id: string) => void;
}

const STATUS_LABEL: Record<IncidentStatus, string> = {
  RESOLVED: 'RESOLVED',
  AWAITING_VOICE_APPROVAL: 'AWAITING VOICE',
  AUTO_REMEDIATING: 'AUTO-FIX',
  INVESTIGATING: 'DIAGNOSING',
  EXECUTING_REMEDIATION: 'EXECUTING',
  ESCALATED: 'ESCALATED',
  FIRING: 'FIRING',
  VERIFYING: 'EXECUTING',
};

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function tierLabel(tier: RiskTier): string {
  if (tier === 'TIER_1_AUTO') return 'T1';
  if (tier === 'TIER_3_ESCALATE') return 'T3';
  return 'T2';
}

export const IncidentCard: React.FC<IncidentCardProps> = ({
  incident,
  onOpenVoiceDrawer,
  onOpenPostMortem,
  onDismiss,
}) => {
  const [expanded, setExpanded] = useState(true);
  const awaitingVoice = incident.status === 'AWAITING_VOICE_APPROVAL';
  const statusText = STATUS_LABEL[incident.status] ?? 'FIRING';
  const tier = tierLabel(incident.riskTier);

  return (
    <div
      className={`mb-2 border bg-crt-panel font-mono text-xs text-phosphor ${
        awaitingVoice ? 'border-amber-term text-amber-term' : 'border-crt-line'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-black/20"
      >
        <span className="shrink-0 tracking-wide">{shortId(incident.id)}</span>
        <span className="shrink-0">{tier}</span>
        <span className="min-w-0 flex-1 truncate uppercase">{incident.alert.title}</span>
        <span className={`shrink-0 tracking-widest ${awaitingVoice ? 'text-amber-term' : ''}`}>
          {statusText}
        </span>
      </button>

      {expanded && (
        <div className={`space-y-3 border-t px-3 py-3 ${awaitingVoice ? 'border-amber-term' : 'border-crt-line'}`}>
          {incident.diagnosis && (
            <div className="space-y-2">
              <div>DIAGNOSIS</div>
              <p className="text-phosphor/90 leading-relaxed">{incident.diagnosis.rootCause}</p>
              <div className="space-y-0.5">
                {incident.diagnosis.evidence.map((ev, i) => (
                  <div key={i}>
                    <span aria-hidden="true">› </span>
                    {ev}
                  </div>
                ))}
              </div>
              <div>
                <div>RECOMMENDED ACTION</div>
                <div>{incident.diagnosis.recommendedAction.name}</div>
                <div className="text-phosphor/80">{incident.diagnosis.recommendedAction.command}</div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenVoiceDrawer(incident)}
              className="border border-crt-line px-2 py-1 hover:bg-black/30"
            >
              [ VOICE ]
            </button>
            <button
              type="button"
              onClick={() => onOpenPostMortem(incident)}
              className="border border-crt-line px-2 py-1 hover:bg-black/30"
            >
              [ POSTMORTEM ]
            </button>
            {onDismiss && (
              <button
                type="button"
                title="Remove incident"
                onClick={() => onDismiss(incident.id)}
                className="border border-crt-line px-2 py-1 hover:bg-black/30"
              >
                [ X ]
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
