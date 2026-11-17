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
    body: notif.body,
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
