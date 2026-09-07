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
  VERIFYING: 'VERIFYING',
};

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function tierLabel(tier: RiskTier): string {
  if (tier === 'TIER_1_AUTO') return 'T1 AUTO';
  if (tier === 'TIER_3_ESCALATE') return 'T3 ESCALATE';
  return 'T2 VOICE';
}

function stepDone(status: IncidentStatus, step: number): boolean {
  const order: IncidentStatus[][] = [
    ['FIRING', 'INVESTIGATING', 'AUTO_REMEDIATING', 'AWAITING_VOICE_APPROVAL', 'EXECUTING_REMEDIATION', 'VERIFYING', 'RESOLVED', 'ESCALATED'],
    ['INVESTIGATING', 'AUTO_REMEDIATING', 'AWAITING_VOICE_APPROVAL', 'EXECUTING_REMEDIATION', 'VERIFYING', 'RESOLVED', 'ESCALATED'],
    ['AUTO_REMEDIATING', 'AWAITING_VOICE_APPROVAL', 'EXECUTING_REMEDIATION', 'VERIFYING', 'RESOLVED'],
    ['VERIFYING', 'RESOLVED'],
  ];
  return order[step]?.includes(status) ?? false;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({
  incident,
  onOpenVoiceDrawer,
  onOpenPostMortem,
  onDismiss,
}) => {
  const [expanded, setExpanded] = useState(incident.status !== 'RESOLVED');
  const awaitingVoice = incident.status === 'AWAITING_VOICE_APPROVAL';
  const isTier1 = incident.riskTier === 'TIER_1_AUTO';
  const statusText = STATUS_LABEL[incident.status] ?? 'FIRING';
  const action = incident.diagnosis?.recommendedAction;
  const metricLine = `${incident.alert.metric} ${incident.alert.currentValue} (threshold ${incident.alert.thresholdValue})`;

  return (
    <div
      className={`mb-2 border bg-crt-panel font-mono text-xs ${
        awaitingVoice ? 'border-amber-term text-amber-term' : 'border-crt-line text-phosphor'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-black/20"
      >
        <span className="shrink-0 tracking-wide">{shortId(incident.id)}</span>
        <span className="shrink-0">{tierLabel(incident.riskTier)}</span>
        <span className="min-w-0 flex-1 truncate uppercase">{incident.alert.title}</span>
        <span className="shrink-0 tracking-widest">{statusText}</span>
      </button>

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-0 border-t ${awaitingVoice ? 'border-amber-term' : 'border-crt-line'}`}>
        <div className="p-3 border-b sm:border-b-0 sm:border-r border-crt-line">
          <div className="text-red-term text-[10px] tracking-widest mb-1">FAIL</div>
          <div className="text-phosphor">{incident.alert.service}</div>
          <div className="text-phosphor-dim mt-1">{incident.alert.description}</div>
          <div className="text-phosphor-dim mt-1 font-mono">{metricLine}</div>
        </div>
        <div className="p-3">
          <div className="text-phosphor-bright text-[10px] tracking-widest mb-1">REPAIR</div>
          <div className="text-phosphor">{action?.name || (isTier1 ? 'Idempotent runbook' : 'Voice-gated runbook')}</div>
          {action && <div className="text-phosphor-dim mt-1">{action.command}</div>}
          <div className="text-phosphor-dim mt-1">
            {isTier1 ? 'Runs without waking anyone.' : 'Needs spoken APPROVED on the call.'}
          </div>
        </div>
      </div>

      <div className={`flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 border-t text-[10px] text-phosphor-dim ${awaitingVoice ? 'border-amber-term' : 'border-crt-line'}`}>
        <span>{stepDone(incident.status, 0) ? '[x]' : '[ ]'} alert</span>
        <span>{stepDone(incident.status, 1) ? '[x]' : '[ ]'} diagnosed</span>
        <span>{stepDone(incident.status, 2) ? '[x]' : '[ ]'} {isTier1 ? 'auto-fix' : 'voice'}</span>
        <span>{incident.status === 'RESOLVED' ? '[x]' : '[ ]'} recovered</span>
      </div>

      {expanded && (
        <div className={`space-y-3 border-t px-3 py-3 ${awaitingVoice ? 'border-amber-term' : 'border-crt-line'}`}>
          {incident.diagnosis && (
            <div className="space-y-2 text-phosphor">
              <div className="text-[10px] tracking-widest text-phosphor-dim">DIAGNOSIS</div>
              <p className="leading-relaxed">{incident.diagnosis.rootCause}</p>
              <div className="space-y-0.5 text-phosphor-dim">
                {incident.diagnosis.evidence.map((ev, i) => (
                  <div key={i}>
                    <span aria-hidden="true">› </span>
                    {ev}
                  </div>
                ))}
              </div>
            </div>
          )}

          {incident.voiceCall && (
            <div className="border border-amber-term p-2 text-amber-term">
              <div>CALL-E → {incident.voiceCall.phone}</div>
              <div className="text-phosphor-dim">
                {incident.voiceCall.result?.spokenInstructions
                  ? `Engineer spoke: "${incident.voiceCall.result.spokenInstructions}"`
                  : 'Awaiting spoken approval.'}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {(awaitingVoice || incident.voiceCall) && (
              <button
                type="button"
                onClick={() => onOpenVoiceDrawer(incident)}
                className="border border-amber-term px-2 py-1 text-amber-term hover:bg-black/30"
              >
                {awaitingVoice ? '[ ANSWER CALL ]' : '[ TRANSCRIPT ]'}
              </button>
            )}
            {incident.postMortem && (
              <button
                type="button"
                onClick={() => onOpenPostMortem(incident)}
                className="border border-crt-line px-2 py-1 hover:bg-black/30"
              >
                [ POSTMORTEM ]
              </button>
            )}
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
