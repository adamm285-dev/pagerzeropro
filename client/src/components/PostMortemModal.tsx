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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="relative w-full max-w-3xl border border-crt-line bg-crt-panel font-mono text-phosphor overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-crt-line flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-phosphor" />
            <div>
              <h3 className="text-base font-bold tracking-widest">INCIDENT POST-MORTEM</h3>
              <p className="text-xs text-phosphor-dim font-mono">
                {incident.id} · {incident.alert.service} · {incident.alert.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-crt-bg text-phosphor text-xs font-semibold border border-crt-line hover:border-phosphor"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'COPIED' : 'COPY MD'}</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-crt-bg text-phosphor text-xs font-semibold border border-crt-line hover:border-phosphor"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DOWNLOAD</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-phosphor-dim hover:text-phosphor hover:bg-crt-bg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto bg-crt-bg font-mono text-xs text-phosphor leading-relaxed whitespace-pre-wrap">
          {incident.postMortem}
        </div>
      </div>
    </div>
  );
};
