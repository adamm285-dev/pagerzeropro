import React, { useState } from 'react';
import { Incident } from '../types.js';
import { 
  CheckCircle2, 
  AlertTriangle, 
  PhoneCall, 
  Wrench, 
  FileText, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Terminal, 
  BedDouble, 
  Zap, 
  Sparkles
} from 'lucide-react';

interface IncidentCardProps {
  incident: Incident;
  onOpenVoiceDrawer: (incident: Incident) => void;
  onOpenPostMortem: (incident: Incident) => void;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({
  incident,
  onOpenVoiceDrawer,
  onOpenPostMortem,
}) => {
  const [expanded, setExpanded] = useState(true);

  const getStatusBadge = () => {
    switch (incident.status) {
      case 'RESOLVED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved & Recovered
          </span>
        );
      case 'AWAITING_VOICE_APPROVAL':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40 animate-pulse">
            <PhoneCall className="w-3.5 h-3.5" /> Calling for Voice Approval
          </span>
        );
      case 'AUTO_REMEDIATING':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Wrench className="w-3.5 h-3.5 animate-spin" /> Auto-Remediating (Sleep Mode)
          </span>
        );
      case 'INVESTIGATING':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-3.5 h-3.5 animate-spin" /> Diagnosing Root Cause
          </span>
        );
      case 'EXECUTING_REMEDIATION':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <Zap className="w-3.5 h-3.5 animate-bounce" /> Executing Approved Action
          </span>
        );
      case 'ESCALATED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
            <AlertTriangle className="w-3.5 h-3.5" /> Escalated to Human
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5" /> Alert Firing
          </span>
        );
    }
  };

  const getSeverityBadge = () => {
    const sev = incident.alert.severity;
    const color = sev === 'P1' ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold border ${color}`}>
        {sev}
      </span>
    );
  };

  const isTier1 = incident.riskTier === 'TIER_1_AUTO';

  return (
    <div className="bg-[#0e1626]/90 border border-slate-800 rounded-2xl p-5 mb-5 shadow-lg transition-all hover:border-slate-700/80">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-start sm:items-center gap-3">
          {getSeverityBadge()}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white">
                {incident.alert.title}
              </h3>
              <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {incident.alert.service}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <Clock className="w-3 h-3" />
              <span>{new Date(incident.createdAt).toLocaleTimeString()}</span>
              <span>·</span>
              <span className="font-mono text-[11px]">ID: {incident.id}</span>
              <span>·</span>
              <span className={`font-semibold ${isTier1 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isTier1 ? 'Tier 1: Safe Auto-Remediation' : 'Tier 2: Voice Approval Required'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {getStatusBadge()}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Progress Timeline Stepper */}
      <div className="py-4 px-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 relative">
          {/* Step 1 */}
          <div className="flex flex-col items-center gap-1 z-10">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold text-[10px]">
              ✓
            </div>
            <span>Alert Fired</span>
          </div>

          <div className="flex-1 h-0.5 bg-slate-800 mx-2 -mt-4">
            <div className={`h-full bg-emerald-500 transition-all ${incident.status !== 'FIRING' ? 'w-full' : 'w-0'}`} />
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center gap-1 z-10">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
              incident.status !== 'FIRING'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-500'
            }`}>
              {incident.status === 'INVESTIGATING' ? '…' : '✓'}
            </div>
            <span>AI Diagnosed</span>
          </div>

          <div className="flex-1 h-0.5 bg-slate-800 mx-2 -mt-4">
            <div className={`h-full bg-emerald-500 transition-all ${
              ['AUTO_REMEDIATING', 'AWAITING_VOICE_APPROVAL', 'EXECUTING_REMEDIATION', 'VERIFYING', 'RESOLVED'].includes(incident.status)
                ? 'w-full'
                : 'w-0'
            }`} />
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center gap-1 z-10">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
              ['AWAITING_VOICE_APPROVAL'].includes(incident.status)
                ? 'bg-amber-500 text-black animate-pulse'
                : ['EXECUTING_REMEDIATION', 'VERIFYING', 'RESOLVED'].includes(incident.status)
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-500'
            }`}>
              {isTier1 ? '🤖' : '📞'}
            </div>
            <span>{isTier1 ? 'Auto-Fix Policy' : 'Voice Approval'}</span>
          </div>

          <div className="flex-1 h-0.5 bg-slate-800 mx-2 -mt-4">
            <div className={`h-full bg-emerald-500 transition-all ${
              ['VERIFYING', 'RESOLVED'].includes(incident.status) ? 'w-full' : 'w-0'
            }`} />
          </div>

          {/* Step 4 */}
          <div className="flex flex-col items-center gap-1 z-10">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
              incident.status === 'RESOLVED'
                ? 'bg-emerald-500 text-black'
                : 'bg-slate-800 text-slate-500'
            }`}>
              {incident.status === 'RESOLVED' ? '✓' : '4'}
            </div>
            <span>Recovered</span>
          </div>
        </div>
      </div>

      {/* Expandable Details */}
      {expanded && (
        <div className="space-y-4 pt-3 border-t border-slate-800/80">
          {/* AI SRE Diagnosis Block */}
          {incident.diagnosis && (
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Autonomous SRE Diagnosis
                </span>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  Confidence: {((incident.diagnosis.confidence || 0.95) * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {incident.diagnosis.rootCause}
              </p>

              <div className="space-y-1 text-[11px] text-slate-400">
                {incident.diagnosis.evidence.map((ev, i) => (
                  <div key={i} className="flex items-start gap-1.5 font-mono">
                    <span className="text-emerald-500">›</span>
                    <span>{ev}</span>
                  </div>
                ))}
              </div>

              {/* Recommended Action */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Remediation Action
                  </span>
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Terminal className="w-3 h-3 text-emerald-400" />
                    {incident.diagnosis.recommendedAction.name}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 bg-black/40 px-2.5 py-1 rounded border border-slate-800">
                  {incident.diagnosis.recommendedAction.command}
                </span>
              </div>
            </div>
          )}

          {/* Voice Call Banner (If Tier 2 or voice call triggered) */}
          {incident.voiceCall && (
            <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <PhoneCall className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      CALL-E Phone Call to {incident.voiceCall.phone}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 uppercase">
                      {incident.voiceCall.result?.approvalStatus || incident.voiceCall.status}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-300/80 mt-0.5">
                    {incident.voiceCall.result?.spokenInstructions 
                      ? `Engineer spoke: "${incident.voiceCall.result.spokenInstructions}"`
                      : 'Call active - awaiting engineer spoken approval.'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onOpenVoiceDrawer(incident)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>{incident.status === 'AWAITING_VOICE_APPROVAL' ? 'Answer Call 📞' : 'View Audio & Transcript'}</span>
              </button>
            </div>
          )}

          {/* Tier 1 Sleep Banner */}
          {isTier1 && (
            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <BedDouble className="w-4 h-4" />
              </div>
              <div className="text-xs text-slate-300">
                <span className="font-bold text-emerald-400">Safe Policy Auto-Remediation: </span>
                This incident matched verified idempotent runbook. Resolved autonomously so the on-call engineer can sleep undisturbed.
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            {incident.postMortem && (
              <button
                onClick={() => onOpenPostMortem(incident)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition"
              >
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>View Incident Post-Mortem</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
