import React, { useEffect, useRef, useState } from 'react';
import { Incident, OnCallConfig } from '../types.js';
import { extractSpokenPin } from '../utils/pin.js';

interface LiveVoiceDrawerProps {
  incident: Incident | null;
  config?: OnCallConfig;
  onClose: () => void;
  onSubmitVoiceDecision: (
    incidentId: string,
    decision: 'approved' | 'rejected' | 'escalate' | 'snooze',
    notes: string,
    snoozeMs?: number,
    pin?: string
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
  config,
  onClose,
  onSubmitVoiceDecision,
  onAskQuestion,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [speechRecognized, setSpeechRecognized] = useState('');
  const [isSpeakingAgent, setIsSpeakingAgent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
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

  const isLiveCallMode = config?.callMode === 'calle_live';
  const securityPin = config?.securityPin || '1234';
  const requirePin = config?.requirePin ?? true;
  const targetPhone = config?.phoneNumber || incident?.voiceCall?.phone || '+15555550100';
  const [enteredPin, setEnteredPin] = useState(securityPin);

  useEffect(() => {
    setEnteredPin(config?.securityPin || '1234');
  }, [config?.securityPin]);

  useEffect(() => {
    spokenPromptId.current = null;
    spokenSignoffId.current = null;
    lastAgentLineRef.current = '';
    setSpeechRecognized('');
    recognizedRef.current = '';
    setSubmitting(false);
    setShowOverride(false);
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

  // Browser TTS only runs in simulator mode, NEVER in live phone call mode
  useEffect(() => {
    if (!incidentId || !isAwaitingApproval) return;
    if (isLiveCallMode) return;
    if (spokenPromptId.current === incidentId) return;
    spokenPromptId.current = incidentId;
    speak(
      script,
      () => setIsSpeakingAgent(true),
      () => setIsSpeakingAgent(false)
    );
  }, [incidentId, isAwaitingApproval, script, isLiveCallMode]);

  useEffect(() => {
    if (!incidentId || !lastAgentLine) return;
    if (isLiveCallMode) return;
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
  }, [incidentId, lastAgentLine, script, isResolved, isLiveCallMode]);

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
    decision: 'approved' | 'rejected' | 'escalate' | 'snooze',
    notes: string,
    snoozeMs?: number,
    pin?: string
  ) => {
    if (submitting || !isAwaitingApproval) return;
    setSubmitting(true);
    try {
      await onSubmitVoiceDecision(incident.id, decision, notes, snoozeMs, pin);
    } catch {
      setSubmitting(false);
    }
    if (decision === 'snooze') setSubmitting(false);
  };

  const handleSpokenDecision = (text: string) => {
    const lower = text.toLowerCase();
    const extractedPin = extractSpokenPin(text);

    if (
      lower.includes('yes') ||
      lower.includes('approve') ||
      lower.includes('do it') ||
      lower.includes('sure') ||
      lower.includes('go ahead')
    ) {
      if (requirePin && !extractedPin) {
        // Engineer approved verbally, but DID NOT speak the PIN!
        // We submit with NO PIN so server strictly enforces security rejection and escalation
        void submit('approved', text, undefined, undefined);
        return;
      }
      void submit('approved', text, undefined, extractedPin || undefined);
    } else if (lower.includes('no') || lower.includes('reject') || lower.includes('cancel')) {
      void submit('rejected', text);
    } else if (lower.includes('escalate') || lower.includes('wake')) {
      void submit('escalate', text);
    } else if (
      lower.includes('snooze') ||
      lower.includes('later') ||
      lower.includes('call back') ||
      lower.includes('give me') ||
      lower.includes('not now')
    ) {
      void submit('snooze', text);
    } else {
      void onAskQuestion(incident.id, text);
    }
  };

  const snoozing = Boolean(incident.snoozeUntil && Date.parse(incident.snoozeUntil) > Date.now());
  const statusLine = isResolved
    ? 'Closed. Signing off.'
    : isExecuting
      ? `Executing ${actionName}…`
      : snoozing
        ? `Snoozed until ${new Date(incident.snoozeUntil!).toLocaleTimeString()}. Will redial.`
        : isLiveCallMode
          ? `Outbound call placed via CALL-E to ${targetPhone}...`
          : isSpeakingAgent
            ? 'Agent speaking…'
            : 'Ask a question, say Approved, or Snooze.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg border-2 border-amber-term bg-crt-panel p-4 text-amber-term font-mono shadow-[0_0_40px_rgba(255,191,60,0.2)]">
        {/* Header Mode Badge */}
        {isLiveCallMode ? (
          <div className="text-center tracking-[0.25em] text-sm animate-term-blink text-phosphor-bright flex items-center justify-center gap-2">
            <span>📞</span>
            <span>CALL-E LIVE OUTBOUND CALL</span>
          </div>
        ) : (
          <div className="text-center tracking-[0.35em] text-sm animate-term-blink">
            INCOMING CALL (VOICE SIMULATOR)
          </div>
        )}

        <div className="mt-1 text-center text-sm text-amber-term-dim">
          {incident.alert.service} — {actionName}
        </div>
        <div className="mt-2 text-center text-xs text-amber-term-dim">{statusLine}</div>

        {/* Live Call Instructions for Google Voice / Mobile */}
        {isLiveCallMode && isAwaitingApproval && (
          <div className="mt-3 border border-phosphor/50 bg-phosphor/10 p-2.5 text-center text-xs text-phosphor">
            <div className="font-bold text-phosphor-bright flex items-center justify-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-phosphor-bright animate-ping" />
              <span>Ringing Google Voice / Phone: {targetPhone}</span>
            </div>
            <div className="mt-1 text-[11px] text-phosphor-dim">
              Answer the call on your phone or Google Voice tab and say:{' '}
              <span className="font-bold text-phosphor-bright">
                &quot;Approve {securityPin}&quot;
              </span>
            </div>
          </div>
        )}

        {/* Security PIN Badge */}
        {requirePin && (
          <div className="mt-2 flex items-center justify-between border border-amber-term/40 bg-amber-term/10 px-3 py-1.5 text-xs text-amber-term">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-term animate-pulse" />
              <span className="font-bold text-[11px]">SECURITY PIN:</span>
              <span className="font-mono bg-black/60 px-1.5 py-0.5 border border-amber-term/50 text-phosphor-bright font-bold text-xs">
                {securityPin}
              </span>
            </div>
            <div className="text-[10px] text-amber-term-dim">
              Say &quot;Approve {securityPin}&quot;
            </div>
          </div>
        )}

        {/* Live Call Transcript */}
        <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap border border-amber-term/40 bg-black/30 p-2 text-xs leading-relaxed text-phosphor">
          {transcript.length > 0
            ? transcript
                .map((t) => `${t.speaker === 'agent' ? 'agent>' : 'you>'} ${t.text}`)
                .join('\n')
            : isLiveCallMode
              ? `agent> [CALL-E] Calling ${targetPhone}... Line is ringing. Answer call and state your approval with PIN ${securityPin}.`
              : `agent> ${script}`}
          {speechRecognized ? `\nyou> ${speechRecognized}` : ''}
        </pre>

        {isResolved && (
          <div className="mt-2 text-center text-xs text-phosphor-bright font-bold">
            Approved. Fix ran. Service recovered.
          </div>
        )}

        {voiceCall?.result?.pinVerified !== undefined && (
          <div
            className={`mt-1 text-center text-xs font-bold ${
              voiceCall.result.pinVerified ? 'text-phosphor-bright' : 'text-red-term'
            }`}
          >
            {voiceCall.result.pinVerified
              ? `✓ Security PIN Verified (${voiceCall.result.spokenPin || securityPin})`
              : `✗ Security PIN Verification Failed`}
          </div>
        )}

        {callComplete &&
          voiceCall?.result?.approvalStatus &&
          voiceCall.result.approvalStatus !== 'approved' &&
          voiceCall.result.approvalStatus !== 'snooze' && (
            <div className="mt-2 text-center text-xs text-red-term">
              {voiceCall.result.approvalStatus.toUpperCase()} — fix was not run. Escalated.
            </div>
          )}

        {/* Action Controls */}
        {isAwaitingApproval && (
          <>
            {isLiveCallMode && !showOverride ? (
              <div className="mt-4 text-center space-y-2">
                <div className="text-xs text-amber-term animate-pulse">
                  Listening for decision on phone call ({targetPhone})...
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setShowOverride(true)}
                    className="text-[10px] text-amber-term-dim underline hover:text-amber-term"
                  >
                    [ Need manual fallback? Show Web Override Controls ]
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {isLiveCallMode && (
                  <div className="text-center text-[10px] text-amber-term-dim border-b border-amber-term/20 pb-1">
                    [ MANUAL WEB OVERRIDE ACTIVE ]
                  </div>
                )}

                {requirePin && (
                  <div className="flex items-center justify-center gap-2 text-xs py-0.5">
                    <span className="text-amber-term-dim text-[11px]">Authorize PIN:</span>
                    <input
                      type="text"
                      maxLength={6}
                      value={enteredPin}
                      onChange={(e) => setEnteredPin(e.target.value)}
                      className="w-20 px-2 py-0.5 bg-black/50 border border-amber-term/60 text-phosphor-bright font-mono text-center text-xs outline-none focus:border-phosphor-bright"
                      placeholder="1234"
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    disabled={submitting}
                    onClick={() =>
                      submit(
                        'approved',
                        requirePin
                          ? `Approved with PIN ${enteredPin}: Execute ${actionName}`
                          : `Approved: Execute ${actionName}`,
                        undefined,
                        requirePin ? enteredPin : undefined
                      )
                    }
                    className="border-2 border-phosphor-bright px-3 py-1.5 text-phosphor-bright hover:bg-phosphor-bright hover:text-crt-bg disabled:opacity-60 font-bold"
                  >
                    {requirePin
                      ? `[ APPROVE (PIN ${enteredPin}) — run fix ]`
                      : `[ APPROVED — run fix ]`}
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
                    onClick={() =>
                      submit('rejected', 'Rejected by engineer: Will investigate manually.')
                    }
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
                  <button
                    disabled={submitting}
                    onClick={() => submit('snooze', 'Give me 5 minutes', 5 * 60 * 1000)}
                    className="border border-amber-term px-3 py-1 text-amber-term hover:bg-amber-term/10 disabled:opacity-60"
                  >
                    [ SNOOZE 5 MIN ]
                  </button>
                </div>
              </div>
            )}
          </>
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
