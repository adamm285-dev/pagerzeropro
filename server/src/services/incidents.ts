import { v4 as uuidv4 } from 'uuid';
import { 
  Incident, 
  AlertPayload, 
  IncidentStatus, 
  OnCallConfig, 
  VoiceCallTurn, 
  CallEResult,
  MetricSnapshot
} from '../types.js';
import { diagnosticsEngine } from './diagnostics.js';
import { clusterSimulator } from './cluster.js';
import { calleService } from './calle.js';
import { discordNotifier } from './discord.js';

type IncidentListener = (event: { type: string; incident: Incident; data?: any }) => void;

type VoiceDecision = {
  approvalStatus: 'approved' | 'rejected' | 'escalate';
  spokenInstructions: string;
};

class IncidentManager {
  private incidents: Map<string, Incident> = new Map();
  private listeners: Set<IncidentListener> = new Set();
  private voiceWaiters: Map<string, { resolve: (decision: VoiceDecision | null) => void; timer: ReturnType<typeof setTimeout> }> = new Map();
  
  public config: OnCallConfig = {
    engineerName: process.env.ON_CALL_NAME || 'Adam (Primary SRE)',
    phoneNumber: process.env.ON_CALL_PHONE || '+15551234567',
    callMode: (process.env.CALLE_API_KEY ? 'calle_live' : 'voice_simulator') as any,
    autoApproveTier1: true,
    quietHours: {
      enabled: true,
      start: '22:00',
      end: '07:00',
    },
    escalationTimeoutSeconds: 45,
    shadowMode: process.env.SHADOW_MODE === 'true',
  };

  constructor() {}

