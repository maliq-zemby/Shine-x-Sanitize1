import React, { useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';

interface WhatsAppComposerModalProps {
  recipientLabel: string;
  recipientPhone: string;
  defaultMessage: string;
  bookingId: string;
  onClose: () => void;
  onSent?: (message: string) => void;
}

export const WhatsAppComposerModal: React.FC<WhatsAppComposerModalProps> = ({
  recipientLabel,
  recipientPhone,
  defaultMessage,
  bookingId,
  onClose,
  onSent,
}) => {
  const [message, setMessage] = useState(defaultMessage);
  const [sentNotice, setSentNotice] = useState(false);

  const sanitizedDigits = recipientPhone.replace(/[^0-9]/g, '');
  const whatsappUrl = `https://wa.me/${sanitizedDigits}?text=${encodeURIComponent(message)}`;

  const handleTrackSend = () => {
    setSentNotice(true);
    onSent?.(message);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 pr-8">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Message WhatsApp</h3>
            <p className="text-xs text-slate-500">
              À : <strong className="text-slate-800">{recipientLabel}</strong> · {bookingId}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="wa-message" className="text-xs font-semibold text-slate-700">
            Contenu du message
          </label>
          <textarea
            id="wa-message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
          <p className="text-[11px] text-slate-500">
            Numéro WhatsApp destinataire : <span className="font-mono">{recipientPhone}</span>
          </p>
        </div>

        {sentNotice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-3.5 py-2.5 text-xs font-medium">
            Message préparé et journalisé pour {recipientLabel}. La fenêtre WhatsApp s'ouvre dans un nouvel onglet.
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            Fermer
          </button>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleTrackSend}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Ouvrir WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
};
