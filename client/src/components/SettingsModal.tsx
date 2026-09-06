import React, { useState, useEffect } from 'react';
import { OnCallConfig } from '../types.js';
import { Settings, Key, Phone, User, ShieldCheck, X, Save } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: OnCallConfig;
  onSaveConfig: (updated: Partial<OnCallConfig>) => Promise<void>;
  onSaveApiKey: (key: string) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onSaveApiKey,
}) => {
  const [engineerName, setEngineerName] = useState(config.engineerName);
  const [phoneNumber, setPhoneNumber] = useState(config.phoneNumber);
  const [callMode, setCallMode] = useState(config.callMode);
  const [autoApproveTier1, setAutoApproveTier1] = useState(config.autoApproveTier1);
  const [calleApiKey, setCalleApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEngineerName(config.engineerName);
    setPhoneNumber(config.phoneNumber);
    setCallMode(config.callMode);
    setAutoApproveTier1(config.autoApproveTier1);
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
      });

      if (calleApiKey.trim()) {
        await onSaveApiKey(calleApiKey.trim());
      }

      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="relative w-full max-w-xl bg-[#0e1626] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              On-Call Roster & CALL-E Configuration
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* CALL-E API Key */}
          <div>
            <label className="text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              CALL-E API Key
              <span className="text-[10px] font-normal text-slate-400">
                (Optional: leave blank for built-in Voice Simulator)
              </span>
            </label>
            <input
              type="password"
              placeholder={config.hasCalleApiKey ? '•••••••••••••••• (Key Configured)' : 'Enter CALLE_API_KEY from heycall-e.com'}
              value={calleApiKey}
              onChange={(e) => setCalleApiKey(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-slate-200 text-xs font-mono outline-none transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Sign up at <a href="https://www.heycall-e.com/" target="_blank" rel="noreferrer" className="text-emerald-400 underline">heycall-e.com</a> to get 20 free phone calls.
            </p>
          </div>

          {/* Engineer Name */}
          <div>
            <label className="text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-cyan-400" />
              On-Call Engineer Name
            </label>
            <input
              type="text"
              required
              value={engineerName}
              onChange={(e) => setEngineerName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-slate-200 text-xs outline-none transition"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-400" />
              Mobile Phone Number (E.164 Format)
            </label>
            <input
              type="text"
              required
              placeholder="+15551234567"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-slate-200 text-xs font-mono outline-none transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              For real outbound phone calls, include country code (e.g., +1 for US/Canada).
            </p>
          </div>

          {/* Call Mode Switcher */}
          <div>
            <label className="text-xs font-bold text-slate-300 mb-1 block">
              Default Calling Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCallMode('voice_simulator')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                  callMode === 'voice_simulator'
                    ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>Voice Simulator (Browser Audio)</span>
                <span className="text-[10px] opacity-75">No API key / credits needed</span>
              </button>

              <button
                type="button"
                onClick={() => setCallMode('calle_live')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                  callMode === 'calle_live'
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>Live CALL-E Dialing</span>
                <span className="text-[10px] opacity-75">Dials physical cell phone</span>
              </button>
            </div>
          </div>

          {/* Auto-Approve Tier 1 Policy */}
          <div className="pt-2 border-t border-slate-800">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoApproveTier1}
                onChange={(e) => setAutoApproveTier1(e.target.checked)}
                className="mt-1 rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Enable Sleep Policy (Autonomous Tier 1 Remediation)
                </span>
                <p className="text-slate-400 mt-0.5">
                  When verified safe idempotent runbooks match (e.g. disk log prune, cache flush), remediate without ringing or waking the on-call engineer.
                </p>
              </div>
            </label>
          </div>

          {/* Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
