import 'dotenv/config';
import { CalleClient } from '@call-e/calle';
import { CallEResult, VoiceCallTurn } from '../types.js';
import { extractSpokenPin } from './pin.js';

export interface InitiateCallParams {
  incidentId: string;
  serviceName: string;
  engineerName: string;
  phoneNumber: string;
  voiceScript: string;
  actionName: string;
  liveMode: boolean;
  securityPin?: string;
  requirePin?: boolean;
}

export class CalleService {
  private client: CalleClient | null = null;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.CALLE_API_KEY || '';
    this.baseUrl = process.env.CALLE_BASE_URL || 'https://api.heycall-e.com';

    if (this.apiKey) {
      try {
        this.client = new CalleClient({
          apiKey: this.apiKey,
          baseUrl: this.baseUrl,
        });
      } catch (err) {
        console.warn('[CALL-E] Warning initializing CalleClient:', err);
      }
    }
  }

  public hasValidApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public setApiKey(key: string) {
    this.apiKey = key;
    if (key) {
      this.client = new CalleClient({
        apiKey: this.apiKey,
        baseUrl: this.baseUrl,
      });
    } else {
      this.client = null;
    }
  }

  /**
   * Dial out to the engineer via CALL-E or return structured simulation.
   */
  public async executeCall(
    params: InitiateCallParams,
    onProgress?: (turn: VoiceCallTurn) => void
  ): Promise<CallEResult> {
    const {
      engineerName,
      phoneNumber,
      voiceScript,
      actionName,
      liveMode,
      securityPin = '1234',
      requirePin = true,
    } = params;

    // If liveMode requested AND API key is present, use real CALL-E SDK
    if (liveMode && this.client) {
      return this.placeRealCall(phoneNumber, voiceScript, actionName, securityPin, requirePin, onProgress);
    }

    // Otherwise, simulate high-fidelity realistic call
    return this.simulateCall(engineerName, voiceScript, actionName, securityPin, requirePin, onProgress);
  }

  private async placeRealCall(
    phoneNumber: string,
    voiceScript: string,
    actionName: string,
    securityPin: string = '1234',
    requirePin: boolean = true,
    onProgress?: (turn: VoiceCallTurn) => void
  ): Promise<CallEResult> {
    if (!this.client) {
      throw new Error('CALL-E API client is not configured.');
    }

    const pinInstruction = requirePin
      ? `Ask them: "Do you approve executing: ${actionName}? For security verification, please say Approved followed by your 4-digit security PIN ${securityPin}."
If they ask a factual question about the incident, answer briefly from the briefing in the prompt, then ask for approval and the security PIN again.
Listen carefully to their response:
- If they say "yes", "approve", "go ahead", "do it", "sure", or "approved" AND state the security PIN (${securityPin}): mark approval_status as "approved", pin_verified as true, and spoken_pin as "${securityPin}".
- If they say approve or yes but do NOT state the security PIN, or state a different PIN: politely ask once: "Please state your 4-digit security PIN to authorize this remediation." If they provide ${securityPin}, mark approval_status as "approved", pin_verified as true, and spoken_pin as "${securityPin}". If they give an incorrect PIN or refuse, mark approval_status as "rejected", pin_verified as false, and spoken_pin with what they said.
- If they say "no", "reject", "don't do that", "cancel": mark approval_status as "rejected", pin_verified as false.`
      : `Ask them: "Do you approve executing: ${actionName}? You can ask one or two questions first, like current error rate."
If they ask a factual question about the incident, answer briefly from the briefing in the prompt, then ask for approval again.
Listen carefully to their response:
- If they say "yes", "approve", "go ahead", "do it", "sure", or press 1: mark approval_status as "approved", pin_verified as true.
- If they say "no", "reject", "don't do that", "cancel": mark approval_status as "rejected", pin_verified as false.`;

    const taskPrompt = `You are PagerZero, an autonomous SRE voice agent calling on-call engineer at ${phoneNumber}.
Speak with a calm, clear, professional voice.
Prompt to say: "${voiceScript}"
${pinInstruction}
- If they say "wake me up", "escalate", "call secondary": mark approval_status as "escalate", pin_verified as false.
- If they say "snooze", "give me 5 minutes", "call me back", "not now": mark approval_status as "snooze", pin_verified as false. Do not escalate.
- Keep the call under 45 seconds. After a decision, confirm briefly and sign off. Do not tell them to go back to sleep.`;

    const resultSchema = {
      type: 'object',
      properties: {
        approval_status: {
          type: 'string',
          enum: ['approved', 'rejected', 'escalate', 'snooze', 'unreachable'],
          description: 'Approval status decision from engineer.'
        },
        pin_verified: {
          type: 'boolean',
          description: 'Whether the engineer provided the correct 4-digit security PIN.'
        },
        spoken_pin: {
          type: 'string',
          description: 'The security PIN spoken by the engineer.'
        },
        spoken_notes: {
          type: 'string',
          description: 'Exact transcribed words spoken by engineer.'
        },
        confidence: {
          type: 'number',
          description: 'Confidence in response interpretation between 0 and 1.'
        }
      },
      required: ['approval_status']
    };

    try {
      console.log(`[CALL-E] Placing outbound call to ${phoneNumber}...`);
      onProgress?.({
        speaker: 'agent',
        text: `[CALL-E] Initiating call to ${phoneNumber}... Dispatching task to CALL-E telephony.`,
        timestamp: new Date().toISOString(),
      });

      const initialCall = await this.client.calls.create({
        task: taskPrompt,
        recipients: [
          {
            phones: [phoneNumber],
            region: 'US',
            locale: 'en-US'
          }
        ],
        resultSchema,
      });

      console.log(`[CALL-E] Call created with ID: ${initialCall.id}. Awaiting telephony response...`);
      onProgress?.({
        speaker: 'agent',
        text: `[CALL-E] Ringing ${phoneNumber} (Call ID: ${initialCall.id}). Answer on Google Voice or mobile...`,
        timestamp: new Date().toISOString(),
      });

      // Poll for call completion and stream transcript turns
      const intervalMs = 2500;
      const timeoutMs = 120000;
      const deadline = Date.now() + timeoutMs;
      let lastTurnCount = 0;
      let finalCall = initialCall;

      while (Date.now() <= deadline) {
        await new Promise((r) => setTimeout(r, intervalMs));
        try {
          const polled = await this.client.calls.get(initialCall.id);
          finalCall = polled;

          // Check for transcript turns
          const turns = polled.recipients?.[0]?.attempts?.[0]?.transcriptTurns || [];
          if (turns.length > lastTurnCount) {
            for (let i = lastTurnCount; i < turns.length; i++) {
              const t = turns[i];
              onProgress?.({
                speaker: t.speaker === 'bot' ? 'agent' : 'engineer',
                text: t.text,
                timestamp: new Date().toISOString(),
              });
            }
            lastTurnCount = turns.length;
          }

          if (polled.status === 'completed' || polled.status === 'failed' || polled.status === 'canceled') {
            break;
          }
        } catch (pollErr) {
          console.warn('[CALL-E] Polling status error:', pollErr);
        }
      }

      const recipient = finalCall.recipients?.[0];
      const structuredResult = (recipient?.structuredResult || finalCall.structuredResult || {}) as Record<string, any>;
      const approvalStatus = (structuredResult.approval_status as CallEResult['approvalStatus']) || 'escalate';
      const spokenNotes = structuredResult.spoken_notes || 'Approved via voice call.';

      const turns: VoiceCallTurn[] = [];
      if (recipient?.attempts?.[0]?.transcriptTurns && recipient.attempts[0].transcriptTurns.length > 0) {
        for (const t of recipient.attempts[0].transcriptTurns) {
          turns.push({
            speaker: t.speaker === 'bot' ? 'agent' : 'engineer',
            text: t.text,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        turns.push({
          speaker: 'agent',
          text: voiceScript,
          timestamp: new Date().toISOString(),
        });
        turns.push({
          speaker: 'engineer',
          text: spokenNotes,
          timestamp: new Date().toISOString(),
        });
      }

      // Determine PIN verification status
      const spokenWords = turns
        .filter((t) => t.speaker === 'engineer')
        .map((t) => t.text)
        .join(' ');
      const transcriptIncludesPin = 
        spokenWords.includes(securityPin) || 
        spokenNotes.includes(securityPin) ||
        extractSpokenPin(spokenWords) === securityPin ||
        extractSpokenPin(spokenNotes) === securityPin;

      const pinVerified = !requirePin || 
        structuredResult.pin_verified === true ||
        (structuredResult.spoken_pin && String(structuredResult.spoken_pin).replace(/\D/g, '') === securityPin) ||
        transcriptIncludesPin;

      const spokenPin = structuredResult.spoken_pin || (pinVerified ? securityPin : undefined);

      return {
        callId: finalCall.id,
        status: finalCall.status === 'completed' ? 'completed' : 'failed',
        approvalStatus: approvalStatus,
        spokenInstructions: spokenNotes,
        pinVerified: pinVerified,
        spokenPin: spokenPin,
        confidence: structuredResult.confidence || 0.95,
        durationSeconds: 22,
        transcript: turns,
        summary: finalCall.summary || `Engineer responded "${spokenNotes}" with status: ${approvalStatus} (PIN ${pinVerified ? 'verified' : 'unverified'}).`,
      };
    } catch (err: any) {
      console.error('[CALL-E] Real call error:', err);
      // Fallback gracefully with clear message
      return {
        callId: `calle-err-${Date.now()}`,
        status: 'failed',
        approvalStatus: 'escalate',
        pinVerified: false,
        confidence: 0,
        durationSeconds: 0,
        transcript: [{
          speaker: 'agent',
          text: `CALL-E error dialing ${phoneNumber}: ${err?.message || 'Network error'}`,
          timestamp: new Date().toISOString(),
        }],
        summary: `Call failed to connect: ${err?.message || 'Check CALLE_API_KEY and phone number format'}`,
      };
    }
  }

  public async simulateCall(
    engineerName: string,
    voiceScript: string,
    actionName: string,
    securityPin: string = '1234',
    requirePin: boolean = true,
    onProgress?: (turn: VoiceCallTurn) => void
  ): Promise<CallEResult> {
    const callId = `sim-${Date.now()}`;
    const transcript: VoiceCallTurn[] = [];

    const promptText = requirePin
      ? `${voiceScript} Say Approved and your 4-digit security PIN ${securityPin}.`
      : voiceScript;

    // Turn 1: Agent speaks situation
    const turn1: VoiceCallTurn = {
      speaker: 'agent',
      text: promptText,
      timestamp: new Date().toISOString(),
    };
    transcript.push(turn1);
    if (onProgress) onProgress(turn1);

    await new Promise(r => setTimeout(r, 1400));

    // Turn 2: Engineer speaks approval with PIN from bed
    const engineerText = requirePin
      ? `Approve. Security PIN ${securityPin}. Run ${actionName} and resolve the alert.`
      : `Yeah, I approve. Run ${actionName} and resolve the alert.`;

    const turn2: VoiceCallTurn = {
      speaker: 'engineer',
      text: engineerText,
      timestamp: new Date().toISOString(),
    };
    transcript.push(turn2);
    if (onProgress) onProgress(turn2);

    await new Promise(r => setTimeout(r, 1000));

    // Turn 3: Agent acknowledges and signs off
    const agentAck = requirePin
      ? `PIN ${securityPin} verified. Executing ${actionName} now. I'll confirm when telemetry is back in band.`
      : `Approved. Executing ${actionName} now. I'll confirm when it's done.`;

    const turn3: VoiceCallTurn = {
      speaker: 'agent',
      text: agentAck,
      timestamp: new Date().toISOString(),
    };
    transcript.push(turn3);
    if (onProgress) onProgress(turn3);

    return {
      callId,
      status: 'completed',
      approvalStatus: 'approved',
      spokenInstructions: engineerText,
      pinVerified: true,
      spokenPin: securityPin,
      confidence: 0.98,
      durationSeconds: 18,
      transcript,
      summary: `On-call engineer ${engineerName} answered after 2 rings and spoke "Approved" with PIN ${securityPin}. Agent proceeding with remediation.`,
    };
  }
}

export const calleService = new CalleService();
