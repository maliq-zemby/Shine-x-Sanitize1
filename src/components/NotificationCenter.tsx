import React, { useState } from 'react';
import {
  Bell,
  BellRing,
  CheckCheck,
  ClipboardList,
  Megaphone,
  UserPlus,
  Wrench,
  X,
} from 'lucide-react';
import { ActiveTabId, AppNotification, NotificationType } from '../types';
import { PushPermissionState } from '../utils/notifications';

interface NotificationCenterProps {
  notifications: AppNotification[];
  readIds: string[];
  pushPermission: PushPermissionState;
  onEnablePush: () => Promise<void>;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNavigateTab: (tab: ActiveTabId) => void;
}

const TYPE_META: Record<
  NotificationType,
  { label: string; badgeClass: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  new_booking: {
    label: 'Nouvelle commande',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    Icon: ClipboardList,
  },
  agent_assigned: {
    label: 'Mission affectée',
    badgeClass: 'bg-sky-100 text-sky-800',
    Icon: Wrench,
  },
  new_registration: {
    label: 'Nouvelle inscription',
    badgeClass: 'bg-amber-100 text-amber-800',
    Icon: UserPlus,
  },
  promo_approved: {
    label: 'Promotion validée',
    badgeClass: 'bg-emerald-900 text-amber-300',
    Icon: Megaphone,
  },
};

function formatNotifTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return "À l'instant";
  }
}

export const NotificationBell: React.FC<NotificationCenterProps> = ({
  notifications,
  readIds,
  pushPermission,
  onEnablePush,
  onMarkAsRead,
  onMarkAllAsRead,
  onNavigateTab,
}) => {
  const [open, setOpen] = useState(false);
  const [requestingPush, setRequestingPush] = useState(false);

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;

  const handleRequestPush = async () => {
    setRequestingPush(true);
    try {
      await onEnablePush();
    } finally {
      setRequestingPush(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Centre de notifications en temps réel"
        className="relative w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 flex items-center justify-center transition-colors shrink-0"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-950/20"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-12 z-50 w-[calc(100vw-1.5rem)] sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[78vh]">
            <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-slate-900">
                  Notifications temps réel
                </span>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={onMarkAllAsRead}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Tout lire</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer les notifications"
                  className="w-7 h-7 rounded-lg bg-slate-200/70 hover:bg-slate-200 flex items-center justify-center text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {pushPermission === 'default' && (
              <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between gap-3">
                <div className="text-[11px] text-emerald-950 leading-snug">
                  Activez les alertes push mobiles pour recevoir commandes, inscriptions et promos en direct.
                </div>
                <button
                  type="button"
                  disabled={requestingPush}
                  onClick={handleRequestPush}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold rounded-lg whitespace-nowrap shrink-0"
                >
                  {requestingPush ? '...' : 'Activer Push'}
                </button>
              </div>
            )}

            {pushPermission === 'granted' && (
              <div className="px-4 py-2 bg-emerald-50/60 border-b border-emerald-100 text-[11px] text-emerald-800 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                <span>Alertes push temps réel actives sur cet appareil</span>
              </div>
            )}

            <div className="overflow-y-auto divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Aucune alerte pour votre profil pour le moment.
                </div>
              ) : (
                notifications.map((notif) => {
                  const isUnread = !readIds.includes(notif.id);
                  const meta = TYPE_META[notif.type];
                  const Icon = meta.Icon;

                  return (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => {
                        onMarkAsRead(notif.id);
                        if (notif.relatedTab) {
                          onNavigateTab(notif.relatedTab);
                        }
                        setOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3.5 hover:bg-slate-50 transition-colors flex items-start gap-3 ${
                        isUnread ? 'bg-emerald-50/35' : 'bg-white'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${meta.badgeClass}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                            {formatNotifTime(notif.createdAt)}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                          )}
                          <span className="truncate">{notif.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {notif.body}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

interface LiveNotificationToastProps {
  notification: AppNotification | null;
  onDismiss: () => void;
  onOpenTarget: (notif: AppNotification) => void;
}

export const LiveNotificationToast: React.FC<LiveNotificationToastProps> = ({
  notification,
  onDismiss,
  onOpenTarget,
}) => {
  if (!notification) return null;
  const meta = TYPE_META[notification.type];
  const Icon = meta.Icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 lg:bottom-5 right-4 z-50 max-w-sm w-[calc(100vw-2rem)] bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700 flex items-start gap-3"
    >
      <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-300">
          {meta.label} · Temps réel
        </div>
        <div className="text-xs font-bold text-white leading-snug">{notification.title}</div>
        <p className="text-[11px] text-slate-300 leading-relaxed">{notification.body}</p>
        <div className="pt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenTarget(notification)}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded-lg transition-colors"
          >
            Consulter
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="px-2.5 py-1 text-slate-300 hover:text-white text-[11px] font-medium"
          >
            Ignorer
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer l'alerte"
        className="text-slate-400 hover:text-white shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
