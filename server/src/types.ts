export type IncidentSeverity = 'P1' | 'P2' | 'P3' | 'P4';

export type IncidentStatus = 
  | 'FIRING'
  | 'INVESTIGATING'
  | 'AUTO_REMEDIATING'
  | 'AWAITING_VOICE_APPROVAL'
  | 'EXECUTING_REMEDIATION'
  | 'VERIFYING'
  | 'RESOLVED'
  | 'ESCALATED';

export type RiskTier = 'TIER_1_AUTO' | 'TIER_2_VOICE_APPROVAL' | 'TIER_3_ESCALATE';

export interface ServiceHealth {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'critical';
  cpuPercent: number;
  memoryPercent: number;
  latencyMs: number;
  errorRatePercent: number;
  replicaCount: number;
  lastRestartAt: string;
  activeConnections?: number;
  diskUsagePercent?: number;
}

export interface MetricSnapshot {
  timestamp: string;
  cpuPercent: number;
  memoryPercent: number;
  latencyMs: number;
  errorRatePercent: number;
  diskUsagePercent?: number;
  activeConnections?: number;
}

export interface AlertPayload {
  id: string;
  source: 'alertmanager' | 'datadog' | 'cloudwatch' | 'pagerduty' | 'chaos_simulator';
  service: string;
  severity: IncidentSeverity;
  title: string;
  description: string;
  metric: string;
  currentValue: number;
  thresholdValue: number;
  timestamp: string;
  labels?: Record<string, string>;
}

export interface RemediationAction {
  id: string;
  name: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  estimatedRecoverySec: number;
  command: string;
  rollbackPlan: string;
  sideEffects?: string;
}

export interface VoiceCallTurn {
  speaker: 'agent' | 'engineer';
  text: string;
  timestamp: string;
}

export interface CallEResult {
  callId: string;
  status: 'completed' | 'failed' | 'in_progress' | 'cancelled';
  approvalStatus: 'approved' | 'rejected' | 'escalate' | 'snooze' | 'unreachable';
  spokenInstructions?: string;
  confidence: number;
  durationSeconds: number;
  transcript: VoiceCallTurn[];
  recordingUrl?: string;
  summary: string;
}

export interface Incident {
  id: string;
  alert: AlertPayload;
  status: IncidentStatus;
  riskTier: RiskTier;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  
  // Diagnostics
  diagnosis?: {
    rootCause: string;
    affectedComponents: string[];
    evidence: string[];
    confidence: number;
    recommendedAction: RemediationAction;
    alternateActions?: RemediationAction[];
    voicePromptScript: string;
  };

  // Voice Interaction
  voiceCall?: {
    callId: string;
    phone: string;
    provider: 'calle_live' | 'voice_simulator';
    status: 'initiating' | 'ringing' | 'in_progress' | 'completed' | 'failed';
    result?: CallEResult;
    startedAt: string;
    completedAt?: string;
  };

  // Remediation
  remediation?: {
    actionTaken: RemediationAction;
    executedAt: string;
    completedAt: string;
    logs: string[];
    success: boolean;
    preMetrics: MetricSnapshot;
    postMetrics?: MetricSnapshot;
  };

  // Post-Mortem Report
  snoozeUntil?: string;

  postMortem?: string;
  timeline: {
    timestamp: string;
    status: IncidentStatus;
    message: string;
  }[];
}

export interface OnCallConfig {
  engineerName: string;
  phoneNumber: string;
  callMode: 'voice_simulator' | 'calle_live';
  autoApproveTier1: boolean;
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "07:00"
  };
  escalationTimeoutSeconds: number;
  shadowMode: boolean;
  serviceGates: Record<string, 'auto' | 'voice' | 'escalate'>;
}
