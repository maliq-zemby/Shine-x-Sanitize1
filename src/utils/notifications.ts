import { AppNotification, UserProfile } from '../types';

const PROFILE_CACHE_PREFIX = 'sxs_alp_profile_uid_';
const READ_NOTIFS_PREFIX = 'sxs_alp_read_notifs_';

export function getCachedProfileForUid(uid: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    return parsed?.uid === uid ? parsed : null;
  } catch {
    return null;
  }
}

export function setCachedProfileForUid(profile: UserProfile): void {
  try {
    localStorage.setItem(`${PROFILE_CACHE_PREFIX}${profile.uid}`, JSON.stringify(profile));
  } catch {
    // ignore storage errors
  }
}

export function clearCachedProfileForUid(uid: string): void {
  try {
    localStorage.removeItem(`${PROFILE_CACHE_PREFIX}${uid}`);
  } catch {
    // ignore
  }
}

export function getReadNotificationIds(uid: string): string[] {
  try {
    const raw = localStorage.getItem(`${READ_NOTIFS_PREFIX}${uid}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReadNotificationIds(uid: string, ids: string[]): void {
  try {
    const trimmed = ids.slice(-200);
    localStorage.setItem(`${READ_NOTIFS_PREFIX}${uid}`, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export type PushPermissionState = NotificationPermission | 'unsupported';

export function getPushPermissionState(): PushPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestPushPermission(): Promise<PushPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export async function showBrowserPushNotification(notif: AppNotification): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const options: NotificationOptions = {
    body: notif.message || notif.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: notif.id,
    data: {
      relatedId: notif.relatedId,
      relatedTab: notif.relatedTab || 'home',
    },
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(notif.title, options);
        return;
      }
    }
    new Notification(notif.title, options);
  } catch {
    try {
      new Notification(notif.title, options);
    } catch {
      // ignore environments restricting direct Notification constructor
    }
  }
}

export function playAssignmentAlertChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.08, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    playTone(587.33, 0, 0.16);
    playTone(880, 0.14, 0.24);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch {
    // ignore autoplay restriction or unsupported AudioContext
  }
}
