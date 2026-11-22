import React, { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  LogIn,
  ShieldCheck,
  User,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';
import {
  ADMIN_BOOTSTRAP_EMAIL,
  ADMIN_BOOTSTRAP_EMAILS,
  ADMIN_DISPLAY_NAME,
  ADMIN_FIRST_NAME,
  ADMIN_LAST_NAME,
  ADMIN_WHATSAPP_PHONE,
  APP_OFFICIAL_NAME,
  BRAND_LOGO_URL,
} from '../data/mockData';
import {
  auth,
  authPersistenceReady,
  buildClassicAuthEmail,
  db,
  formatClassicAuthError,
  googleProvider,
  isDefaultAdminIdentity,
  verifyAdminBootstrapPassword,
} from '../firebase';
import { Role, UserProfile } from '../types';

type RegistrationRole = 'client' | 'manager' | 'agent';

const ALLOWED_REGISTRATION_ROLES: ReadonlySet<string> = new Set([
  'client',
  'manager',
  'agent',
]);

interface AuthModalProps {
  initialMode?: 'login' | 'register';
  initialError?: string;
  pendingGoogleUser?: FirebaseUser | null;
  initialPartialProfile?: Partial<UserProfile> | null;
  onAuthComplete: (profile: UserProfile) => Promise<void> | void;
  onLoginSuccess?: () => void;
  onBeginGoogleCompletion?: (uid: string) => void;
  onCancelGoogleOnboarding?: () => Promise<void> | void;
  onClose: () => void;
}

const WHATSAPP_INTERNATIONAL_REGEX = /^\+[1-9][0-9\s\-]{6,30}$/;

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
    />
  </svg>
);

async function withNetworkRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/network-request-failed' && attempt < maxRetries) {
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, 650 * attempt));
        continue;
      }
      throw err;
    }
  }
}

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0].slice(0, 80), lastName: '' };
  }
  const firstName = parts[0].slice(0, 80);
  const lastName = parts.slice(1).join(' ').slice(0, 80);
  return { firstName, lastName };
}