  public subscribe(listener: IncidentListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private broadcast(type: string, incident: Incident, data?: any) {
    for (const listener of this.listeners) {
      try {
        listener({ type, incident, data });
      } catch (err) {
        console.error('Error in incident listener:', err);
      }
    }
  }

  public getAll(): Incident[] {
    return Array.from(this.incidents.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getById(id: string): Incident | undefined {
    return this.incidents.get(id);
  }

  public clearIncidents(scope: 'resolved' | 'all' = 'resolved'): { cleared: number; remaining: number } {
    const ids = Array.from(this.incidents.values())
      .filter((inc) => scope === 'all' || inc.status === 'RESOLVED' || inc.status === 'ESCALATED')
      .map((inc) => inc.id);

    for (const id of ids) {
      this.cancelVoiceWait(id);
      this.incidents.delete(id);
    }

    this.broadcastListCleared(scope, ids);
    return { cleared: ids.length, remaining: this.incidents.size };
  }

  public deleteIncident(id: string): boolean {
    const existing = this.incidents.get(id);
    if (!existing) return false;
    this.cancelVoiceWait(id);
    this.incidents.delete(id);
    this.broadcastListCleared('one', [id]);
    return true;
  }

  private broadcastListCleared(scope: string, ids: string[]) {
    const empty = {
      id: 'cleared',
      alert: {} as Incident['alert'],
      status: 'RESOLVED' as const,
      riskTier: 'TIER_1_AUTO' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [],
    };
    for (const listener of this.listeners) {
      try {
        listener({
          type: 'incidents_cleared',
          incident: empty,
          data: { scope, ids, incidents: this.getAll() },
        });
      } catch (err) {
        console.error('Error in incident listener:', err);
      }
    }
  }

  public updateConfig(newConfig: Partial<OnCallConfig>) {
    this.config = { ...this.config, ...newConfig };
    return this.config;
  }

  /**
   * Main Alert Ingestion and Autonomous Decision Pipeline
   */
  public async handleAlert(alert: AlertPayload): Promise<Incident> {
    const incidentId = `inc-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    const incident: Incident = {
      id: incidentId,
      alert,
      status: 'FIRING',
      riskTier: 'TIER_1_AUTO',
      createdAt: now,
      updatedAt: now,
      timeline: [
        {
          timestamp: now,
          status: 'FIRING',
          message: `Alert received from ${alert.source}: ${alert.title}`,
        }
      ],
    };

    this.incidents.set(incidentId, incident);
    this.broadcast('incident_created', incident);

    // Run diagnostics asynchronously to not block webhook response
    this.processIncident(incidentId).catch(err => {
      console.error(`[INCIDENT] Error processing incident ${incidentId}:`, err);
    });

    return incident;
  }

  private async processIncident(incidentId: string) {
    const incident = this.incidents.get(incidentId);
    if (!incident) return;

    // Step 1: Investigation & SRE Diagnostics
    this.updateStatus(incident, 'INVESTIGATING', 'AI SRE Agent analyzing logs, metrics, and incident runbooks...');
    await new Promise(r => setTimeout(r, 1000));

    const diagnosis = diagnosticsEngine.diagnose(incident.alert, this.config.engineerName);
    incident.diagnosis = diagnosis;
    incident.riskTier = diagnosis.riskTier;
    incident.updatedAt = new Date().toISOString();

    this.broadcast('incident_diagnosed', incident);

    // Step 2: Policy Decision based on Risk Tier
    const autoFixTier1 = diagnosis.riskTier === 'TIER_1_AUTO' && this.config.autoApproveTier1;
    const needsVoice =
      diagnosis.riskTier === 'TIER_2_VOICE_APPROVAL' ||
      (diagnosis.riskTier === 'TIER_1_AUTO' && !this.config.autoApproveTier1);

    if (autoFixTier1) {
      // PATH A: Tier 1 Auto-Remediation (Stay Asleep!)
      this.updateStatus(
        incident,
        'AUTO_REMEDIATING',
        `Tier 1 Safe Action Identified: "${diagnosis.recommendedAction.name}". Executing autonomously without waking on-call engineer.`
      );
      await this.executeRemediation(incident);

    } else if (needsVoice) {
      const timeoutMs = Math.max(5, this.config.escalationTimeoutSeconds) * 1000;
      const decisionPromise = this.waitForVoiceDecision(incident.id, timeoutMs);

      // PATH B: Tier 2 Voice Approval via CALL-E ("Stay in Bed")
      this.updateStatus(
        incident,
        'AWAITING_VOICE_APPROVAL',
        `High-impact action requires human approval. Initiating CALL-E voice call to ${this.config.engineerName} (${this.config.phoneNumber}).`
      );

      incident.voiceCall = {
        callId: `call-${uuidv4().slice(0, 8)}`,
        phone: this.config.phoneNumber,
        provider: this.config.callMode,
        status: 'ringing',
        startedAt: new Date().toISOString(),
        result: {
          callId: '',
          status: 'in_progress',
          approvalStatus: 'unreachable',
          confidence: 0,
          durationSeconds: 0,
          transcript: [],
          summary: '',
        },
      };
      if (incident.voiceCall.result) {
        incident.voiceCall.result.callId = incident.voiceCall.callId;
      }
      this.broadcast('voice_call_started', incident);

      const liveMode = this.config.callMode === 'calle_live' && calleService.hasValidApiKey();

      if (liveMode) {
        const callPromise = calleService.executeCall(
          {
            incidentId: incident.id,
            serviceName: incident.alert.service,
            engineerName: this.config.engineerName,
            phoneNumber: this.config.phoneNumber,
            voiceScript: diagnosis.voicePromptScript,
            actionName: diagnosis.recommendedAction.name,
            liveMode: true,
          },
          (turn: VoiceCallTurn) => this.appendCallTurn(incident, turn)
        );

        const winner = await Promise.race([
          decisionPromise.then((d) => ({ kind: 'dashboard' as const, decision: d })),
          callPromise.then((c) => ({ kind: 'calle' as const, call: c })),
        ]);

        if (winner.kind === 'dashboard' && winner.decision) {
          this.applyCallResult(incident, {
            callId: incident.voiceCall.callId,
            status: 'completed',
            approvalStatus: winner.decision.approvalStatus,
            spokenInstructions: winner.decision.spokenInstructions,
            confidence: 0.99,
            durationSeconds: 15,
            transcript: incident.voiceCall.result?.transcript || [],
            summary: `Engineer approved from the dashboard while CALL-E was dialing.`,
          });
          if (winner.decision.approvalStatus === 'approved') {
            this.updateStatus(
              incident,
              'EXECUTING_REMEDIATION',
              `Voice Approval Received from ${this.config.engineerName}: "${winner.decision.spokenInstructions}". Executing approved action.`
            );
            await this.executeRemediation(incident);
          } else {
            this.updateStatus(
              incident,
              'ESCALATED',
              `Engineer responded "${winner.decision.approvalStatus}". Escalating.`
            );
          }
          return;
        }

        if (winner.kind === 'calle') {
          this.cancelVoiceWait(incident.id);
          this.applyCallResult(incident, winner.call);
          if (winner.call.approvalStatus === 'approved') {
            this.updateStatus(
              incident,
              'EXECUTING_REMEDIATION',
              `Voice Approval Received from ${this.config.engineerName}: "${winner.call.spokenInstructions}". Executing approved action.`
            );
            await this.executeRemediation(incident);
          } else {
            this.updateStatus(
              incident,
              'ESCALATED',
              `Voice call outcome: ${winner.call.approvalStatus}. Escalating incident.`
            );
          }
          return;
        }

        this.updateStatus(
          incident,
          'ESCALATED',
          `No spoken approval within ${this.config.escalationTimeoutSeconds}s. Escalating to secondary on-call.`
        );
        return;
      }

      // Voice simulator: speak the prompt, then wait for dashboard / mic decision.
      this.appendCallTurn(incident, {
        speaker: 'agent',
        text: diagnosis.voicePromptScript,
        timestamp: new Date().toISOString(),
      });
      incident.voiceCall.status = 'in_progress';
      this.broadcast('incident_updated', incident);

      const decision = await decisionPromise;

      if (!decision) {
        this.updateStatus(
          incident,
          'ESCALATED',
          `No spoken approval within ${this.config.escalationTimeoutSeconds}s. Escalating to secondary on-call.`
        );
        if (incident.voiceCall) {
          incident.voiceCall.status = 'failed';
          incident.voiceCall.completedAt = new Date().toISOString();
        }
        return;
      }

      this.applyCallResult(incident, {
        callId: incident.voiceCall.callId,
        status: 'completed',
        approvalStatus: decision.approvalStatus,
        spokenInstructions: decision.spokenInstructions,
        confidence: 0.99,
        durationSeconds: 15,
        transcript: incident.voiceCall.result?.transcript || [],
        summary: `Engineer responded via voice simulator: "${decision.spokenInstructions}".`,
      });

      if (decision.approvalStatus === 'approved') {
        this.updateStatus(
          incident,
          'EXECUTING_REMEDIATION',
          `Voice Approval Received from ${this.config.engineerName}: "${decision.spokenInstructions}". Executing approved action.`
        );
        await this.executeRemediation(incident);
      } else {
        this.updateStatus(
          incident,
          'ESCALATED',
          `Engineer responded "${decision.approvalStatus}" ("${decision.spokenInstructions}"). Escalating to secondary on-call.`
        );
      }

    } else {
      // PATH C: Escalated
      this.updateStatus(
        incident,
        'ESCALATED',
        `Unknown root cause or severe risk. Escalating directly to high-priority alert.`
      );
    }
  }

  /**
   * Execute remediation action and verify system recovery
   */
  public async executeRemediation(incident: Incident) {
    if (!incident.diagnosis) return;

    const action = incident.diagnosis.recommendedAction;
    const serviceId = incident.alert.service;
    const preMetrics = clusterSimulator.getSnapshot(serviceId);
    const executedAt = new Date().toISOString();
    const shadow = this.config.shadowMode;

    const result = shadow
      ? {
          success: true,
          logs: [
            `[SHADOW] Would execute ${action.id} on ${serviceId}: ${action.command}`,
            '[SHADOW] Cluster left unchanged. No production mutation.',
          ],
        }
      : await clusterSimulator.executeRemediation(action.id, serviceId);
    const postMetrics = clusterSimulator.getSnapshot(serviceId);

    incident.remediation = {
      actionTaken: action,
      executedAt,
      completedAt: new Date().toISOString(),
      logs: result.logs,
      success: result.success,
      preMetrics,
      postMetrics,
    };

    if (result.success) {
      this.updateStatus(
        incident,
        'VERIFYING',
        shadow
          ? 'SHADOW: skipped execution. Logging intended health poll.'
          : 'Action executed. Polling health for canary window...'
      );

      const pollMs = Number(process.env.HEALTH_POLL_MS || 2500);
      const worse = shadow
        ? false
        : await this.pollForRegression(serviceId, preMetrics, pollMs);

      if (worse) {
        clusterSimulator.restoreSnapshot(serviceId, preMetrics);
        const rolled = clusterSimulator.getSnapshot(serviceId);
        incident.remediation.logs.push(
          `[ROLLBACK] Health worsened after ${action.id}. Restored pre-change snapshot.`,
          `[ROLLBACK] ${action.rollbackPlan}`
        );
        incident.remediation.success = false;
        incident.remediation.postMetrics = rolled;
        incident.remediation.completedAt = new Date().toISOString();
        this.updateStatus(
          incident,
          'ESCALATED',
          `Canary failed. Rolled back "${action.name}" and paging secondary.`
        );
        return;
      }

      const verified = clusterSimulator.getSnapshot(serviceId);
      incident.remediation.postMetrics = verified;
      incident.remediation.completedAt = new Date().toISOString();

      this.updateStatus(
        incident,
        'RESOLVED',
        shadow
          ? `SHADOW: would have run "${action.name}". Cluster unchanged.`
          : `Telemetry verified healthy. Service recovered. Incident automatically closed.`
      );
      incident.resolvedAt = new Date().toISOString();
      incident.postMortem = this.generatePostMortem(incident);

      const signoff = `Confirmed. ${serviceId} is healthy. Latency ${verified.latencyMs}ms, error rate ${verified.errorRatePercent}%. Signing off.`;
      this.appendCallTurn(incident, {
        speaker: 'agent',
        text: signoff,
        timestamp: new Date().toISOString(),
      });
      this.broadcast('incident_resolved', incident);
    } else {
      this.updateStatus(
        incident,
        'ESCALATED',
        `Remediation action failed. Escalating to human SRE.`
      );
    }
  }

  private metricsWorse(pre: MetricSnapshot, now: MetricSnapshot): boolean {
    const errUp = now.errorRatePercent > pre.errorRatePercent + 2;
    const latUp = now.latencyMs > pre.latencyMs * 1.5 + 50;
    return errUp || latUp;
  }

  private async pollForRegression(
    serviceId: string,
    pre: MetricSnapshot,
    budgetMs: number
  ): Promise<boolean> {
    const step = Math.max(80, Math.min(400, Math.floor(budgetMs / 5)));
    const deadline = Date.now() + budgetMs;
    while (Date.now() < deadline) {
      const sample = clusterSimulator.pollHealth(serviceId);
      if (this.metricsWorse(pre, sample)) return true;
      await new Promise((r) => setTimeout(r, step));
    }
    return this.metricsWorse(pre, clusterSimulator.pollHealth(serviceId));
  }

  /**
   * Manual voice approval trigger (useful for the Web Voice Simulator widget)
   */
  public async submitVoiceDecision(
    incidentId: string, 
    approvalStatus: 'approved' | 'rejected' | 'escalate', 
    spokenInstructions: string
  ) {
    const incident = this.incidents.get(incidentId);
    if (!incident || incident.status !== 'AWAITING_VOICE_APPROVAL') {
      throw new Error('Incident is not awaiting voice approval');
    }

    this.appendCallTurn(incident, {
      speaker: 'engineer',
      text: spokenInstructions,
      timestamp: new Date().toISOString(),
    });
    this.appendCallTurn(incident, {
      speaker: 'agent',
      text:
        approvalStatus === 'approved'
          ? `Got it. Executing ${incident.diagnosis?.recommendedAction.name || 'the fix'} now. I'll confirm when telemetry is back in band.`
          : `Heard you. Not executing. Escalating so a human can take it.`,
      timestamp: new Date().toISOString(),
    });

    const waiter = this.voiceWaiters.get(incidentId);
    if (waiter) {
      waiter.resolve({ approvalStatus, spokenInstructions });
      return;
    }

    throw new Error('Incident is not awaiting voice approval');
  }

  private cancelVoiceWait(incidentId: string) {
    const waiter = this.voiceWaiters.get(incidentId);
    if (!waiter) return;
    clearTimeout(waiter.timer);
    this.voiceWaiters.delete(incidentId);
  }

  private waitForVoiceDecision(incidentId: string, timeoutMs: number): Promise<VoiceDecision | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.voiceWaiters.delete(incidentId);
        resolve(null);
      }, timeoutMs);

      this.voiceWaiters.set(incidentId, {
        timer,
        resolve: (decision) => {
          clearTimeout(timer);
          this.voiceWaiters.delete(incidentId);
          resolve(decision);
        },
      });
    });
  }

  private appendCallTurn(incident: Incident, turn: VoiceCallTurn) {
    if (!incident.voiceCall) return;
    if (!incident.voiceCall.result) {
      incident.voiceCall.result = {
        callId: incident.voiceCall.callId,
        status: 'in_progress',
        approvalStatus: 'unreachable',
        confidence: 0,
        durationSeconds: 0,
        transcript: [],
        summary: '',
      };
    }
    incident.voiceCall.result.transcript.push(turn);
    this.broadcast('voice_call_turn', incident, turn);
  }

  private applyCallResult(incident: Incident, callResult: CallEResult) {
    if (!incident.voiceCall) return;
    const existingTurns = incident.voiceCall.result?.transcript || [];
    incident.voiceCall.result = {
      ...callResult,
      transcript: callResult.transcript.length > 0 ? callResult.transcript : existingTurns,
    };
    incident.voiceCall.status = callResult.status === 'completed' ? 'completed' : 'failed';
    incident.voiceCall.completedAt = new Date().toISOString();
    this.broadcast('incident_updated', incident);
  }

  private updateStatus(incident: Incident, status: IncidentStatus, message: string) {
    incident.status = status;
    incident.updatedAt = new Date().toISOString();
    incident.timeline.push({
      timestamp: incident.updatedAt,
      status,
      message,
    });
    this.broadcast('incident_updated', incident, { message });
    if (
      status === 'AWAITING_VOICE_APPROVAL' ||
      status === 'AUTO_REMEDIATING' ||
      status === 'RESOLVED' ||
      status === 'ESCALATED'
    ) {
      discordNotifier.notifyIncident(incident, message);
    }
  }

  private generatePostMortem(incident: Incident): string {
    const d = incident.diagnosis;
    const r = incident.remediation;
    const v = incident.voiceCall?.result;

    return `# Incident Post-Mortem: ${incident.alert.title}
**Incident ID:** \`${incident.id}\`  
**Service:** \`${incident.alert.service}\`  
**Severity:** ${incident.alert.severity}  
**Risk Tier:** ${incident.riskTier}  
**Resolved At:** ${incident.resolvedAt || 'N/A'}  
**On-Call Engineer:** ${this.config.engineerName}  

---

## 1. Summary
At ${incident.createdAt}, an alert fired from **${incident.alert.source}** indicating **${incident.alert.title}**.
The PagerZero AI SRE agent analyzed the alert within seconds and identified the root cause as:
> *${d?.rootCause || 'Root cause analyzed by diagnostic engine'}*

---

## 2. Decision & Voice Approval
- **Decision Tier:** \`${incident.riskTier}\`
${incident.riskTier === 'TIER_1_AUTO' 
  ? `- **Autonomous Resolution:** Marked as safe and idempotent. Remediated without waking the engineer.`
  : `- **Voice Approval Call:** A CALL-E phone call was placed to ${this.config.phoneNumber}.
  - **Spoken Input:** "${v?.spokenInstructions || 'Approved'}"
  - **Outcome:** ${v?.approvalStatus} (Confidence: ${((v?.confidence || 1) * 100).toFixed(0)}%)`}

---

## 3. Remediation Action Executed
- **Action:** \`${r?.actionTaken.name}\`
- **Command:** \`${r?.actionTaken.command}\`
- **Pre-Remediation Telemetry:**
  - Latency: ${r?.preMetrics.latencyMs}ms | Error Rate: ${r?.preMetrics.errorRatePercent}% | CPU: ${r?.preMetrics.cpuPercent}%
- **Post-Remediation Telemetry:**
  - Latency: ${r?.postMetrics?.latencyMs}ms | Error Rate: ${r?.postMetrics?.errorRatePercent}% | CPU: ${r?.postMetrics?.cpuPercent}%

---

## 4. Timeline
${incident.timeline.map(t => `- **[${new Date(t.timestamp).toLocaleTimeString()}]** \`${t.status}\`: ${t.message}`).join('\n')}
`;
  }
}

export const incidentManager = new IncidentManager();
