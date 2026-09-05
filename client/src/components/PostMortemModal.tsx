import React, { useState } from 'react';
import { Incident } from '../types.js';
import { FileText, Copy, Check, X, Download } from 'lucide-react';

interface PostMortemModalProps {
  incident: Incident | null;
  onClose: () => void;
}

export const PostMortemModal: React.FC<PostMortemModalProps> = ({ incident, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!incident || !incident.postMortem) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(incident.postMortem || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([incident.postMortem || ''], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postmortem-${incident.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="relative w-full max-w-3xl bg-[#0e1626] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                Incident Post-Mortem Report
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {incident.id} · {incident.alert.service} · {incident.alert.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Markdown'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Markdown Content */}
        <div className="p-6 overflow-y-auto bg-[#080d16] font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
          {incident.postMortem}
        </div>
      </div>
    </div>
  );
};
