import React, { useState, useEffect } from 'react';
import { OnCallConfig } from '../types.js';
import { Settings, Key, Phone, User, ShieldCheck, X, Save } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: OnCallConfig;
  onSaveConfig: (updated: Partial<OnCallConfig>) => Promise<void>;
  onSaveApiKey: (key: string) => Promise<void>;
  onSaveDiscordWebhook: (url: string) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onSaveApiKey,
  onSaveDiscordWebhook,
}) => {
  const [engineerName, setEngineerName] = useState(config.engineerName);
  const [phoneNumber, setPhoneNumber] = useState(config.phoneNumber);
  const [callMode, setCallMode] = useState(config.callMode);
  const [autoApproveTier1, setAutoApproveTier1] = useState(config.autoApproveTier1);
  const [calleApiKey, setCalleApiKey] = useState('');
  const [discordWebhook, setDiscordWebhook] = useState('');
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(config.quietHours.enabled);
  const [quietHoursStart, setQuietHoursStart] = useState(config.quietHours.start);
  const [quietHoursEnd, setQuietHoursEnd] = useState(config.quietHours.end);
  const [escalationTimeoutSeconds, setEscalationTimeoutSeconds] = useState(
    config.escalationTimeoutSeconds
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEngineerName(config.engineerName);
    setPhoneNumber(config.phoneNumber);
    setCallMode(config.callMode);
    setAutoApproveTier1(config.autoApproveTier1);
    setQuietHoursEnabled(config.quietHours.enabled);
    setQuietHoursStart(config.quietHours.start);
    setQuietHoursEnd(config.quietHours.end);
    setEscalationTimeoutSeconds(config.escalationTimeoutSeconds);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveConfig({
        engineerName,
        phoneNumber,
        callMode,
        autoApproveTier1,
        quietHours: {
          enabled: quietHoursEnabled,
          start: quietHoursStart,
          end: quietHoursEnd,
        },
        escalationTimeoutSeconds,
      });

      if (calleApiKey.trim()) {
        await onSaveApiKey(calleApiKey.trim());
      }
      if (discordWebhook.trim()) {
        await onSaveDiscordWebhook(discordWebhook.trim());
      }

      onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 bg-crt-bg border border-crt-line text-phosphor text-xs font-mono outline-none focus:border-phosphor';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto border border-crt-line bg-crt-panel font-mono text-phosphor">
        <div className="px-6 py-4 border-b border-crt-line flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-phosphor" />
            <h3 className="text-base font-bold tracking-widest">
              ON-CALL ROSTER &amp; CALL-E CONFIG
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-phosphor-dim hover:text-phosphor hover:bg-crt-bg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-phosphor mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              CALL-E API KEY
              <span className="text-[10px] font-normal text-phosphor-dim">
                (Optional: leave blank for built-in Voice Simulator)
              </span>
            </label>
            <input
              type="password"
              placeholder={config.hasCalleApiKey ? '•••••••••••••••• (Key Configured)' : 'Enter CALLE_API_KEY from heycall-e.com'}
              value={calleApiKey}
              onChange={(e) => setCalleApiKey(e.target.value)}
              className={inputClass}
            />
            <p className="text-[11px] text-phosphor-dim mt-1">
              Sign up at{' '}
              <a href="https://www.heycall-e.com/" target="_blank" rel="noreferrer" className="text-phosphor underline">
                heycall-e.com
              </a>{' '}
              to get 20 free phone calls.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-phosphor mb-1 block">
              DISCORD INCIDENT WEBHOOK
              <span className="text-[10px] font-normal text-phosphor-dim ml-1">
                (Optional ChatOps mirror)
              </span>
            </label>
            <input
              type="password"
              placeholder={
                config.hasDiscordWebhook
                  ? '•••• webhook configured'
                  : 'https://discord.com/api/webhooks/…'
              }
              value={discordWebhook}
              onChange={(e) => setDiscordWebhook(e.target.value)}
              className={inputClass}
            />
            <p className="text-[11px] text-phosphor-dim mt-1">
              Channel → Integrations → Webhooks. Posts diagnosis, call status, and verified recovery.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-phosphor mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              ON-CALL ENGINEER NAME
            </label>
            <input
              type="text"
              required
              value={engineerName}
              onChange={(e) => setEngineerName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-phosphor mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              MOBILE PHONE NUMBER (E.164)
            </label>
            <input
              type="text"
              required
              placeholder="+15551234567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className={inputClass}
            />
            <p className="text-[11px] text-phosphor-dim mt-1">
              For real outbound phone calls, include country code (e.g., +1 for US/Canada).
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-phosphor mb-1 block">DEFAULT CALLING MODE</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCallMode('voice_simulator')}
                className={`py-2.5 px-3 border text-xs font-semibold flex flex-col items-center gap-1 ${
                  callMode === 'voice_simulator'
                    ? 'bg-crt-bg border-phosphor text-phosphor'
                    : 'bg-crt-bg border-crt-line text-phosphor-dim hover:text-phosphor'
                }`}
              >
                <span>Voice Simulator (Browser Audio)</span>
                <span className="text-[10px] opacity-75">No API key / credits needed</span>
              </button>

              <button
                type="button"
                onClick={() => setCallMode('calle_live')}
                className={`py-2.5 px-3 border text-xs font-semibold flex flex-col items-center gap-1 ${
                  callMode === 'calle_live'
                    ? 'bg-crt-bg border-phosphor text-phosphor'
                    : 'bg-crt-bg border-crt-line text-phosphor-dim hover:text-phosphor'
                }`}
              >
                <span>Live CALL-E Dialing</span>
                <span className="text-[10px] opacity-75">Dials physical cell phone</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-phosphor mb-1 block">QUIET HOURS</label>
            <label className="flex items-center gap-2 text-xs cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={quietHoursEnabled}
                onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                className="bg-crt-bg border-crt-line text-phosphor"
              />
              <span>Enabled</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-phosphor-dim">START</label>
                <input
                  type="time"
                  value={quietHoursStart}
                  onChange={(e) => setQuietHoursStart(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[10px] text-phosphor-dim">END</label>
                <input
                  type="time"
                  value={quietHoursEnd}
                  onChange={(e) => setQuietHoursEnd(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-phosphor mb-1 block">
              ESCALATION TIMEOUT (SECONDS)
            </label>
            <input
              type="number"
              min={1}
              value={escalationTimeoutSeconds}
              onChange={(e) => setEscalationTimeoutSeconds(Number(e.target.value))}
              className={inputClass}
            />
          </div>

          <div className="pt-2 border-t border-crt-line">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoApproveTier1}
                onChange={(e) => setAutoApproveTier1(e.target.checked)}
                className="mt-1 bg-crt-bg border-crt-line text-phosphor"
              />
              <div className="text-xs">
                <span className="font-bold text-phosphor flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  ENABLE SLEEP POLICY (AUTONOMOUS TIER 1)
                </span>
                <p className="text-phosphor-dim mt-0.5">
                  When verified safe idempotent runbooks match (e.g. disk log prune, cache flush),
                  remediate without ringing or waking the on-call engineer.
                </p>
              </div>
            </label>
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-crt-line">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-crt-line text-xs text-phosphor-dim hover:text-phosphor hover:bg-crt-bg"
            >
              [ CANCEL ]
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 border border-phosphor bg-crt-bg text-phosphor text-xs font-bold hover:bg-phosphor hover:text-crt-bg disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'SAVING...' : '[ SAVE SETTINGS ]'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
