import React, { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  FileText,
  KeyRound,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  User,
  Wrench,
  X,
} from 'lucide-react';
import {
  ADMIN_BOOTSTRAP_EMAIL,
  ADMIN_WHATSAPP_PHONE,
  APP_OFFICIAL_NAME,
  BRAND_LOGO_URL,
} from '../data/mockData';
import { auth, authPersistenceReady, googleProvider } from '../firebase';
import { Role, UserProfile } from '../types';

interface AuthModalProps {
  pendingGoogleUser: FirebaseUser | null;
  onAuthComplete: (profile: UserProfile) => void;
  onEmailVerified?: (user: FirebaseUser) => void;
  onClose: () => void;
}

const WHATSAPP_INTERNATIONAL_REGEX = /^\+[1-9][0-9\s\-]{6,30}$/;

export const AuthModal: React.FC<AuthModalProps> = ({
  pendingGoogleUser,
  onAuthComplete,
  onEmailVerified,
  onClose,
}) => {
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(pendingGoogleUser);
  const [authMethod, setAuthMethod] = useState<'google' | 'email'>('google');
  const [emailMode, setEmailMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');

  const [selectedRole, setSelectedRole] = useState<Role>('client');
  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [phone, setPhone] = useState('+241 ');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [commune, setCommune] = useState('Libreville Centre');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoNotice, setInfoNotice] = useState('');

  useEffect(() => {
    setGoogleUser(pendingGoogleUser);
    if (
      pendingGoogleUser?.email?.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase() &&
      phone.trim() === '+241'
    ) {
      setPhone(ADMIN_WHATSAPP_PHONE);
    }
  }, [pendingGoogleUser]);

  const trimmedPhone = phone.trim();
  const digitsOnlyCount = trimmedPhone.replace(/\D/g, '').length;
  const isPhoneValid =
    WHATSAPP_INTERNATIONAL_REGEX.test(trimmedPhone) && digitsOnlyCount >= 9;

  const isAdminEmail =
    googleUser?.email?.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase() &&
    googleUser?.emailVerified;

  const isCompanyValid =
    selectedRole !== 'manager' ||
    Boolean(isAdminEmail) ||
    (companyName.trim().length >= 2 && companyDescription.trim().length >= 5);

  const canSubmit = Boolean(googleUser) && isPhoneValid && acceptedTerms && isCompanyValid;

  const handleGoogleSignIn = async () => {
    setError('');
    setInfoNotice('');
    setLoading(true);
    try {
      await authPersistenceReady;
      const cred = await signInWithPopup(auth, googleProvider);
      setGoogleUser(cred.user);
      if (cred.user.email?.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase()) {
        setPhone(ADMIN_WHATSAPP_PHONE);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de finaliser la connexion Google. Réessayez.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoNotice('');
    const normalizedEmail = emailInput.trim();
    if (!normalizedEmail || passwordInput.length < 6) {
      setError('Veuillez saisir une adresse e-mail valide et un mot de passe (6 caractères minimum).');
      return;
    }

    setLoading(true);
    try {
      await authPersistenceReady;
      if (emailMode === 'login') {
        const cred = await signInWithEmailAndPassword(auth, normalizedEmail, passwordInput);
        setGoogleUser(cred.user);
        if (cred.user.email?.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase()) {
          setPhone(ADMIN_WHATSAPP_PHONE);
        }
        if (!cred.user.emailVerified) {
          setInfoNotice(
            "Votre adresse e-mail n'est pas encore vérifiée. Vérifiez votre boîte de réception ou cliquez sur « Renvoyer l'e-mail »."
          );
        }
      } else {
        const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, passwordInput);
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // ignore email send throttling errors
        }
        setGoogleUser(cred.user);
        if (cred.user.email?.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL.toLowerCase()) {
          setPhone(ADMIN_WHATSAPP_PHONE);
        }
        setInfoNotice(
          'Compte créé. Un lien de confirmation vient d’être envoyé à votre adresse e-mail pour activer vos droits de sécurité.'
        );
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setError(
          "La connexion par E-mail / Mot de passe n'est pas encore activée dans Firebase Console. Ouvrez Firebase Console → Authentication → Sign-in method → activez « Adresse e-mail/Mot de passe »."
        );
      } else if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
        setError(
          "Identifiants incorrects ou compte inexistant. Utilisez l'onglet « Créer un compte » si vous vous connectez pour la première fois."
        );
      } else if (code === 'auth/email-already-in-use') {
        setError('Un compte existe déjà avec cet e-mail. Passez sur « Se connecter ».');
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Erreur lors de la connexion par e-mail. Réessayez.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!googleUser) return;
    setError('');
    setLoading(true);
    try {
      await sendEmailVerification(googleUser);
      setInfoNotice('E-mail de vérification renvoyé. Consultez votre boîte de réception.');
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'envoyer l'e-mail.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!auth.currentUser) return;
    setError('');
    setLoading(true);
    try {
      await auth.currentUser.reload();
      const refreshed = auth.currentUser;
      setGoogleUser(refreshed);
      if (refreshed.emailVerified) {
        setInfoNotice('Adresse e-mail vérifiée avec succès.');
        onEmailVerified?.(refreshed);
      } else {
        setError("Votre adresse e-mail n'est pas encore confirmée. Cliquez sur le lien reçu par e-mail.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de vérification.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleUser) return;
    setPhoneTouched(true);

    if (!isPhoneValid) {
      setError(
        'Veuillez renseigner un numéro WhatsApp valide au format international (ex : +241 065 96 12 38).'
      );
      return;
    }

    if (!acceptedTerms) {
      setError(
        "Vous devez accepter les conditions d'utilisation et la politique de confidentialité pour créer votre compte."
      );
      return;
    }

    if (selectedRole === 'manager' && !isAdminEmail && (!companyName.trim() || !companyDescription.trim())) {
      setError("Veuillez indiquer le nom de votre entreprise et une description de vos services.");
      return;
    }

    const now = new Date().toISOString();
    const finalRole: Role = isAdminEmail ? 'admin' : selectedRole;
    const finalStatus = finalRole === 'manager' ? 'pending' : 'active';

    const profile: UserProfile = {
      uid: googleUser.uid,
      email: googleUser.email || '',
      displayName:
        googleUser.displayName ||
        fullNameInput.trim() ||
        (finalRole === 'admin' ? 'Direction Shine-x-Sanitize Alp Group' : 'Utilisateur Shine'),
      ...(googleUser.photoURL ? { photoURL: googleUser.photoURL } : {}),
      role: finalRole,
      accountStatus: finalStatus,
      phone: trimmedPhone,
      commune,
      acceptedTerms: true,
      acceptedTermsAt: now,
      ...(finalRole === 'manager'
        ? {
            companyName: companyName.trim(),
            companyDescription: companyDescription.trim(),
          }
        : {}),
      createdAt: now,
      updatedAt: now,
    };

    onAuthComplete(profile);
  };

  const needsEmailVerification = Boolean(googleUser && !googleUser.emailVerified);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 relative my-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-5 right-5 w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Identity */}
        <div className="flex items-center gap-3 pr-8">
          <img
            src={BRAND_LOGO_URL}
            alt={APP_OFFICIAL_NAME}
            className="w-12 h-12 rounded-xl object-contain bg-white p-0.5 border border-slate-200 shrink-0"
            referrerPolicy="no-referrer"
          />
          <div>
            <h2 className="text-lg font-bold text-slate-900">{APP_OFFICIAL_NAME}</h2>
            <p className="text-xs text-slate-500">
              {needsEmailVerification
                ? 'Vérification de sécurité requise'
                : googleUser
                ? 'Finalisez votre inscription (une seule fois)'
                : 'Connexion sécurisée — Client, Agent, Entreprise & Admin'}
            </p>
          </div>
        </div>

        {!googleUser ? (
          <div className="space-y-4">
            {/* Switch Google vs Email/Password */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('google');
                  setError('');
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                  authMethod === 'google'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Compte Google
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('email');
                  setError('');
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                  authMethod === 'email'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                E-mail & Mot de passe
              </button>
            </div>

            {authMethod === 'google' ? (
              <div className="space-y-4">
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-950 space-y-1.5">
                  <div className="font-bold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Connexion persistante (inscription unique)</span>
                  </div>
                  <p className="text-emerald-900/90 leading-relaxed">
                    Connectez-vous une seule fois : votre session reste active sur votre téléphone Android ou iOS pour accéder directement à votre tableau de bord, sans jamais refaire d&apos;inscription.
                  </p>
                </div>

                {error && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-2.5 text-xs">
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleSignIn}
                  className="w-full py-3 min-h-[48px] bg-slate-900 hover:bg-emerald-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-3 disabled:opacity-60"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
                    />
                  </svg>
                  <span>{loading ? 'Connexion en cours...' : 'Continuer avec Google'}</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleEmailPasswordAuth} className="space-y-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">
                    {emailMode === 'login' ? 'Connexion par e-mail' : 'Créer un compte par e-mail'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailMode(emailMode === 'login' ? 'register' : 'login');
                      setError('');
                    }}
                    className="font-semibold text-emerald-700 hover:text-emerald-800 underline"
                  >
                    {emailMode === 'login' ? 'Créer un compte' : 'Déjà inscrit ? Se connecter'}
                  </button>
                </div>

                {emailMode === 'register' && (
                  <div className="space-y-1">
                    <label htmlFor="auth-fullname" className="text-xs font-semibold text-slate-700">
                      Nom complet
                    </label>
                    <input
                      id="auth-fullname"
                      type="text"
                      value={fullNameInput}
                      onChange={(e) => setFullNameInput(e.target.value)}
                      placeholder="Ex: Jean Mba"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label htmlFor="auth-email" className="text-xs font-semibold text-slate-700">
                    Adresse e-mail *
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="exemple@domaine.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="auth-password" className="text-xs font-semibold text-slate-700">
                    Mot de passe *
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={6}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>

                {error && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-2.5 text-xs leading-relaxed">
                    {error}
                  </div>
                )}

                {infoNotice && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-2.5 text-xs leading-relaxed">
                    {infoNotice}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 min-h-[46px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>
                    {loading
                      ? 'Traitement...'
                      : emailMode === 'login'
                      ? 'Se connecter'
                      : 'Créer le compte'}
                  </span>
                </button>
              </form>
            )}
          </div>
        ) : needsEmailVerification ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-xs text-amber-950">
              <div className="font-bold flex items-center gap-2">
                <MailCheck className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Confirmez votre adresse e-mail ({googleUser.email})</span>
              </div>
              <p className="leading-relaxed text-amber-900">
                Pour protéger les données clients et activer vos permissions Firestore, veuillez cliquer sur le lien de vérification envoyé à votre adresse e-mail, puis actualisez ci-dessous.
              </p>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-2.5 text-xs">
                {error}
              </div>
            )}

            {infoNotice && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-2.5 text-xs">
                {infoNotice}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={handleCheckVerification}
                className="flex-1 py-3 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>J'ai vérifié mon e-mail</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleResendVerification}
                className="py-3 px-4 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl"
              >
                Renvoyer le lien
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateProfile} className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center gap-3">
              {googleUser.photoURL && (
                <img
                  src={googleUser.photoURL}
                  alt={googleUser.displayName || 'Profil'}
                  className="w-10 h-10 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {googleUser.displayName || fullNameInput || googleUser.email}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{googleUser.email}</div>
              </div>
            </div>

            {!isAdminEmail && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 block">
                  Type de compte
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedRole('client')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      selectedRole === 'client'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <User className="w-4 h-4 mb-1" />
                    <div className="text-xs font-bold">Client</div>
                    <div
                      className={`text-[10px] ${
                        selectedRole === 'client' ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      Accès immédiat
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('manager')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      selectedRole === 'manager'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 className="w-4 h-4 mb-1" />
                    <div className="text-xs font-bold">Entreprise</div>
                    <div
                      className={`text-[10px] ${
                        selectedRole === 'manager' ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      Validé par Admin
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole('agent')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      selectedRole === 'agent'
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Wrench className="w-4 h-4 mb-1" />
                    <div className="text-xs font-bold">Agent</div>
                    <div
                      className={`text-[10px] ${
                        selectedRole === 'agent' ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      Technicien terrain
                    </div>
                  </button>
                </div>
              </div>
            )}

            {selectedRole === 'manager' && !isAdminEmail && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="text-xs font-bold text-amber-950">
                  Inscription Entreprise (soumise à validation administrateur)
                </div>
                <div className="space-y-1">
                  <label htmlFor="comp-name" className="text-xs font-semibold text-slate-700">
                    Nom de l'entreprise *
                  </label>
                  <input
                    id="comp-name"
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Gabon Clean Express"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="comp-desc" className="text-xs font-semibold text-slate-700">
                    Description des services proposés *
                  </label>
                  <textarea
                    id="comp-desc"
                    rows={3}
                    required
                    value={companyDescription}
                    onChange={(e) => setCompanyDescription(e.target.value)}
                    placeholder="Décrivez vos spécialités (ex: Nettoyage BTP, canapés, lavage auto à Akanda...)"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="onb-phone" className="text-xs font-semibold text-slate-700">
                  Numéro WhatsApp (format international) *
                </label>
                <input
                  id="onb-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (!phoneTouched) setPhoneTouched(true);
                  }}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder="+241 065 96 12 38"
                  className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 ${
                    phoneTouched && !isPhoneValid
                      ? 'border-rose-400 focus:ring-rose-500'
                      : 'border-slate-200 focus:ring-emerald-700'
                  }`}
                />
                {phoneTouched && !isPhoneValid ? (
                  <p className="text-[11px] text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>Indicatif international requis (ex: +241 065 96 12 38)</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Obligatoire · Indicatif Gabon (+241) ou international
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="onb-commune" className="text-xs font-semibold text-slate-700">
                  Commune principale
                </label>
                <select
                  id="onb-commune"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                >
                  <option value="Libreville Centre">Libreville Centre</option>
                  <option value="Akanda">Akanda</option>
                  <option value="Owendo">Owendo</option>
                  <option value="Ntoum">Ntoum</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  id="onb-cgu"
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700 shrink-0 cursor-pointer"
                />
                <span className="text-xs text-slate-700 leading-relaxed">
                  J'accepte les conditions d'utilisation et la politique de confidentialité de Shine-x-Sanitize Alp Group
                </span>
              </label>

              <div className="pl-6">
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 underline inline-flex items-center gap-1"
                >
                  <FileText className="w-3 h-3" />
                  <span>Consulter les conditions d'utilisation et la politique de confidentialité</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-2.5 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Enregistrer mon compte</span>
            </button>
          </form>
        )}
      </div>

      {/* Legal CGU & Privacy Policy Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  Conditions d'Utilisation & Politique de Confidentialité
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                aria-label="Fermer les conditions légales"
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700 leading-relaxed">
              <section className="space-y-1.5">
                <h4 className="font-bold text-slate-900">
                  1. Objet et Portée — Shine-x-Sanitize Alp Group
                </h4>
                <p>
                  La plateforme Shine-x-Sanitize Alp Group met en relation les particuliers, professionnels et entreprises de nettoyage (mobilier, BTP, véhicules & mobilité) opérant dans le Grand Libreville (Libreville, Akanda, Owendo, Ntoum) au Gabon.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-slate-900">
                  2. Numéro WhatsApp & Confidentialité des Réservations
                </h4>
                <p>
                  Chaque utilisateur certifie l'exactitude de son numéro WhatsApp au format international. L'historique de vos réservations est strictement personnel et isolé : aucun autre client ne peut accéder à vos commandes ou adresses.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-slate-900">
                  3. Géolocalisation GPS & Preuves Photographiques
                </h4>
                <p>
                  L'activation du suivi GPS par le client ou l'agent est volontaire et strictement limitée à la durée active de la prestation commandée. Les photos avant et après intervention servent à attester la qualité et la clôture de la mission.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-slate-900">
                  4. Règles des Entreprises, Agents & Paiements
                </h4>
                <p>
                  Les comptes entreprises sont soumis à l'approbation préalable de l'administrateur central. Un agent en mission active ne peut être affecté simultanément à une autre commande avant la clôture complète de son intervention. Les paiements s'effectuent en XAF (Airtel Money, Moov Money, Espèces ou Carte bancaire).
                </p>
              </section>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="px-4 py-2 min-h-[40px] bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-semibold rounded-xl"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => {
                  setAcceptedTerms(true);
                  setShowTermsModal(false);
                }}
                className="px-4 py-2 min-h-[40px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl"
              >
                J'ai lu et j'accepte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
