import React, { useState, useEffect } from 'react';
import { Incident } from '../types.js';
import { 
  PhoneCall, 
  Mic, 
  MicOff, 
  Volume2, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Radio, 
  ShieldCheck 
} from 'lucide-react';

interface LiveVoiceDrawerProps {
  incident: Incident | null;
  onClose: () => void;
  onSubmitVoiceDecision: (incidentId: string, decision: 'approved' | 'rejected' | 'escalate', notes: string) => Promise<void>;
}

export const LiveVoiceDrawer: React.FC<LiveVoiceDrawerProps> = ({
  incident,
  onClose,
  onSubmitVoiceDecision,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [speechRecognized, setSpeechRecognized] = useState('');
  const [isSpeakingAgent, setIsSpeakingAgent] = useState(false);
  const [hasPlayedSpeech, setHasPlayedSpeech] = useState(false);

  const isAwaitingApproval = incident?.status === 'AWAITING_VOICE_APPROVAL';
  const voiceCall = incident?.voiceCall;
  const script = incident?.diagnosis?.voicePromptScript || 'PagerZero voice prompt';
  const actionName = incident?.diagnosis?.recommendedAction.name || 'Recommended fix';

  // Play browser Text-to-Speech when call opens (if in voice simulator mode)
  useEffect(() => {
    if (incident && isAwaitingApproval && !hasPlayedSpeech && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(script);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsSpeakingAgent(true);
      utterance.onend = () => setIsSpeakingAgent(false);
      utterance.onerror = () => setIsSpeakingAgent(false);
      window.speechSynthesis.cancel(); // clear previous
      window.speechSynthesis.speak(utterance);
      setHasPlayedSpeech(true);
    }
  }, [incident, isAwaitingApproval, script, hasPlayedSpeech]);

  if (!incident) return null;

  // Speech Recognition support (Web Speech API)
  const toggleListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. You can click the Approve/Reject buttons below.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      setSpeechRecognized(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (speechRecognized) {
        handleSpokenDecision(speechRecognized);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  const handleSpokenDecision = (text: string) => {
    const lower = text.toLowerCase();
    if (lower.includes('yes') || lower.includes('approve') || lower.includes('do it') || lower.includes('sure') || lower.includes('go ahead')) {
      onSubmitVoiceDecision(incident.id, 'approved', text);
    } else if (lower.includes('no') || lower.includes('reject') || lower.includes('cancel')) {
      onSubmitVoiceDecision(incident.id, 'rejected', text);
    } else {
      onSubmitVoiceDecision(incident.id, 'approved', text);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-[#0e1626] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <PhoneCall className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  CALL-E Phone Bridge
                </h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {voiceCall?.provider === 'calle_live' ? 'Live Telephony (+1)' : 'Interactive Voice Simulator'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Calling: {voiceCall?.phone || 'On-Call Engineer'} · Incident: {incident.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
          >
            Minimize
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Incoming Call Card */}
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col items-center text-center relative overflow-hidden">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center mb-3 animate-ring">
              <Radio className="w-8 h-8 text-emerald-400" />
            </div>
            <h4 className="text-lg font-bold text-white mb-1">
              PagerZero AI SRE on the Line
            </h4>
            <p className="text-xs text-slate-400 max-w-md mb-4">
              "{script}"
            </p>

            {/* Audio Wave Visualizer */}
            <div className="flex items-center gap-1 h-6 mb-2">
              {[40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 65, 30].map((h, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-300 ${
                    isSpeakingAgent || isListening
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-slate-700'
                  }`}
                  style={{ height: `${isSpeakingAgent ? h : 20}%` }}
                />
              ))}
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              {isSpeakingAgent ? 'Agent speaking prompt...' : 'Listening for your voice approval...'}
            </span>
          </div>

          {/* Turn-by-Turn Transcript */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Live Spoken Transcript
            </h5>
            <div className="space-y-3 bg-[#080d16] p-4 rounded-xl border border-slate-800/80 font-mono text-xs max-h-48 overflow-y-auto">
              {voiceCall?.result?.transcript && voiceCall.result.transcript.length > 0 ? (
                voiceCall.result.transcript.map((t, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg ${
                      t.speaker === 'agent'
                        ? 'bg-emerald-950/20 border border-emerald-500/20 text-emerald-200'
                        : 'bg-indigo-950/20 border border-indigo-500/20 text-indigo-200'
                    }`}
                  >
                    <span className="font-bold text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {t.speaker === 'agent' ? '🤖 Agent' : '👨‍💻 Engineer'}
                    </span>
                    <span className="flex-1 leading-relaxed">{t.text}</span>
                  </div>
                ))
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-2 rounded bg-emerald-950/20 border border-emerald-500/20 text-emerald-200">
                    <span className="font-bold text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      🤖 Agent
                    </span>
                    <span>{script}</span>
                  </div>
                  {speechRecognized && (
                    <div className="flex items-start gap-2 p-2 rounded bg-indigo-950/20 border border-indigo-500/20 text-indigo-200">
                      <span className="font-bold text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        👨‍💻 Engineer
                      </span>
                      <span>{speechRecognized}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Structured Schema Extraction Result (if completed) */}
          {voiceCall?.result && (
            <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> CALL-E Structured Schema Extraction
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                  Confidence: {((voiceCall.result.confidence || 0.98) * 100).toFixed(0)}%
                </span>
              </div>
              <pre className="text-[11px] font-mono bg-black/40 p-3 rounded-lg text-emerald-300 overflow-x-auto">
{JSON.stringify(
  {
    approval_status: voiceCall.result.approvalStatus,
    spoken_instructions: voiceCall.result.spokenInstructions,
    duration_seconds: voiceCall.result.durationSeconds,
    call_id: voiceCall.result.callId,
  },
  null,
  2
)}
              </pre>
            </div>
          )}

          {/* Action Decision Controls (When awaiting approval) */}
          {isAwaitingApproval && (
            <div className="pt-2 border-t border-slate-800">
              <p className="text-xs text-slate-400 text-center mb-3">
                Say your answer into your microphone or tap an action below to stay in bed:
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => onSubmitVoiceDecision(incident.id, 'approved', `Approved: Execute ${actionName}`)}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition transform hover:-translate-y-0.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve ("Do it")
                </button>

                <button
                  onClick={toggleListening}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm border transition ${
                    isListening
                      ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                  {isListening ? 'Listening...' : 'Speak Response 🎙️'}
                </button>

                <button
                  onClick={() => onSubmitVoiceDecision(incident.id, 'rejected', 'Rejected by engineer: Will investigate manually.')}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/40 font-bold text-sm transition"
                >
                  <XCircle className="w-4 h-4" />
                  Reject & Wake Me
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
