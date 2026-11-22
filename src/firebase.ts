import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported, type Analytics } from 'firebase/analytics';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import { doc, getDocFromServer, initializeFirestore } from 'firebase/firestore';
import { ADMIN_BOOTSTRAP_DIGEST } from './data/mockData';

// Firebase project "shinexsanitize2" — the only project this app connects to.
// Intentionally not overridable via environment variables so the app can never
// be pointed at (or mix identifiers from) another Firebase project.
const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyCB4t-bhTiOpd-1vpfJ0uYOiMfAyLGfSxc',
  authDomain: 'shinexsanitize2.firebaseapp.com',
  projectId: 'shinexsanitize2',
  storageBucket: 'shinexsanitize2.firebasestorage.app',
  messagingSenderId: '710885153983',
  appId: '1:710885153983:web:1a68b273869b1f18127a0a',
  measurementId: 'G-C22H4T9GVY',
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const firebaseProjectId = firebaseConfig.projectId as string;
export const firebaseAuthDomain = firebaseConfig.authDomain as string;

// Analytics only runs where the browser supports it (not in SSR/tests or
// when IndexedDB/cookies are blocked), so it never breaks app startup.
export const analyticsReady: Promise<Analytics | null> = isAnalyticsSupported()
  .then((supported) => (supported ? getAnalytics(app) : null))
  .catch(() => null);

export function normalizeNameSlug(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildClassicAuthEmail(lastName: string, firstName: string): string {
  const lastSlug = normalizeNameSlug(lastName);
  const firstSlug = normalizeNameSlug(firstName);
  return `${lastSlug}.${firstSlug}@shinexsanitize.app`;
}

export function isDefaultAdminIdentity(lastName: string, firstName: string): boolean {
  return (
    normalizeNameSlug(lastName) === 'zemby' && normalizeNameSlug(firstName) === 'maliq'
  );
}

export async function verifyAdminBootstrapPassword(password: string): Promise<boolean> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(password);
    const buffer = await crypto.subtle.digest('SHA-256', encoded);
    const hex = Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hex === ADMIN_BOOTSTRAP_DIGEST;
  }
  return false;
}

export function formatClassicAuthError(
  err: unknown,
  authMethod: 'password' | 'google' = 'password'
): string {
  const code = (err as { code?: string })?.code || '';

  if (code === 'auth/operation-not-allowed') {
    if (authMethod === 'google') {
      return `La connexion avec Google n'est pas encore activée dans Firebase (${firebaseProjectId}). Ouvrez Firebase Console → Authentication → Sign-in method → activez « Google ».`;
    }
    return `La connexion par mot de passe n'est pas encore activée dans Firebase (${firebaseProjectId}). Ouvrez Firebase Console → Authentication → Sign-in method → activez « Adresse e-mail/Mot de passe ».`;
  }
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'ce domaine';
    return `Le domaine « ${host} » n'est pas autorisé pour Google Sign-In dans Firebase (${firebaseProjectId}). Ajoutez-le dans Firebase Console → Authentication → Settings → Authorized domains.`;
  }
  if (code === 'auth/popup-closed-by-user') {
    return "La fenêtre de connexion Google a été fermée avant la fin de l'authentification.";
  }
  if (code === 'auth/cancelled-popup-request') {
    return 'Une autre tentative de connexion Google est déjà en cours.';
  }
  if (code === 'auth/popup-blocked') {
    return 'La fenêtre Google a été bloquée par votre navigateur. Autorisez les popups pour ce site puis réessayez.';
  }
  if (code === 'auth/account-exists-with-different-credential') {
    return 'Un compte existe déjà avec cette adresse e-mail via une autre méthode de connexion.';
  }
  if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return "Nom, prénom ou mot de passe incorrect. Vérifiez vos informations ou créez un compte dans l'onglet « Inscription ».";
  }
  if (code === 'auth/email-already-in-use') {
    return "Un compte existe déjà avec ce Nom et ce Prénom. Connectez-vous dans l'onglet « Connexion » ou ajoutez un second prénom.";
  }
  if (code === 'auth/weak-password') {
    return 'Le mot de passe doit contenir au moins 6 caractères.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Trop de tentatives. Patientez quelques instants avant de réessayer.';
  }
  if (code === 'auth/api-key-not-valid' || code === 'auth/invalid-api-key') {
    return `Clé API Firebase non reconnue pour « ${firebaseProjectId} ». Vérifiez la configuration Firebase et que Authentication est activé.`;
  }
  if (code === 'auth/network-request-failed') {
    return "Erreur réseau pendant l'authentification (auth/network-request-failed). Vérifiez votre connexion Internet, désactivez un éventuel VPN ou bloqueur réseau, ou testez sur un autre réseau (Wi-Fi / 4G) si le problème persiste.";
  }
  return err instanceof Error
    ? err.message
    : "Impossible de finaliser l'authentification. Réessayez.";
}

export const authPersistenceReady: Promise<void> = setPersistence(
  auth,
  indexedDBLocalPersistence
).catch(() =>
  setPersistence(auth, browserLocalPersistence).catch(() => {
    // Default persistence active
  })
);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

testConnection();
