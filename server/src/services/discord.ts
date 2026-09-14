import { Incident, IncidentStatus } from '../types.js';

const WEBHOOK_RE =
  /^https:\/\/(?:ptb\.|canary\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;

const STATUS_COLOR: Partial<Record<IncidentStatus, number>> = {
  AWAITING_VOICE_APPROVAL: 0xf59e0b,
  AUTO_REMEDIATING: 0x3b82f6,
  EXECUTING_REMEDIATION: 0x3b82f6,
  VERIFYING: 0x3b82f6,
  RESOLVED: 0x10b981,
  ESCALATED: 0xef4444,
};

function clip(value: string, max = 1024): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function isDiscordWebhookUrl(url: string): boolean {
  return WEBHOOK_RE.test(url.trim());
}

class DiscordNotifier {
  private webhookUrl = (process.env.DISCORD_WEBHOOK_URL || '').trim();

  public hasWebhook(): boolean {
    return isDiscordWebhookUrl(this.webhookUrl);
  }

  public getWebhookUrl(): string {
    return this.webhookUrl;
  }

  public setWebhookUrl(url: string): boolean {
    const next = url.trim();
    if (!next) {
      this.webhookUrl = '';
      return true;
    }
    if (!isDiscordWebhookUrl(next)) return false;
    this.webhookUrl = next;
    return true;
  }

  public async sendTestPing(overrideUrl?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const target = (overrideUrl || this.webhookUrl).trim();
    if (!isDiscordWebhookUrl(target)) {
      return { success: false, error: 'Invalid or missing Discord webhook URL' };
    }
    try {
      const res = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'PagerZero SRE',
          embeds: [
            {
              title: '✅ PagerZero Discord Webhook Connected',
              url: 'https://pagerzero.pro',
              color: 0x10b981,
              description: 'Incident notifications, CALL-E approvals, and verified recovery post-mortems are now mirroring to this channel.',
              fields: [
                { name: 'Environment', value: 'Production (pagerzero.pro)', inline: true },
                { name: 'Status', value: 'Operational', inline: true },
              ],
              footer: { text: 'PagerZero Autonomous SRE • pagerzero.pro' },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { success: false, error: `Discord rejected webhook (HTTP ${res.status}): ${body.slice(0, 200)}` };
      }
      return { success: true, message: 'Test notification sent to Discord!' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to send test ping' };
    }
  }

  public notifyIncident(incident: Incident, message: string): void {
    if (!this.hasWebhook()) return;
    void this.post(incident, message).catch((err) => {
      console.error('[Discord Webhook] Delivery failed:', err);
    });
  }

  public buildPayload(incident: Incident, message: string) {
    const color = STATUS_COLOR[incident.status] ?? 0x6b7280;
    const diagnosis = incident.diagnosis?.rootCause || incident.alert.description;
    const plan =
      incident.diagnosis?.recommendedAction.command ||
      incident.diagnosis?.recommendedAction.name ||
      'Pending diagnosis';
    const fields: { name: string; value: string; inline: boolean }[] = [
      { name: 'Root Cause / Diagnosis', value: clip(diagnosis || '—'), inline: false },
      { name: 'Proposed Remediation', value: clip(`\`${plan}\``), inline: false },
    ];

    const call = incident.voiceCall?.result;
    if (call?.approvalStatus) {
      fields.push({
        name: 'CALL-E Voice Action',
        value: clip(
          `${call.approvalStatus}${call.spokenInstructions ? ` — "${call.spokenInstructions}"` : ''}`
        ),
        inline: false,
      });
    } else if (incident.status === 'AWAITING_VOICE_APPROVAL') {
      fields.push({
        name: 'CALL-E Voice Action',
        value: 'Placing outbound call via CALL-E to on-call phone…',
        inline: false,
      });
    }

    const metrics = incident.remediation?.postMetrics || incident.remediation?.preMetrics;
    if (metrics) {
      fields.push({
        name: 'Observed Telemetry',
        value: clip(
          [
            `• **latency**: \`${metrics.latencyMs}ms\``,
            `• **errors**: \`${metrics.errorRatePercent}%\``,
            metrics.activeConnections !== undefined
              ? `• **pool**: \`${metrics.activeConnections}\``
              : '',
            metrics.diskUsagePercent !== undefined
              ? `• **disk**: \`${metrics.diskUsagePercent}%\``
              : '',
          ]
            .filter(Boolean)
            .join('\n')
        ),
        inline: false,
      });
    }

    return {
      username: 'PagerZero SRE',
      embeds: [
        {
          title: `[${incident.alert.severity}] ${incident.alert.title}`,
          url: `https://pagerzero.pro`,
          color,
          description: clip(
            `**Service:** \`${incident.alert.service}\`\n**Status:** **${incident.status}** (${incident.riskTier})\n${message}`
          ),
          fields,
          footer: { text: 'PagerZero Autonomous SRE • pagerzero.pro' },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  private async post(incident: Incident, message: string): Promise<void> {
    const res = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.buildPayload(incident, message)),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${body.slice(0, 200)}`);
    }
  }
}

export const discordNotifier = new DiscordNotifier();
