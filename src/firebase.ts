import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  indexedDBLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { ADMIN_BOOTSTRAP_DIGEST } from './data/mockData';

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCB4t-bhTi0pd-1vpfJ0uYOiMfAyLGFsXc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'shinexsanitize2.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'shinexsanitize2',
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'shinexsanitize2.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '710885153983',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:710885153983:web:1a68b273869b1f18127a0a',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-C22H4T9GVY',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const firebaseProjectId = firebaseConfig.projectId ?? 'shinexsanitize2';
export const firebaseAuthDomain = firebaseConfig.authDomain ?? 'shinexsanitize2.firebaseapp.com';

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

export function formatClassicAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';

  if (code === 'auth/operation-not-allowed') {
    return `La connexion par mot de passe n'est pas encore activée dans Firebase (${firebaseProjectId}). Ouvrez Firebase Console → Authentication → Sign-in method → activez « Adresse e-mail/Mot de passe ».`;
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
    return "Erreur réseau pendant l'authentification. Vérifiez votre connexion Internet et réessayez.";
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
