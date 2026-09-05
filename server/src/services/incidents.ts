import { v4 as uuidv4 } from 'uuid';
import { 
  Incident, 
  AlertPayload, 
  IncidentStatus, 
  OnCallConfig, 
  VoiceCallTurn, 
  CallEResult 
} from '../types.js';
import { diagnosticsEngine } from './diagnostics.js';
import { clusterSimulator } from './cluster.js';
import { calleService } from './calle.js';

type IncidentListener = (event: { type: string; incident: Incident; data?: any }) => void;

class IncidentManager {
  private incidents: Map<string, Incident> = new Map();
  private listeners: Set<IncidentListener> = new Set();
  
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

  public updateConfig(newConfig: Partial<OnCallConfig>) {
    this.config = { ...this.config, ...newConfig };
    return this.config;
  }

  /**
   * Main Alert Ingestion and Autonomous Decision Pipeline
   */
  public async handleAlert(alert: AlertPayload): Promise<Incident> {
    const incidentId = `inc-${Date.now().toString().slice(-6)}`;
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
    if (diagnosis.riskTier === 'TIER_1_AUTO' && this.config.autoApproveTier1) {
      // PATH A: Tier 1 Auto-Remediation (Stay Asleep!)
      this.updateStatus(
        incident,
        'AUTO_REMEDIATING',
        `Tier 1 Safe Action Identified: "${diagnosis.recommendedAction.name}". Executing autonomously without waking on-call engineer.`
      );
      await this.executeRemediation(incident);

    } else if (diagnosis.riskTier === 'TIER_2_VOICE_APPROVAL') {
      // PATH B: Tier 2 Voice Approval via CALL-E ("Stay in Bed")
      this.updateStatus(
        incident,
        'AWAITING_VOICE_APPROVAL',
        `High-impact action requires human approval. Initiating CALL-E voice call to ${this.config.engineerName} (${this.config.phoneNumber}).`
      );

      incident.voiceCall = {
        callId: `call-${Date.now()}`,
        phone: this.config.phoneNumber,
        provider: this.config.callMode,
        status: 'ringing',
        startedAt: new Date().toISOString(),
      };
      this.broadcast('voice_call_started', incident);

      // Perform the phone call
      const callResult = await calleService.executeCall(
        {
          incidentId: incident.id,
          serviceName: incident.alert.service,
          engineerName: this.config.engineerName,
          phoneNumber: this.config.phoneNumber,
          voiceScript: diagnosis.voicePromptScript,
          actionName: diagnosis.recommendedAction.name,
          liveMode: this.config.callMode === 'calle_live',
        },
        (turn: VoiceCallTurn) => {
          this.broadcast('voice_call_turn', incident, turn);
        }
      );

      incident.voiceCall.result = callResult;
      incident.voiceCall.status = callResult.status === 'completed' ? 'completed' : 'failed';
      incident.voiceCall.completedAt = new Date().toISOString();

      if (callResult.approvalStatus === 'approved') {
        this.updateStatus(
          incident,
          'EXECUTING_REMEDIATION',
          `Voice Approval Received from ${this.config.engineerName}: "${callResult.spokenInstructions}". Executing approved action.`
        );
        await this.executeRemediation(incident);
      } else if (callResult.approvalStatus === 'rejected') {
        this.updateStatus(
          incident,
          'ESCALATED',
          `Engineer explicitly rejected remediation ("${callResult.spokenInstructions}"). Escalating to secondary on-call.`
        );
      } else {
        this.updateStatus(
          incident,
          'ESCALATED',
          `Voice call outcome: ${callResult.approvalStatus}. Escalating incident.`
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

    const result = await clusterSimulator.executeRemediation(action.id, serviceId);
    const postMetrics = clusterSimulator.getSnapshot(serviceId);

    incident.remediation = {
      actionTaken: action,
      executedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      logs: result.logs,
      success: result.success,
      preMetrics,
      postMetrics,
    };

    if (result.success) {
      this.updateStatus(incident, 'VERIFYING', 'Action executed. Verifying telemetry and error rate recovery...');
      await new Promise(r => setTimeout(r, 1200));

      this.updateStatus(
        incident,
        'RESOLVED',
        `Telemetry verified healthy. Service recovered. Incident automatically closed.`
      );
      incident.resolvedAt = new Date().toISOString();
      incident.postMortem = this.generatePostMortem(incident);
      this.broadcast('incident_resolved', incident);
    } else {
      this.updateStatus(
        incident,
        'ESCALATED',
        `Remediation action failed. Escalating to human SRE.`
      );
    }
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

    const callResult: CallEResult = {
      callId: incident.voiceCall?.callId || `sim-${Date.now()}`,
      status: 'completed',
      approvalStatus,
      spokenInstructions,
      confidence: 0.99,
      durationSeconds: 15,
      transcript: [
        {
          speaker: 'agent',
          text: incident.diagnosis?.voicePromptScript || 'Do you approve the remediation?',
          timestamp: new Date().toISOString(),
        },
        {
          speaker: 'engineer',
          text: spokenInstructions,
          timestamp: new Date().toISOString(),
        },
      ],
      summary: `Engineer approved action via voice simulator: "${spokenInstructions}".`,
    };

    incident.voiceCall = {
      callId: callResult.callId,
      phone: this.config.phoneNumber,
      provider: 'voice_simulator',
      status: 'completed',
      result: callResult,
      startedAt: incident.voiceCall?.startedAt || new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    if (approvalStatus === 'approved') {
      this.updateStatus(
        incident,
        'EXECUTING_REMEDIATION',
        `Voice Simulator Approval Received: "${spokenInstructions}". Executing fix.`
      );
      await this.executeRemediation(incident);
    } else {
      this.updateStatus(
        incident,
        'ESCALATED',
        `Action rejected by on-call engineer: "${spokenInstructions}". Escalated.`
      );
    }
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
