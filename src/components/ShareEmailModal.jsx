import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Copy, Check, X, AlertCircle, ExternalLink, Send } from 'lucide-react';
import { getEmailShareDetails } from '../utils/shareUtils';

export default function ShareEmailModal({ isOpen, onClose, shareData }) {
  const [emailInput, setEmailInput] = useState('');
  const [copied, setCopied] = useState(false);

  // When modal opens, sync email input and attempt mailto: link simultaneously
  useEffect(() => {
    if (isOpen && shareData) {
      const initialEmail = shareData.buyerEmail || '';
      setEmailInput(initialEmail);

      // Attempt mailto: link first simultaneously (reliable background attempt)
      const { mailtoUrl } = getEmailShareDetails({
        ...shareData,
        buyerEmail: initialEmail
      });
      try {
        window.location.href = mailtoUrl;
      } catch (err) {
        // Silently handled if browser blocks or has no mailto handler
      }
    }
  }, [isOpen, shareData]);

  if (!isOpen || !shareData) return null;

  const { subject, body } = getEmailShareDetails({
    ...shareData,
    buyerEmail: emailInput.trim()
  });

  const fullTextToCopy = `Subject: ${subject}\n\n${body}`;
  const encodedTo = encodeURIComponent(emailInput.trim());
  const encodedSubject = encodeURIComponent(subject);
  const encodedBody = encodeURIComponent(body);

  const mailtoUrl = `mailto:${encodedTo}?subject=${encodedSubject}&body=${encodedBody}`;
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`;
  const outlookUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodedTo}&subject=${encodedSubject}&body=${encodedBody}`;

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(fullTextToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleRetryMailto = () => {
    try {
      window.location.href = mailtoUrl;
    } catch (err) {
      // Silently handled
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs print:hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5 text-[#36454F]">
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#36454F] font-heading">
                  Share {shareData.type || 'Document'} via Email
                </h3>
                <p className="text-xs text-[#5C7A99]">
                  #{shareData.number} · {shareData.buyerName || 'Buyer'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Fallback Notice Banner */}
          <div className="p-3 bg-amber-50/90 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">No default email app detected?</span>
              <span className="text-amber-800 text-[11.5px] leading-relaxed block">
                Copy this message and paste it into Gmail, Outlook, or your preferred email service.
              </span>
            </div>
          </div>

          {/* Recipient Email Input */}
          <div className="space-y-1 text-xs">
            <label className="block font-semibold text-[#36454F]">
              Recipient Email {!shareData.buyerEmail && <span className="text-amber-600 font-normal">(Optional)</span>}
            </label>
            <input
              type="email"
              placeholder="buyer@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {/* Pre-filled Subject and Body in Read-Only Textarea */}
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <label className="block font-semibold text-[#5C7A99] uppercase text-[10px] tracking-wider">
                Pre-Filled Subject & Message
              </label>
              <button
                type="button"
                onClick={handleCopyText}
                className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <textarea
              readOnly
              rows={6}
              value={fullTextToCopy}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-mono text-[11.5px] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </div>

          {/* Webmail Quick Compose Links */}
          <div className="space-y-1.5 pt-1">
            <span className="block text-[11px] font-bold text-[#5C7A99] uppercase tracking-wider">
              Quick Compose in Browser
            </span>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={gmailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Gmail</span>
              </a>

              <a
                href={outlookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs border border-sky-200 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Outlook Web</span>
              </a>
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 border-t border-slate-100">
            <button
              onClick={handleCopyText}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#36454F] hover:bg-[#2c3840] text-white text-xs font-bold transition-all duration-150 cursor-pointer shadow-xs active:scale-95"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Message'}</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleRetryMailto}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#36454F] text-xs font-bold transition-colors cursor-pointer"
                title="Retry opening default mail app on device"
              >
                <Send className="w-3.5 h-3.5 text-[#5C7A99]" />
                <span>Retry Mail App</span>
              </button>

              <button
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#5C7A99] hover:text-[#36454F] text-xs font-bold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
