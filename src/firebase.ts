import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: 'AIzaSyCB4t-bhTi0pd-1vpfJ0uYOiMfAyLGFsXc',
  authDomain: 'shinexsanitize2.firebaseapp.com',
  projectId: 'shinexsanitize2',
  storageBucket: 'shinexsanitize2.firebasestorage.app',
  messagingSenderId: '710885153983',
  appId: '1:710885153983:web:1a68b273869b1f18127a0a',
  measurementId: 'G-C22H4T9GVY',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const firebaseProjectId = firebaseConfig.projectId;
export const firebaseAuthDomain = firebaseConfig.authDomain;

export function formatGoogleAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const host =
    typeof window !== 'undefined' ? window.location.hostname : 'shinexsanitize1.netlify.app';

  if (code === 'auth/unauthorized-domain') {
    return `Domaine « ${host} » non autorisé dans le projet Firebase « ${firebaseProjectId} ». Ajoutez « ${host} » dans Firebase Console (${firebaseProjectId}) → Authentication → Settings → Authorized domains.`;
  }
  if (code === 'auth/popup-blocked') {
    return "La fenêtre pop-up Google a été bloquée par votre navigateur. Utilisez la connexion par redirection ci-dessous.";
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return "La connexion Google a été annulée avant la fin. Vous pouvez réessayer ou utiliser la redirection.";
  }
  if (code === 'auth/missing-initial-state' || code === 'auth/web-storage-unsupported') {
    return "Votre navigateur mobile bloque le stockage temporaire de redirection. Essayez en navigation standard (non privée), autorisez les cookies tiers pour firebaseapp.com ou connectez-vous par E-mail & Mot de passe.";
  }
  if (code === 'auth/api-key-not-valid' || code === 'auth/invalid-api-key') {
    return `Clé API Firebase non reconnue pour « ${firebaseProjectId} ». Vérifiez dans Google Cloud Console (APIs & Services → Credentials) que la clé n'a pas de restriction de domaine bloquant « ${host} » et qu'Authentication est activé dans Firebase Console.`;
  }
  if (code === 'auth/network-request-failed') {
    return "Erreur réseau pendant l'authentification. Vérifiez votre connexion Internet et réessayez.";
  }
  return err instanceof Error
    ? err.message
    : 'Impossible de finaliser la connexion Google. Réessayez.';
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
