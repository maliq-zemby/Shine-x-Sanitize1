import React, { useState } from 'react';
import { Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { APP_OFFICIAL_NAME, BRAND_LOGO_URL } from '../data/mockData';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="px-3 py-2 min-h-[40px] bg-slate-900 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Installer l'App</span>
        <span className="sm:hidden">Installer</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuideModal(true)}
          className="px-3 py-2 min-h-[40px] bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-900 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
          <span className="hidden sm:inline">Installer iOS</span>
          <span className="sm:hidden">App iOS</span>
        </button>

        {showGuideModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 relative">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Fermer"
                className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 pr-8">
                <img
                  src={BRAND_LOGO_URL}
                  alt={APP_OFFICIAL_NAME}
                  className="w-12 h-12 rounded-xl object-contain bg-white p-0.5 border border-slate-200 shrink-0"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{APP_OFFICIAL_NAME}</h3>
                  <p className="text-[11px] text-slate-500">Installation sur iPhone / iPad</p>
                </div>
              </div>

              <ol className="text-xs text-slate-700 space-y-2.5 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-4">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-emerald-700">1.</span>
                  <span>
                    Appuyez sur l'icône <strong className="inline-flex items-center gap-1">Partager <Share className="w-3 h-3 inline" /></strong> dans la barre Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-emerald-700">2.</span>
                  <span>
                    Faites défiler vers le bas puis sélectionnez <strong>« Sur l'écran d'accueil »</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-emerald-700">3.</span>
                  <span>
                    Appuyez sur <strong>Ajouter</strong> pour verrouiller le logo officiel sur votre écran d'accueil.
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2.5 min-h-[42px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl"
              >
                Compris
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Mode hors-ligne — Cache local actif</span>
    </div>
  );
};
