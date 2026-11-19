import React from 'react';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { APP_OFFICIAL_NAME, BRAND_LOGO_URL } from '../data/mockData';
import { NetworkGateStatus } from '../hooks/useNetworkStatus';

interface NetworkRequiredGateProps {
  status: Exclude<NetworkGateStatus, 'online'>;
  isChecking: boolean;
  onRetry: () => Promise<boolean> | void;
}

/**
 * Écran bloquant plein écran affiché tant qu'une connexion Internet réelle
 * n'est pas confirmée au démarrage ou en cas de coupure réseau.
 */
export const NetworkRequiredGate: React.FC<NetworkRequiredGateProps> = ({
  status,
  isChecking,
  onRetry,
}) => {
  const isInitialChecking = status === 'checking';

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="network-gate-title"
      aria-describedby="network-gate-message"
      className="fixed inset-0 z-[120] min-h-screen overflow-y-auto bg-[#F8FAF9] flex items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-10 space-y-6 text-center">
        <div className="flex items-center justify-center gap-2.5">
          <img
            src={BRAND_LOGO_URL}
            alt={APP_OFFICIAL_NAME}
            className="w-11 h-11 rounded-xl object-contain bg-white p-0.5 border border-slate-200"
            referrerPolicy="no-referrer"
          />
          <span className="text-sm font-extrabold tracking-tight text-emerald-950">
            {APP_OFFICIAL_NAME}
          </span>
        </div>

        <div
          className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center ${
            isInitialChecking
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-100 text-rose-700'
          }`}
        >
          {isInitialChecking ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <WifiOff className="w-8 h-8" />
          )}
        </div>

        {isInitialChecking ? (
          <div className="space-y-2">
            <h1 id="network-gate-title" className="text-lg sm:text-xl font-bold text-slate-900">
              Vérification de la connexion Internet...
            </h1>
            <p id="network-gate-message" className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Contrôle de l&apos;accès réseau en cours avant l&apos;ouverture de votre espace {APP_OFFICIAL_NAME}.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2.5">
              <h1 id="network-gate-title" className="text-xl sm:text-2xl font-bold text-slate-900">
                Connexion Internet requise
              </h1>
              <p id="network-gate-message" className="text-sm text-slate-600 leading-relaxed">
                Une connexion Internet active est requise pour utiliser{' '}
                <strong className="text-slate-900">{APP_OFFICIAL_NAME}</strong> (réservations en direct, promotions et suivi GPS).
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Activez le Wi-Fi ou les données mobiles, désactivez un éventuel VPN bloquant, puis appuyez sur « Réessayer ». L&apos;application se déverrouillera automatiquement dès le retour du réseau.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onRetry()}
              disabled={isChecking}
              className="w-full sm:w-auto px-6 py-3 min-h-[48px] bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {isChecking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>{isChecking ? 'Vérification...' : 'Réessayer'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
