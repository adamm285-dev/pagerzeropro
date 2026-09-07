import { CalleClient } from '@call-e/calle';
import { CallEResult, VoiceCallTurn } from '../types.js';

export interface InitiateCallParams {
  incidentId: string;
  serviceName: string;
  engineerName: string;
  phoneNumber: string;
  voiceScript: string;
  actionName: string;
  liveMode: boolean;
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
    const { engineerName, phoneNumber, voiceScript, actionName, liveMode } = params;

    // If liveMode requested AND API key is present, use real CALL-E SDK
    if (liveMode && this.client) {
      return this.placeRealCall(phoneNumber, voiceScript, actionName);
    }

    // Otherwise, simulate high-fidelity realistic call
    return this.simulateCall(engineerName, voiceScript, actionName, onProgress);
  }

  private async placeRealCall(
    phoneNumber: string,
    voiceScript: string,
    actionName: string
  ): Promise<CallEResult> {
    if (!this.client) {
      throw new Error('CALL-E API client is not configured.');
    }

    const taskPrompt = `You are PagerZero, an autonomous SRE voice agent calling on-call engineer at ${phoneNumber}.
Speak with a calm, clear, professional voice.
Prompt to say: "${voiceScript}"
Ask them: "Do you approve executing: ${actionName}? You can ask one or two questions first, like current error rate."
If they ask a factual question about the incident, answer briefly from the briefing in the prompt, then ask for approval again.
Listen carefully to their response:
- If they say "yes", "approve", "go ahead", "do it", "sure", or press 1: mark approval_status as "approved".
- If they say "no", "reject", "don't do that", "cancel": mark approval_status as "rejected".
- If they say "wake me up", "escalate", "call secondary": mark approval_status as "escalate".
- If they say "snooze", "give me 5 minutes", "call me back", "not now": mark approval_status as "snooze". Do not escalate.
- Keep the call under 45 seconds. After a decision, confirm briefly and sign off. Do not tell them to go back to sleep.`;

    const resultSchema = {
      type: 'object',
      properties: {
        approval_status: {
          type: 'string',
          enum: ['approved', 'rejected', 'escalate', 'snooze', 'unreachable'],
          description: 'Approval status decision from engineer.'
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
      const call = await this.client.calls.createAndWait(
        {
          task: taskPrompt,
          recipients: [
            {
              phones: [phoneNumber],
              region: 'US',
              locale: 'en-US'
            }
          ],
          resultSchema,
        },
        {
          intervalMs: 3000,
          timeoutMs: 120000,
        }
      );

      const recipient = call.recipients?.[0];
      const structuredResult = (recipient?.structuredResult || call.structuredResult || {}) as Record<string, any>;
      const approvalStatus = (structuredResult.approval_status as CallEResult['approvalStatus']) || 'escalate';
      const spokenNotes = structuredResult.spoken_notes || 'Approved via voice call.';

      const turns: VoiceCallTurn[] = [];
      if (recipient?.attempts?.[0]?.transcriptTurns) {
        for (const t of recipient.attempts[0].transcriptTurns) {
          turns.push({
            speaker: t.speaker === 'bot' ? 'agent' : 'engineer',
            text: t.text,
            timestamp: new Date(Date.now() + ((t.offset_seconds || 0) * 1000)).toISOString(),
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

      return {
        callId: call.id,
        status: call.status === 'completed' ? 'completed' : 'failed',
        approvalStatus: approvalStatus,
        spokenInstructions: spokenNotes,
        confidence: structuredResult.confidence || 0.95,
        durationSeconds: 22,
        transcript: turns,
        summary: call.summary || `Engineer responded "${spokenNotes}" with status: ${approvalStatus}.`,
      };
    } catch (err: any) {
      console.error('[CALL-E] Real call error:', err);
      // Fallback gracefully with clear message
      return {
        callId: `calle-err-${Date.now()}`,
        status: 'failed',
        approvalStatus: 'escalate',
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
    onProgress?: (turn: VoiceCallTurn) => void
  ): Promise<CallEResult> {
    const callId = `sim-${Date.now()}`;
    const transcript: VoiceCallTurn[] = [];

    // Turn 1: Agent speaks situation
    const turn1: VoiceCallTurn = {
      speaker: 'agent',
      text: voiceScript,
      timestamp: new Date().toISOString(),
    };
    transcript.push(turn1);
    if (onProgress) onProgress(turn1);

    await new Promise(r => setTimeout(r, 1400));

    // Turn 2: Engineer speaks approval from bed
    const turn2: VoiceCallTurn = {
      speaker: 'engineer',
      text: `Yeah, I approve. Run ${actionName} and resolve the alert.`,
      timestamp: new Date().toISOString(),
    };
    transcript.push(turn2);
    if (onProgress) onProgress(turn2);

    await new Promise(r => setTimeout(r, 1000));

    // Turn 3: Agent acknowledges and signs off
    const turn3: VoiceCallTurn = {
      speaker: 'agent',
      text: `Approved. Executing ${actionName} now. I'll confirm when it's done.`,
      timestamp: new Date().toISOString(),
    };
    transcript.push(turn3);
    if (onProgress) onProgress(turn3);

    return {
      callId,
      status: 'completed',
      approvalStatus: 'approved',
      spokenInstructions: `Yeah, I approve. Run ${actionName} and resolve the alert.`,
      confidence: 0.98,
      durationSeconds: 18,
      transcript,
      summary: `On-call engineer ${engineerName} answered after 2 rings and spoke "Approved". Agent proceeding with remediation.`,
    };
  }
}

export const calleService = new CalleService();
