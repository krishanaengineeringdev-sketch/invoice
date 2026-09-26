import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Copy, Check, X, AlertCircle, ExternalLink } from 'lucide-react';
import { getEmailShareDetails } from '../utils/shareUtils';

export default function ShareEmailModal({ isOpen, onClose, shareData }) {
  const [emailInput, setEmailInput] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (shareData) {
      setEmailInput(shareData.buyerEmail || '');
    }
  }, [shareData]);

  if (!isOpen || !shareData) return null;

  const { subject, body } = getEmailShareDetails({
    ...shareData,
    buyerEmail: emailInput
  });

  const mailtoUrl = `mailto:${emailInput.trim() ? encodeURIComponent(emailInput.trim()) : ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const handleSendMail = () => {
    console.log('Triggering mailto link:', mailtoUrl);
    window.location.href = mailtoUrl;
  };

  const handleCopyText = async () => {
    const fullTextToCopy = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(fullTextToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs print:hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5 text-[#36454F]">
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#36454F]">
                  Share {shareData.type || 'Document'} via Email
                </h3>
                <p className="text-[11px] text-[#5C7A99]">
                  #{shareData.number} for {shareData.buyerName || 'Buyer'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Recipient Email Input */}
          <div className="space-y-1.5 text-xs">
            <label className="block font-semibold text-[#36454F]">
              Buyer Email Address {!shareData.buyerEmail && <span className="text-amber-600 font-normal">(Not saved yet)</span>}
            </label>
            <input
              type="email"
              placeholder="enter.buyer@company.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Email Subject Preview */}
          <div className="space-y-1 text-xs">
            <label className="block font-semibold text-[#5C7A99] uppercase text-[10px] tracking-wider">
              Subject
            </label>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[#36454F] font-semibold text-xs font-mono truncate">
              {subject}
            </div>
          </div>

          {/* Email Body Preview */}
          <div className="space-y-1 text-xs">
            <label className="block font-semibold text-[#5C7A99] uppercase text-[10px] tracking-wider">
              Message Body Preview
            </label>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-mono text-[11px] whitespace-pre-wrap max-h-36 overflow-y-auto">
              {body}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              onClick={handleCopyText}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#36454F] text-xs font-bold transition-all duration-150 cursor-pointer border border-slate-200 shrink-0"
              title="Copy email subject and body to paste into Gmail / Outlook web"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-[#5C7A99]" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Text for Webmail'}</span>
            </button>

            <button
              onClick={handleSendMail}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all duration-150 cursor-pointer shadow-md"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open Mail App</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
