import React, { useState } from 'react';
import { Clock, LogOut, ShieldX } from 'lucide-react';
import { APP_OFFICIAL_NAME, BRAND_LOGO_URL } from '../data/mockData';
import { UserProfile } from '../types';

interface CompanyValidationGateProps {
  profile: UserProfile;
  status: 'pending' | 'rejected';
  onSignOut: () => Promise<void> | void;
}

/**
 * Écran plein écran bloquant pour les comptes Entreprise / Gérant non validés.
 * Remplace toute l'application : aucun onglet, tableau de bord ni action n'est accessible.
 */
export const CompanyValidationGate: React.FC<CompanyValidationGateProps> = ({
  profile,
  status,
  onSignOut,
}) => {
  const [signingOut, setSigningOut] = useState(false);
  const isPending = status === 'pending';
  const reason = (profile.rejectionReason || '').trim();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="company-gate-title"
      aria-describedby="company-gate-message"
      className="fixed inset-0 z-[100] min-h-screen overflow-y-auto bg-[#F8FAF9] flex items-center justify-center p-4 sm:p-6"
    >
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-10 space-y-6 text-center">
        <div className="flex items-center justify-center gap-2.5">
          <img
            src={BRAND_LOGO_URL}
            alt={APP_OFFICIAL_NAME}
            className="w-10 h-10 rounded-xl object-contain bg-white p-0.5 border border-slate-200"
            referrerPolicy="no-referrer"
          />
          <span className="text-sm font-extrabold tracking-tight text-emerald-950">
            {APP_OFFICIAL_NAME}
          </span>
        </div>

        <div
          className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center ${
            isPending ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
          }`}
        >
          {isPending ? <Clock className="w-8 h-8" /> : <ShieldX className="w-8 h-8" />}
        </div>

        <div className="space-y-3">
          <h1 id="company-gate-title" className="text-xl sm:text-2xl font-bold text-slate-900">
            {isPending ? 'Inscription en cours de vérification' : 'Inscription refusée'}
          </h1>

          {isPending ? (
            <p id="company-gate-message" className="text-sm text-slate-600 leading-relaxed">
              Votre inscription est en cours de vérification par un administrateur. Vous aurez
              accès à votre espace dès validation.
            </p>
          ) : (
            <div id="company-gate-message" className="space-y-3">
              <p className="text-sm text-slate-600 leading-relaxed">
                Votre demande d'inscription en tant qu'entreprise a été refusée par un
                administrateur. Vous ne pouvez pas accéder à l'espace entreprise avec ce compte.
              </p>
              <div className="text-left bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-1">
                <div className="text-xs font-bold text-rose-800">Motif du rejet</div>
                <p className="text-sm text-rose-950 leading-relaxed whitespace-pre-line break-words">
                  {reason || 'Aucun motif précisé.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {profile.companyName && (
          <div className="text-xs text-slate-500">
            Entreprise : <span className="font-semibold text-slate-800">{profile.companyName}</span>
            {' · '}
            {profile.displayName}
          </div>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full sm:w-auto px-6 py-3 min-h-[48px] bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 text-white text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>{signingOut ? 'Déconnexion...' : 'Se déconnecter'}</span>
        </button>
      </div>
    </div>
  );
};
