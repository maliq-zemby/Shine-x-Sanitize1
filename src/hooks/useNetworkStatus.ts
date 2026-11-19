import { useCallback, useEffect, useRef, useState } from 'react';
import { testConnection } from '../firebase';

export type NetworkGateStatus = 'checking' | 'online' | 'offline';

async function probeRealInternet(timeoutMs = 4500): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  const controller = new AbortController();
  let timer: number | undefined;

  const fetchProbe = fetch(
    `https://www.gstatic.com/generate_204?_t=${Date.now()}`,
    {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    }
  ).then(() => true);

  const firestoreProbe = testConnection().then((ok) => {
    if (!ok) {
      throw new Error('Firestore unreachable');
    }
    return true;
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => {
      controller.abort();
      reject(new Error('Network probe timeout'));
    }, timeoutMs);
  });

  try {
    await Promise.race([Promise.any([fetchProbe, firestoreProbe]), timeoutPromise]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer !== undefined) {
      window.clearTimeout(timer);
    }
  }
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkGateStatus>('checking');
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const requestIdRef = useRef(0);

  const verifyConnection = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setIsChecking(true);

    const reachable = await probeRealInternet();
    if (reqId !== requestIdRef.current) return reachable;

    setStatus(reachable ? 'online' : 'offline');
    setIsChecking(false);
    return reachable;
  }, []);

  useEffect(() => {
    verifyConnection();

    const handleOnline = () => {
      verifyConnection();
    };

    const handleOffline = () => {
      requestIdRef.current += 1;
      setIsChecking(false);
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [verifyConnection]);

  // Si l'écran bloquant est affiché alors que navigator.onLine devient true,
  // revérifie périodiquement la connectivité réelle pour déverrouiller automatiquement.
  useEffect(() => {
    if (status !== 'offline') return;

    const intervalId = window.setInterval(() => {
      if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        verifyConnection();
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [status, verifyConnection]);

  return {
    status,
    isChecking,
    retry: verifyConnection,
  };
}