function hasCompleteExistingStatus(data: Partial<UserProfile> | null | undefined): boolean {
  if (!data || !data.role) return false;
  if (!['client', 'agent', 'manager', 'admin'].includes(data.role)) return false;
  return Boolean(data.accountStatus || data.status);
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode = 'login',
  initialError = '',
  pendingGoogleUser = null,
  initialPartialProfile = null,
  onAuthComplete,
  onLoginSuccess,
  onBeginGoogleCompletion,
  onCancelGoogleOnboarding,
  onClose,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [selectedRole, setSelectedRole] = useState<RegistrationRole>('client');
  const [hasExplicitRoleChoice, setHasExplicitRoleChoice] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [phone, setPhone] = useState('+241 ');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [commune, setCommune] = useState('Amissa Chantal, Akanda');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Google Auth & Post-Google Status Selection State
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(pendingGoogleUser);
  const [googlePartialProfile, setGooglePartialProfile] =
    useState<Partial<UserProfile> | null>(initialPartialProfile);
  const [googleDisplayName, setGoogleDisplayName] = useState('');
  const [googleRole, setGoogleRole] = useState<RegistrationRole | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);

  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

  useEffect(() => {
    if (googleLoading || !pendingGoogleUser || googleUser?.uid === pendingGoogleUser.uid) return;
    setGoogleUser(pendingGoogleUser);
    setGooglePartialProfile(initialPartialProfile || null);
    setGoogleDisplayName(
      (initialPartialProfile?.displayName || pendingGoogleUser.displayName || '').slice(0, 120)
    );
    if (initialPartialProfile?.phone) {
      setPhone(initialPartialProfile.phone);
    }
    if (initialPartialProfile?.commune) {
      setCommune(initialPartialProfile.commune);
    }
    if (initialPartialProfile?.companyName) {
      setCompanyName(initialPartialProfile.companyName);
    }
    if (initialPartialProfile?.companyDescription) {
      setCompanyDescription(initialPartialProfile.companyDescription);
    }
    setError('');
  }, [pendingGoogleUser, initialPartialProfile, googleLoading, googleUser?.uid]);

  const isGoogleOnboarding = Boolean(googleUser);

  const trimmedLastName = lastName.trim();
  const trimmedFirstName = firstName.trim();
  const trimmedPhone = phone.trim();
  const digitsOnlyCount = trimmedPhone.replace(/\D/g, '').length;
  const isPhoneValid =
    WHATSAPP_INTERNATIONAL_REGEX.test(trimmedPhone) &&
    trimmedPhone.length >= 8 &&
    trimmedPhone.length <= 40 &&
    digitsOnlyCount >= 9;

  const activeRoleForValidation: RegistrationRole | null = isGoogleOnboarding
    ? googleRole
    : selectedRole;

  const isCompanyValid =
    activeRoleForValidation !== 'manager' || companyName.trim().length >= 2;

  const canRegister =
    trimmedLastName.length >= 2 &&
    trimmedFirstName.length >= 2 &&
    password.length >= 6 &&
    isPhoneValid &&
    isCompanyValid &&
    acceptedTerms;

  const trimmedGoogleName = googleDisplayName.trim();
  const canCompleteGoogleOnboarding =
    Boolean(googleUser) &&
    googleRole !== null &&
    ALLOWED_REGISTRATION_ROLES.has(googleRole) &&
    trimmedGoogleName.length >= 1 &&
    isPhoneValid &&
    isCompanyValid &&
    acceptedTerms;

  const buildAdminProfile = (uid: string, customEmail?: string): UserProfile => {
    const now = new Date().toISOString();
    return {
      uid,
      email: customEmail || ADMIN_BOOTSTRAP_EMAIL,
      displayName: ADMIN_DISPLAY_NAME,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      role: 'admin',
      status: 'approved',
      accountStatus: 'active',
      rejectionReason: '',
      phone: ADMIN_WHATSAPP_PHONE,
      commune: 'Amissa Chantal, Akanda',
      acceptedTerms: true,
      acceptedTermsAt: now,
      createdAt: now,
      updatedAt: now,
    };
  };

  const buildAllowedProfile = (params: {
    uid: string;
    email: string;
    displayName: string;
    firstName?: string;
    lastName?: string;
    photoURL?: string | null;
    role: RegistrationRole;
    existingCreatedAt?: string;
  }): UserProfile => {
    const safeRole: RegistrationRole = ALLOWED_REGISTRATION_ROLES.has(params.role)
      ? params.role
      : 'client';
    const now = new Date().toISOString();
    const isCompanyManager = safeRole === 'manager';
    const cleanPhoto =
      params.photoURL && params.photoURL.trim().length > 0 && params.photoURL.length <= 500
        ? params.photoURL.trim()
        : undefined;

    return {
      uid: params.uid,
      email: params.email.trim().slice(0, 160),
      displayName: params.displayName.trim().slice(0, 120),
      ...(params.firstName?.trim()
        ? { firstName: params.firstName.trim().slice(0, 80) }
        : {}),
      ...(params.lastName?.trim()
        ? { lastName: params.lastName.trim().slice(0, 80) }
        : {}),
      ...(cleanPhoto ? { photoURL: cleanPhoto } : {}),
      role: safeRole,
      status: isCompanyManager ? 'pending' : 'approved',
      accountStatus: isCompanyManager ? 'pending' : 'active',
      rejectionReason: '',
      phone: trimmedPhone.slice(0, 40),
      commune: commune.slice(0, 120),
      acceptedTerms: true,
      acceptedTermsAt: now,
      ...(isCompanyManager
        ? {
            companyName: companyName.trim().slice(0, 120),
            ...(companyDescription.trim()
              ? { companyDescription: companyDescription.trim().slice(0, 600) }
              : {}),
          }
        : {}),
      createdAt: params.existingCreatedAt || now,
      updatedAt: now,
    };
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (trimmedLastName.length < 2 || trimmedFirstName.length < 2) {
      setError('Veuillez saisir votre Nom et votre Prénom.');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    const authEmail = buildClassicAuthEmail(trimmedLastName, trimmedFirstName);
    const isAdminCandidate = isDefaultAdminIdentity(trimmedLastName, trimmedFirstName);

    setLoading(true);
    try {
      await authPersistenceReady;
      const cred = await withNetworkRetry(() =>
        signInWithEmailAndPassword(auth, authEmail, password)
      );

      if (isAdminCandidate) {
        const snap = await getDoc(doc(db, 'users', cred.user.uid)).catch(() => null);
        if (!snap || !snap.exists()) {
          await onAuthComplete(buildAdminProfile(cred.user.uid));
          return;
        }
      } else {
        const snap = await getDoc(doc(db, 'users', cred.user.uid)).catch(() => null);
        if (snap && !snap.exists()) {
          setMode('register');
          setError(
            "Votre profil n'est pas encore enregistré. Complétez votre inscription ci-dessous."
          );
          setLoading(false);
          return;
        }
      }

      onLoginSuccess?.();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      const canBootstrapAdmin =
        isAdminCandidate &&
        (code === 'auth/user-not-found' || code === 'auth/invalid-credential') &&
        (await verifyAdminBootstrapPassword(password));

      if (canBootstrapAdmin) {
        try {
          const cred = await withNetworkRetry(() =>
            createUserWithEmailAndPassword(auth, authEmail, password)
          );
          await updateProfile(cred.user, { displayName: ADMIN_DISPLAY_NAME }).catch(() => {});
          await onAuthComplete(buildAdminProfile(cred.user.uid));
          return;
        } catch (bootstrapErr: unknown) {
          setError(formatClassicAuthError(bootstrapErr, 'password'));
        }
      } else {
        setError(formatClassicAuthError(err, 'password'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPhoneTouched(true);

    if (trimmedLastName.length < 2 || trimmedFirstName.length < 2) {
      setError('Veuillez saisir votre Nom et votre Prénom (2 caractères minimum chacun).');
      return;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    const authEmail = buildClassicAuthEmail(trimmedLastName, trimmedFirstName);
    const isAdminCandidate = isDefaultAdminIdentity(trimmedLastName, trimmedFirstName);

    if (isAdminCandidate) {
      const validAdminPass = await verifyAdminBootstrapPassword(password);
      if (!validAdminPass) {
        setError(
          "L'identité ZEMBY Maliq est réservée à l'administrateur principal."
        );
        return;
      }

      setLoading(true);
      try {
        await authPersistenceReady;
        let uid: string;
        try {
          const cred = await withNetworkRetry(() =>
            createUserWithEmailAndPassword(auth, authEmail, password)
          );
          await updateProfile(cred.user, { displayName: ADMIN_DISPLAY_NAME }).catch(() => {});
          uid = cred.user.uid;
        } catch (createErr: unknown) {
          const code = (createErr as { code?: string })?.code || '';
          if (code === 'auth/email-already-in-use') {
            const cred = await withNetworkRetry(() =>
              signInWithEmailAndPassword(auth, authEmail, password)
            );
            uid = cred.user.uid;
          } else {
            throw createErr;
          }
        }
        await onAuthComplete(buildAdminProfile(uid));
      } catch (err: unknown) {
        setError(formatClassicAuthError(err, 'password'));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (selectedRole === 'manager' && companyName.trim().length < 2) {
      setError("Veuillez saisir le nom de votre entreprise (2 caractères minimum).");
      return;
    }
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

    setLoading(true);
    try {
      await authPersistenceReady;
      const cred = await withNetworkRetry(() =>
        createUserWithEmailAndPassword(auth, authEmail, password)
      );
      const formattedLastName = trimmedLastName.toUpperCase();
      const formattedFirstName = trimmedFirstName;
      const fullDisplayName = `${formattedLastName} ${formattedFirstName}`;

      await updateProfile(cred.user, { displayName: fullDisplayName }).catch(() => {});

      const profile = buildAllowedProfile({
        uid: cred.user.uid,
        email: authEmail,
        displayName: fullDisplayName,
        firstName: formattedFirstName,
        lastName: formattedLastName,
        role: selectedRole,
      });

      await onAuthComplete(profile);
    } catch (err: unknown) {
      setError(formatClassicAuthError(err, 'password'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await authPersistenceReady;
      let cred;
      try {
        cred = await withNetworkRetry(() => signInWithPopup(auth, googleProvider));
      } catch (popupErr: unknown) {
        const code = (popupErr as { code?: string })?.code || '';
        if (
          code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment'
        ) {
          await signInWithRedirect(auth, googleProvider);
          return;
        }
        throw popupErr;
      }

      const fbUser = cred.user;
      const isMasterAdmin = Boolean(
        fbUser.email && ADMIN_BOOTSTRAP_EMAILS.has(fbUser.email.toLowerCase())
      );

      const snap = await getDoc(doc(db, 'users', fbUser.uid));
      const existingData = snap.exists() ? (snap.data() as Partial<UserProfile>) : null;

      // Utilisateur existant avec rôle/statut déjà défini : connexion directe sans écraser le statut
      if (hasCompleteExistingStatus(existingData)) {
        onLoginSuccess?.();
        return;
      }

      // Compte administrateur principal pré-configuré
      if (isMasterAdmin && !snap.exists()) {
        await onAuthComplete(
          buildAdminProfile(fbUser.uid, fbUser.email || ADMIN_BOOTSTRAP_EMAIL)
        );
        return;
      }

      // Si l'utilisateur était en mode Inscription et a déjà choisi un statut ET rempli WhatsApp/Entreprise/CGU
      const canFinalizeImmediatelyFromRegister =
        mode === 'register' &&
        hasExplicitRoleChoice &&
        ALLOWED_REGISTRATION_ROLES.has(selectedRole) &&
        isPhoneValid &&
        (selectedRole !== 'manager' || companyName.trim().length >= 2) &&
        acceptedTerms;

      if (canFinalizeImmediatelyFromRegister) {
        onBeginGoogleCompletion?.(fbUser.uid);
        const rawDisplayName =
          existingData?.displayName ||
          fbUser.displayName ||
          (trimmedFirstName || trimmedLastName
            ? `${trimmedLastName.toUpperCase()} ${trimmedFirstName}`.trim()
            : fbUser.email?.split('@')[0] || 'Utilisateur');
        const parsed = splitDisplayName(rawDisplayName);
        const profile = buildAllowedProfile({
          uid: fbUser.uid,
          email: existingData?.email || fbUser.email || `${fbUser.uid}@google.local`,
          displayName: rawDisplayName,
          firstName: existingData?.firstName || parsed.firstName,
          lastName: existingData?.lastName || parsed.lastName,
          photoURL: existingData?.photoURL || fbUser.photoURL,
          role: selectedRole,
          existingCreatedAt: existingData?.createdAt,
        });
        await onAuthComplete(profile);
        return;
      }

      // Sinon : afficher l'étape dédiée de sélection du statut pré-remplie depuis Google
      setGoogleUser(fbUser);
      setGooglePartialProfile(existingData);
      setGoogleDisplayName(
        (existingData?.displayName || fbUser.displayName || fbUser.email?.split('@')[0] || '').slice(
          0,
          120
        )
      );
      if (existingData?.phone) setPhone(existingData.phone);
      if (existingData?.commune) setCommune(existingData.commune);
      if (existingData?.companyName) setCompanyName(existingData.companyName);
      if (existingData?.companyDescription) {
        setCompanyDescription(existingData.companyDescription);
      }
      setGoogleRole(mode === 'register' && hasExplicitRoleChoice ? selectedRole : null);
      setPhoneTouched(false);
    } catch (err: unknown) {
      setError(formatClassicAuthError(err, 'google'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleCompleteGoogleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleUser) return;

    setError('');
    setPhoneTouched(true);

    if (!googleRole || !ALLOWED_REGISTRATION_ROLES.has(googleRole)) {
      setError('Veuillez sélectionner votre profil (Client, Entreprise ou Agent).');
      return;
    }
    if (trimmedGoogleName.length < 1) {
      setError('Veuillez renseigner votre nom complet.');
      return;
    }
    if (googleRole === 'manager' && companyName.trim().length < 2) {
      setError("Veuillez saisir le nom de votre entreprise (2 caractères minimum).");
      return;
    }
    if (!isPhoneValid) {
      setError(
        'Veuillez renseigner un numéro WhatsApp valide au format international (ex : +241 065 96 12 38).'
      );
      return;
    }
    if (!acceptedTerms) {
      setError(
        "Vous devez accepter les conditions d'utilisation et la politique de confidentialité pour finaliser votre inscription."
      );
      return;
    }

    setLoading(true);
    onBeginGoogleCompletion?.(googleUser.uid);
    try {
      const parsed = splitDisplayName(trimmedGoogleName);
      const profile = buildAllowedProfile({
        uid: googleUser.uid,
        email:
          googlePartialProfile?.email ||
          googleUser.email ||
          `${googleUser.uid}@google.local`,
        displayName: trimmedGoogleName,
        firstName: googlePartialProfile?.firstName || parsed.firstName,
        lastName: googlePartialProfile?.lastName || parsed.lastName,
        photoURL: googlePartialProfile?.photoURL || googleUser.photoURL,
        role: googleRole,
        existingCreatedAt: googlePartialProfile?.createdAt,
      });

      if (trimmedGoogleName !== (googleUser.displayName || '')) {
        await updateProfile(googleUser, { displayName: profile.displayName }).catch(() => {});
      }

      await onAuthComplete(profile);
    } catch (err: unknown) {
      setError(formatClassicAuthError(err, 'google'));
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchGoogleAccount = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      if (onCancelGoogleOnboarding) {
        await onCancelGoogleOnboarding();
      } else {
        await signOut(auth);
      }
      setGoogleUser(null);
      setGooglePartialProfile(null);
      setGoogleRole(null);
      setGoogleDisplayName('');
    } finally {
      setGoogleLoading(false);
    }
  };

  const renderRoleSelector = (
    current: Role | null,
    onSelect: (role: RegistrationRole) => void
  ) => (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-700 block">
        Profil / Statut *
      </label>
      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => onSelect('client')}
          className={`p-3 rounded-xl border text-left transition-colors ${
            current === 'client'
              ? 'bg-emerald-700 text-white border-emerald-700'
              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <User className="w-4 h-4 mb-1" />
          <div className="text-xs font-bold">Client</div>
          <div
            className={`text-[10px] ${
              current === 'client' ? 'text-emerald-100' : 'text-slate-500'
            }`}
          >
            Accès immédiat
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelect('manager')}
          className={`p-3 rounded-xl border text-left transition-colors ${
            current === 'manager'
              ? 'bg-emerald-700 text-white border-emerald-700'
              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-4 h-4 mb-1" />
          <div className="text-xs font-bold">Entreprise</div>
          <div
            className={`text-[10px] ${
              current === 'manager' ? 'text-emerald-100' : 'text-slate-500'
            }`}
          >
            Validé par Admin
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelect('agent')}
          className={`p-3 rounded-xl border text-left transition-colors ${
            current === 'agent'
              ? 'bg-emerald-700 text-white border-emerald-700'
              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Wrench className="w-4 h-4 mb-1" />
          <div className="text-xs font-bold">Agent</div>
          <div
            className={`text-[10px] ${
              current === 'agent' ? 'text-emerald-100' : 'text-slate-500'
            }`}
          >
            Terrain GPS
          </div>
        </button>
      </div>
    </div>
  );

  const renderCompanyFields = () => (
    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3">
      <div className="text-xs font-bold text-amber-950">
        Informations Entreprise (soumises à validation administrateur)
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
          Description des services (optionnel)
        </label>
        <textarea
          id="comp-desc"
          rows={2}
          value={companyDescription}
          onChange={(e) => setCompanyDescription(e.target.value)}
          placeholder="Ex: Nettoyage BTP, canapés, lavage auto à Akanda..."
          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
        />
      </div>
    </div>
  );

  const renderContactAndTerms = () => (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="onb-phone" className="text-xs font-semibold text-slate-700">
            Numéro WhatsApp *
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
              <span>Indicatif requis (ex: +241 065 96 12 38)</span>
            </p>
          ) : (
            <p className="text-[11px] text-slate-500">
              Indicatif Gabon (+241) ou international
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="onb-commune" className="text-xs font-semibold text-slate-700">
            Commune / Quartier principal
          </label>
          <select
            id="onb-commune"
            value={commune}
            onChange={(e) => setCommune(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
          >
            <option value="Amissa Chantal, Akanda">Amissa Chantal, Akanda (Défaut)</option>
            <option value="Akanda (Angondjé / Sablière / Avorbam)">
              Akanda (Angondjé / Sablière / Avorbam)
            </option>
            <option value="Libreville (Batterie 4 / Louis / Glass)">
              Libreville (Batterie 4 / Louis / Glass)
            </option>
            <option value="Libreville (Lalala / Nzeng-Ayong / PK5-PK12)">
              Libreville (Lalala / Nzeng-Ayong / PK5-PK12)
            </option>
            <option value="Owendo (Carrefour SNI / Alenakiri / Port)">
              Owendo (Carrefour SNI / Alenakiri / Port)
            </option>
            <option value="Ntoum & Périphérie">Ntoum &amp; Périphérie</option>
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
            <span>
              Consulter les conditions d'utilisation et la politique de confidentialité
            </span>
          </button>
        </div>
      </div>
    </>
  );

  const renderGoogleButton = (placement: 'bottom' | 'top' = 'bottom', dividerLabel = 'ou') => (
    <div className="space-y-3">
      {placement === 'bottom' && (
        <div className="relative flex items-center py-0.5">
          <div className="flex-grow border-t border-slate-200" />
          <span className="shrink-0 mx-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {dividerLabel}
          </span>
          <div className="flex-grow border-t border-slate-200" />
        </div>
      )}

      <button
        type="button"
        disabled={loading || googleLoading}
        onClick={handleGoogleAuth}
        className="w-full py-3 min-h-[46px] bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-300 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2.5 disabled:opacity-60"
      >
        <GoogleIcon className="w-4 h-4 shrink-0" />
        <span>
          {googleLoading ? 'Connexion Google en cours...' : 'Continuer avec Google'}
        </span>
      </button>

      {placement === 'top' && (
        <div className="relative flex items-center py-0.5">
          <div className="flex-grow border-t border-slate-200" />
          <span className="shrink-0 mx-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {dividerLabel}
          </span>
          <div className="flex-grow border-t border-slate-200" />
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200 relative my-8">
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
              {isGoogleOnboarding
                ? 'Finalisez votre profil Google — Choix du statut'
                : mode === 'login'
                ? 'Connexion — Google ou Nom, Prénom & Mot de passe'
                : 'Inscription — Client, Entreprise ou Agent'}
            </p>
          </div>
        </div>

        {isGoogleOnboarding && googleUser ? (
          <form onSubmit={handleCompleteGoogleOnboarding} className="space-y-4">
            {/* Google Account Preview Card */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {(googlePartialProfile?.photoURL || googleUser.photoURL) ? (
                  <img
                    src={googlePartialProfile?.photoURL || googleUser.photoURL || ''}
                    alt={googleDisplayName || 'Compte Google'}
                    className="w-10 h-10 rounded-full object-cover border border-emerald-300 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {(googleDisplayName || googleUser.email || 'G')[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-950 truncate flex items-center gap-1.5">
                    <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {googlePartialProfile?.email || googleUser.email}
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    Compte Google vérifié — choisissez votre statut pour continuer
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSwitchGoogleAccount}
                disabled={loading || googleLoading}
                className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg inline-flex items-center gap-1 shrink-0"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Changer</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="google-display-name" className="text-xs font-semibold text-slate-700">
                  Nom complet *
                </label>
                <input
                  id="google-display-name"
                  type="text"
                  required
                  maxLength={120}
                  value={googleDisplayName}
                  onChange={(e) => setGoogleDisplayName(e.target.value)}
                  placeholder="Ex: MBOUMBA Jean"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="google-email-readonly" className="text-xs font-semibold text-slate-700">
                  E-mail Google
                </label>
                <input
                  id="google-email-readonly"
                  type="email"
                  readOnly
                  value={googlePartialProfile?.email || googleUser.email || ''}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-600 cursor-not-allowed focus:outline-none"
                />
              </div>
            </div>

            {renderRoleSelector(googleRole, (role) => {
              setGoogleRole(role);
              setError('');
            })}

            {googleRole === null && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                Sélectionnez votre profil ci-dessus : <strong>Client</strong> (accès immédiat),{' '}
                <strong>Entreprise</strong> (soumis à validation administrateur) ou{' '}
                <strong>Agent</strong>.
              </p>
            )}

            {googleRole === 'manager' && renderCompanyFields()}

            {renderContactAndTerms()}

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-2.5 text-xs leading-relaxed">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !canCompleteGoogleOnboarding}
              className="w-full py-3 min-h-[46px] bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {loading
                  ? 'Enregistrement du profil...'
                  : 'Finaliser mon inscription Google'}
              </span>
            </button>
          </form>
        ) : (
          <>
            {/* Mode Switch: Connexion vs Inscription */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setHasExplicitRoleChoice(false);
                  setError('');
                }}
                className={`py-2.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Se connecter</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className={`py-2.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Créer un compte</span>
              </button>
            </div>

            {mode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950 space-y-1">
                  <div className="font-bold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Connexion persistante (Google ou Nom & Prénom)</span>
                  </div>
                  <p className="text-emerald-900/90 leading-relaxed">
                    Connectez-vous en un clic avec Google ou entrez votre Nom, Prénom et Mot de passe. Votre session reste active sur votre appareil.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="login-lastname" className="text-xs font-semibold text-slate-700">
                      Nom *
                    </label>
                    <input
                      id="login-lastname"
                      type="text"
                      required
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Ex: ZEMBY"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="login-firstname" className="text-xs font-semibold text-slate-700">
                      Prénom *
                    </label>
                    <input
                      id="login-firstname"
                      type="text"
                      required
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Ex: Maliq"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="login-password" className="text-xs font-semibold text-slate-700">
                    Mot de passe *
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-10 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                      }
                      className="absolute inset-y-0 right-2.5 flex items-center text-slate-500 hover:text-slate-800"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-2.5 text-xs leading-relaxed">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full py-3 min-h-[48px] bg-slate-900 hover:bg-emerald-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{loading ? 'Connexion en cours...' : 'Se connecter'}</span>
                </button>

                {renderGoogleButton()}
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {renderGoogleButton('top', 'ou avec Nom, Prénom & Mot de passe')}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="reg-lastname" className="text-xs font-semibold text-slate-700">
                      Nom *
                    </label>
                    <input
                      id="reg-lastname"
                      type="text"
                      required
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Ex: MBOUMBA"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="reg-firstname" className="text-xs font-semibold text-slate-700">
                      Prénom *
                    </label>
                    <input
                      id="reg-firstname"
                      type="text"
                      required
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Ex: Jean"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="reg-password" className="text-xs font-semibold text-slate-700">
                    Mot de passe * (6 caractères minimum)
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-10 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                      }
                      className="absolute inset-y-0 right-2.5 flex items-center text-slate-500 hover:text-slate-800"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {renderRoleSelector(selectedRole, (role) => {
                  setSelectedRole(role);
                  setHasExplicitRoleChoice(true);
                })}

                {selectedRole === 'manager' && renderCompanyFields()}

                {renderContactAndTerms()}

                {error && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-2.5 text-xs leading-relaxed">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || googleLoading || !canRegister}
                  className="w-full py-3 min-h-[46px] bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{loading ? 'Création du compte...' : 'Créer mon compte'}</span>
                </button>
              </form>
            )}
          </>
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
