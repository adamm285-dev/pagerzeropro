import React, { useEffect, useRef, useState } from 'react';
import { Incident } from '../types.js';

interface LiveVoiceDrawerProps {
  incident: Incident | null;
  onClose: () => void;
  onSubmitVoiceDecision: (
    incidentId: string,
    decision: 'approved' | 'rejected' | 'escalate',
    notes: string
  ) => Promise<void>;
  onAskQuestion: (incidentId: string, question: string) => Promise<void>;
}

function speak(text: string, onStart?: () => void, onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}

export const LiveVoiceDrawer: React.FC<LiveVoiceDrawerProps> = ({
  incident,
  onClose,
  onSubmitVoiceDecision,
  onAskQuestion,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [speechRecognized, setSpeechRecognized] = useState('');
  const [isSpeakingAgent, setIsSpeakingAgent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const recognizedRef = useRef('');
  const spokenPromptId = useRef<string | null>(null);
  const spokenSignoffId = useRef<string | null>(null);
  const lastAgentLineRef = useRef<string>('');

  const incidentId = incident?.id;
  const isAwaitingApproval = incident?.status === 'AWAITING_VOICE_APPROVAL';
  const isResolved = incident?.status === 'RESOLVED';
  const isExecuting =
    incident?.status === 'EXECUTING_REMEDIATION' || incident?.status === 'VERIFYING';
  const voiceCall = incident?.voiceCall;
  const script = incident?.diagnosis?.voicePromptScript || 'PagerZero voice prompt';
  const actionName = incident?.diagnosis?.recommendedAction.name || 'Recommended fix';
  const transcript = voiceCall?.result?.transcript || [];
  const lastAgentLine = [...transcript].reverse().find((t) => t.speaker === 'agent')?.text || '';
  const callComplete = voiceCall?.result?.status === 'completed';

  useEffect(() => {
    spokenPromptId.current = null;
    spokenSignoffId.current = null;
    lastAgentLineRef.current = '';
    setSpeechRecognized('');
    recognizedRef.current = '';
    setSubmitting(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [incidentId]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!incidentId || !isAwaitingApproval) return;
    if (spokenPromptId.current === incidentId) return;
    spokenPromptId.current = incidentId;
    speak(
      script,
      () => setIsSpeakingAgent(true),
      () => setIsSpeakingAgent(false)
    );
  }, [incidentId, isAwaitingApproval, script]);

  useEffect(() => {
    if (!incidentId || !lastAgentLine) return;
    if (lastAgentLine === script) return;
    if (lastAgentLine === lastAgentLineRef.current) return;
    lastAgentLineRef.current = lastAgentLine;
    if (spokenPromptId.current !== incidentId) return;
    speak(
      lastAgentLine,
      () => setIsSpeakingAgent(true),
      () => setIsSpeakingAgent(false)
    );
    if (isResolved) spokenSignoffId.current = incidentId;
  }, [incidentId, lastAgentLine, script, isResolved]);

  if (!incident) return null;

  const toggleListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Use Approve or Reject.');
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
      const text = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      recognizedRef.current = text;
      setSpeechRecognized(text);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (recognizedRef.current) handleSpokenDecision(recognizedRef.current);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  const submit = async (
    decision: 'approved' | 'rejected' | 'escalate',
    notes: string
  ) => {
    if (submitting || !isAwaitingApproval) return;
    setSubmitting(true);
    try {
      await onSubmitVoiceDecision(incident.id, decision, notes);
    } catch {
      setSubmitting(false);
    }
  };

  const handleSpokenDecision = (text: string) => {
    const lower = text.toLowerCase();
    if (
      lower.includes('yes') ||
      lower.includes('approve') ||
      lower.includes('do it') ||
      lower.includes('sure') ||
      lower.includes('go ahead')
    ) {
      void submit('approved', text);
    } else if (lower.includes('no') || lower.includes('reject') || lower.includes('cancel')) {
      void submit('rejected', text);
    } else if (lower.includes('escalate') || lower.includes('wake')) {
      void submit('escalate', text);
    } else {
      void onAskQuestion(incident.id, text);
    }
  };

  const statusLine = isResolved
    ? 'Closed. Signing off.'
    : isExecuting
      ? `Executing ${actionName}…`
      : isSpeakingAgent
        ? 'Agent speaking…'
        : 'Ask a question, or say Approved.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg border-2 border-amber-term bg-crt-panel p-4 text-amber-term font-mono shadow-[0_0_40px_rgba(255,191,60,0.2)]">
        <div className="text-center tracking-[0.35em] text-sm animate-term-blink">INCOMING CALL</div>
        <div className="mt-1 text-center text-sm text-amber-term-dim">
          {incident.alert.service} — {actionName}
        </div>
        <div className="mt-2 text-center text-xs text-amber-term-dim">{statusLine}</div>

        <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap border border-amber-term/40 bg-black/30 p-2 text-xs leading-relaxed text-phosphor">
          {transcript.length > 0
            ? transcript
                .map((t) => `${t.speaker === 'agent' ? 'agent>' : 'you>'} ${t.text}`)
                .join('\n')
            : `agent> ${script}`}
          {speechRecognized ? `\nyou> ${speechRecognized}` : ''}
        </pre>

        {isResolved && (
          <div className="mt-2 text-center text-xs text-phosphor-bright">
            Approved. Fix ran. Service recovered.
          </div>
        )}

        {callComplete && voiceCall?.result?.approvalStatus && voiceCall.result.approvalStatus !== 'approved' && (
          <div className="mt-2 text-center text-xs text-red-term">
            {voiceCall.result.approvalStatus.toUpperCase()} — fix was not run. Escalated.
          </div>
        )}

        {isAwaitingApproval && (
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                disabled={submitting}
                onClick={() => submit('approved', `Approved: Execute ${actionName}`)}
                className="border-2 border-phosphor-bright px-3 py-1.5 text-phosphor-bright hover:bg-phosphor-bright hover:text-crt-bg disabled:opacity-60"
              >
                [ APPROVED — run fix ]
              </button>
              <button
                disabled={submitting}
                onClick={toggleListening}
                className={`border border-amber-term px-3 py-1.5 hover:bg-amber-term hover:text-crt-bg disabled:opacity-60 ${
                  isListening ? 'bg-amber-term text-crt-bg' : ''
                }`}
              >
                {isListening ? '[ MIC ON ]' : '[ MIC ]'}
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1">
              {[
                'What is the error rate right now?',
                'What is the recommended fix?',
                'How is the disk looking?',
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={submitting}
                  onClick={() => onAskQuestion(incident.id, q)}
                  className="border border-crt-line px-2 py-0.5 text-[10px] text-phosphor hover:bg-phosphor/10 disabled:opacity-60"
                >
                  {q.replace(' right now?', '?').replace('What is the ', '')}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                disabled={submitting}
                onClick={() => submit('rejected', 'Rejected by engineer: Will investigate manually.')}
                className="border border-red-term px-3 py-1 text-red-term hover:bg-red-term/10 disabled:opacity-60"
              >
                [ REJECT — skip fix ]
              </button>
              <button
                disabled={submitting}
                onClick={() => submit('escalate', 'Escalated by engineer.')}
                className="border border-red-term px-3 py-1 text-red-term hover:bg-red-term/10 disabled:opacity-60"
              >
                [ ESCALATE — skip fix ]
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 text-center">
          <button
            onClick={onClose}
            className="border border-amber-term/50 px-3 py-1 text-amber-term-dim hover:border-amber-term hover:text-amber-term"
          >
            [ ESC ]
          </button>
        </div>
      </div>
    </div>
  );
};
