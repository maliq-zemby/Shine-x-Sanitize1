import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BellRing,
  Camera,
  CheckCheck,
  CheckCircle2,
  Loader2,
  LocateFixed,
  Lock,
  MapPin,
  Navigation,
  Play,
  Square,
  Tag,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { DEFAULT_GPS_POSITION } from '../data/quartiers';
import { AppNotification, Booking, BookingStatus, GpsPoint } from '../types';
import {
  HIGH_ACCURACY_GEO_OPTIONS,
  reverseGeocodeNeighborhood,
  useReverseGeocodedNeighborhood,
} from '../utils/geocoding';
import { getBookingPromoInfo } from '../utils/promotions';
import { LiveGpsMap } from './LiveGpsMap';

interface AgentWorkspaceViewProps {
  bookings: Booking[];
  agentName: string;
  agentUid?: string;
  isAdminPreview?: boolean;
  notifications?: AppNotification[];
  readNotificationIds?: string[];
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onToggleGps: (bookingId: string, initialPoint?: GpsPoint) => void;
  onUpdateAgentGps: (bookingId: string, point: GpsPoint) => void;
  onStartPlacement: (bookingId: string, beforePhotoUrl?: string) => Promise<void> | void;
  onFinishPlacement: (
    bookingId: string,
    afterPhotoUrl?: string,
    beforePhotoUrl?: string
  ) => Promise<void> | void;
}

const VALIDATED_MISSION_STATUSES: ReadonlySet<BookingStatus> = new Set([
  'confirmed',
  'in_transit',
  'in_progress',
]);

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  confirmed: {
    label: 'Validée · Prête au départ',
    className: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  in_transit: {
    label: 'En route vers le client',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  in_progress: {
    label: 'Intervention en cours',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  completed: {
    label: 'Mission terminée',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
};

function formatAlertTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return "À l'instant";
  }
}

function formatMissionTimestamp(value?: string): string {
  if (!value) return '';
  if (!value.includes('T')) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const datePart = parsed.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = parsed.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} à ${timePart}`;
}

const NeighborhoodLabel: React.FC<{ coords?: GpsPoint | null; fallback?: string }> = ({
  coords,
  fallback,
}) => {
  const name = useReverseGeocodedNeighborhood(coords);
  return <span>{name || fallback || 'Résolution du quartier...'}</span>;
};

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erreur de lecture image'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 640;
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(typeof reader.result === 'string' ? reader.result : '');
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      img.src = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  });
}

export const AgentWorkspaceView: React.FC<AgentWorkspaceViewProps> = ({
  bookings,
  agentName,
  agentUid,
  isAdminPreview = false,
  notifications = [],
  readNotificationIds = [],
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onToggleGps,
  onUpdateAgentGps,
  onStartPlacement,
  onFinishPlacement,
}) => {
  const agentMissions = bookings.filter((b) => {
    if (!VALIDATED_MISSION_STATUSES.has(b.status)) return false;
    if (isAdminPreview) return true;
    const matchesUid = agentUid ? (b.assignedAgentIds || []).includes(agentUid) : false;
    const matchesName = b.assignedAgents.includes(agentName);
    return matchesUid || matchesName;
  });

  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(
    agentMissions[0]?.id || null
  );
  const [beforeDrafts, setBeforeDrafts] = useState<Record<string, string>>({});
  const [afterDrafts, setAfterDrafts] = useState<Record<string, string>>({});
  const [photoErrors, setPhotoErrors] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, 'start' | 'finish' | null>>({});
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [actionSuccess, setActionSuccess] = useState<Record<string, string>>({});
  const [completedBanner, setCompletedBanner] = useState<string | null>(null);

  useEffect(() => {
    if (agentMissions.length === 0) {
      if (selectedMissionId !== null) setSelectedMissionId(null);
      return;
    }
    if (!selectedMissionId || !agentMissions.some((m) => m.id === selectedMissionId)) {
      setSelectedMissionId(agentMissions[0].id);
    }
  }, [agentMissions, selectedMissionId]);

  const relevantAlerts = notifications.filter(
    (n) =>
      n.type === 'agent_assigned' ||
      n.type === 'agent_encouragement' ||
      (agentUid ? n.recipientId === agentUid : false)
  );
  const isAlertUnread = (n: AppNotification) =>
    n.read !== true && !readNotificationIds.includes(n.id);
  const unreadAlertCount = relevantAlerts.filter(isAlertUnread).length;

  // Suivi GPS terrain haute précision (position par défaut : Amissa Chantal, Akanda)
  const [selfPosition, setSelfPosition] = useState<GpsPoint | null>(DEFAULT_GPS_POSITION);
  const [selfGpsActive, setSelfGpsActive] = useState(false);
  const [selfGpsLoading, setSelfGpsLoading] = useState(false);
  const [selfGpsError, setSelfGpsError] = useState('');
  const watchIdRef = useRef<number | null>(null);
  const lastSyncRef = useRef<{ time: number; lat: number; lng: number }>({
    time: 0,
    lat: 0,
    lng: 0,
  });

  const activeGpsMissionIds = agentMissions
    .filter((m) => m.gpsActive && m.status !== 'completed')
    .map((m) => m.id);
  const activeGpsMissionIdsKey = activeGpsMissionIds.join(',');

  const startLiveWatch = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setSelfGpsError('La géolocalisation n’est pas prise en charge par ce navigateur.');
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setSelfGpsError('');
    setSelfGpsLoading(true);
    setSelfGpsActive(true);

    const onGeoSuccess = async (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const neighborhood = await reverseGeocodeNeighborhood(latitude, longitude);
      const point: GpsPoint = {
        lat: latitude,
        lng: longitude,
        neighborhood,
        accuracy: Math.round(accuracy),
        updatedAt: new Date().toISOString(),
      };
      setSelfPosition(point);
      setSelfGpsLoading(false);
      setSelfGpsError('');

      // Synchronise vers Firestore pour toutes les missions actives avec GPS activé
      const now = Date.now();
      const movedEnough =
        Math.hypot(latitude - lastSyncRef.current.lat, longitude - lastSyncRef.current.lng) >
        0.0002;
      if (
        activeGpsMissionIds.length > 0 &&
        (now - lastSyncRef.current.time > 8000 || movedEnough)
      ) {
        lastSyncRef.current = { time: now, lat: latitude, lng: longitude };
        activeGpsMissionIds.forEach((id) => onUpdateAgentGps(id, point));
      }
    };

    const onGeoError = (err: GeolocationPositionError) => {
      setSelfGpsLoading(false);
      if (err.code === err.PERMISSION_DENIED) {
        setSelfGpsError(
          'Accès GPS refusé par le navigateur. Autorisez la localisation pour afficher votre quartier.'
        );
        setSelfGpsActive(false);
      } else {
        setSelfGpsError('Acquisition GPS haute précision en cours...');
      }
    };

    navigator.geolocation.getCurrentPosition(
      onGeoSuccess,
      onGeoError,
      HIGH_ACCURACY_GEO_OPTIONS
    );
    watchIdRef.current = navigator.geolocation.watchPosition(
      onGeoSuccess,
      onGeoError,
      HIGH_ACCURACY_GEO_OPTIONS
    );
  };

  const stopLiveWatch = () => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSelfGpsActive(false);
    setSelfGpsLoading(false);
  };

  const handleToggleSelfGps = () => {
    if (selfGpsActive) {
      stopLiveWatch();
    } else {
      startLiveWatch();
    }
  };

  // Active automatiquement la localisation si la permission est déjà accordée ou si une mission a le GPS actif
  useEffect(() => {
    if (activeGpsMissionIds.length > 0 && !selfGpsActive) {
      startLiveWatch();
    } else if (
      typeof navigator !== 'undefined' &&
      'permissions' in navigator &&
      typeof navigator.permissions.query === 'function'
    ) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((res) => {
          if (res.state === 'granted' && !selfGpsActive) {
            startLiveWatch();
          }
        })
        .catch(() => {});
    }

    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGpsMissionIdsKey]);

  const handleToggleMissionGps = (mission: Booking) => {
    setSelectedMissionId(mission.id);
    if (!mission.gpsActive) {
      if (selfPosition) {
        onToggleGps(mission.id, selfPosition);
        if (!selfGpsActive) startLiveWatch();
        return;
      }

      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        setSelfGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            const neighborhood = await reverseGeocodeNeighborhood(latitude, longitude);
            const pt: GpsPoint = {
              lat: latitude,
              lng: longitude,
              neighborhood,
              accuracy: Math.round(accuracy),
              updatedAt: new Date().toISOString(),
            };
            setSelfPosition(pt);
            setSelfGpsLoading(false);
            onToggleGps(mission.id, pt);
            startLiveWatch();
          },
          () => {
            setSelfGpsLoading(false);
            onToggleGps(mission.id, selfPosition || DEFAULT_GPS_POSITION);
          },
          HIGH_ACCURACY_GEO_OPTIONS
        );
        return;
      }
    }
    onToggleGps(mission.id, selfPosition || DEFAULT_GPS_POSITION);
  };

  const handleFileChange = async (
    bookingId: string,
    kind: 'before' | 'after',
    file?: File | null
  ) => {
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      if (!compressed) return;
      if (kind === 'before') {
        setBeforeDrafts((prev) => ({ ...prev, [bookingId]: compressed }));
      } else {
        setAfterDrafts((prev) => ({ ...prev, [bookingId]: compressed }));
      }
      setPhotoErrors((prev) => ({ ...prev, [bookingId]: '' }));
    } catch {
      setPhotoErrors((prev) => ({
        ...prev,
        [bookingId]: 'Impossible de traiter cette image. Réessayez.',
      }));
    }
  };

  const handleStartWithPhoto = async (booking: Booking) => {
    if (actionLoading[booking.id]) return;
    const chosenBefore =
      beforeDrafts[booking.id] ||
      booking.beforePhotos[booking.beforePhotos.length - 1];

    setActionLoading((prev) => ({ ...prev, [booking.id]: 'start' }));
    setActionErrors((prev) => ({ ...prev, [booking.id]: '' }));
    setActionSuccess((prev) => ({ ...prev, [booking.id]: '' }));
    setPhotoErrors((prev) => ({ ...prev, [booking.id]: '' }));

    try {
      await onStartPlacement(booking.id, chosenBefore);
      setActionSuccess((prev) => ({
        ...prev,
        [booking.id]: "Début d'intervention enregistré et synchronisé en temps réel.",
      }));
    } catch (error) {
      console.error('[AgentWorkspaceView] Échec "Marquer le début":', {
        bookingId: booking.id,
        agentUid,
        error,
      });
      setActionErrors((prev) => ({
        ...prev,
        [booking.id]:
          error instanceof Error && error.message
            ? error.message
            : "Impossible d'enregistrer le début de la mission dans Firestore.",
      }));
    } finally {
      setActionLoading((prev) => ({ ...prev, [booking.id]: null }));
    }
  };

  const handleFinishWithPhoto = async (booking: Booking) => {
    if (actionLoading[booking.id]) return;
    const chosenBefore =
      beforeDrafts[booking.id] ||
      booking.beforePhotos[booking.beforePhotos.length - 1];
    const chosenAfter =
      afterDrafts[booking.id] ||
      booking.afterPhotos[booking.afterPhotos.length - 1];

    setActionLoading((prev) => ({ ...prev, [booking.id]: 'finish' }));
    setActionErrors((prev) => ({ ...prev, [booking.id]: '' }));
    setActionSuccess((prev) => ({ ...prev, [booking.id]: '' }));
    setPhotoErrors((prev) => ({ ...prev, [booking.id]: '' }));

    try {
      await onFinishPlacement(
        booking.id,
        chosenAfter,
        beforeDrafts[booking.id] || chosenBefore
      );
      setActionSuccess((prev) => ({
        ...prev,
        [booking.id]: 'Fin de mission enregistrée et synchronisée en temps réel.',
      }));
      setCompletedBanner(
        `Mission #${booking.id} (${booking.serviceName} · ${booking.clientName}) marquée comme terminée. Elle a été retirée de votre liste active, le client a reçu un message de remerciement et le gérant peut consulter le résultat.`
      );
    } catch (error) {
      console.error('[AgentWorkspaceView] Échec "Marquer la fin":', {
        bookingId: booking.id,
        agentUid,
        error,
      });
      setActionErrors((prev) => ({
        ...prev,
        [booking.id]:
          error instanceof Error && error.message
            ? error.message
            : "Impossible d'enregistrer la fin de la mission dans Firestore.",
      }));
    } finally {
      setActionLoading((prev) => ({ ...prev, [booking.id]: null }));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Espace Agent · {agentName}</h1>
          <p className="text-xs text-slate-600 mt-1">
            Recevez vos commandes validées en temps réel, activez le GPS haute précision, marquez le début puis la fin de l&apos;intervention (photos avant/après facultatives).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs">
            <span>Missions actives :</span>
            <strong className="text-emerald-700 tabular-nums">{agentMissions.length}</strong>
          </span>
          {unreadAlertCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold shadow-xs tabular-nums">
              <BellRing className="w-3.5 h-3.5" />
              <span>
                {unreadAlertCount} nouvelle{unreadAlertCount > 1 ? 's' : ''} alerte
                {unreadAlertCount > 1 ? 's' : ''}
              </span>
            </span>
          )}
        </div>
      </div>

      {completedBanner && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl px-4 py-3.5 text-xs flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{completedBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setCompletedBanner(null)}
            aria-label="Fermer la confirmation"
            className="p-1 text-emerald-700 hover:text-emerald-950 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Alertes & Notifications dédiées à l'Agent */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BellRing
              className={`w-4 h-4 ${unreadAlertCount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}
            />
            <span className="text-xs font-bold text-slate-900">
              Notifications &amp; Affectations en temps réel
            </span>
            {unreadAlertCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-bold tabular-nums">
                {unreadAlertCount} non lue{unreadAlertCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {unreadAlertCount > 0 && onMarkAllNotificationsRead && (
            <button
              type="button"
              onClick={onMarkAllNotificationsRead}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Tout marquer comme lu</span>
            </button>
          )}
        </div>

        {relevantAlerts.length === 0 ? (
          <div className="px-5 py-4 text-xs text-slate-500">
            Aucune nouvelle notification d&apos;affectation pour le moment. Dès qu&apos;un gérant valide et vous assigne une commande, l&apos;alerte apparaît ici instantanément.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {relevantAlerts.map((alert) => {
              const unread = isAlertUnread(alert);
              const targetBookingId = alert.orderId || alert.relatedId;
              const hasTargetMission = agentMissions.some((m) => m.id === targetBookingId);

              return (
                <div
                  key={alert.id}
                  className={`px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    unread ? 'bg-emerald-50/50' : 'bg-white'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {alert.type === 'agent_encouragement' && (
                        <Award className="w-4 h-4 text-emerald-700 shrink-0" />
                      )}
                      {unread && alert.type !== 'agent_encouragement' && (
                        <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                      )}
                      <span className="text-xs font-bold text-slate-900">{alert.title}</span>
                      <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                        {formatAlertTime(alert.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {alert.message || alert.body}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {hasTargetMission && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMissionId(targetBookingId);
                          if (unread && onMarkNotificationRead) {
                            onMarkNotificationRead(alert.id);
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-lg transition-colors"
                      >
                        Voir la commande
                      </button>
                    )}
                    {unread && onMarkNotificationRead && (
                      <button
                        type="button"
                        onClick={() => onMarkNotificationRead(alert.id)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg transition-colors"
                      >
                        Marquer comme lu
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bandeau Position & Quartier en direct (toujours accessible, même sans mission assignée) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <LocateFixed className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Ma position &amp; Quartier actuel (Haute précision GPS)</span>
          </div>
          {selfPosition ? (
            <div className="text-xs text-slate-700 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                <MapPin className="w-3.5 h-3.5" />
                <NeighborhoodLabel coords={selfPosition} fallback="Amissa Chantal, Akanda" />
              </span>
              <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                {selfPosition.lat.toFixed(5)}, {selfPosition.lng.toFixed(5)}
                {selfPosition.accuracy !== undefined
                  ? ` · ±${selfPosition.accuracy} m`
                  : ' · Secteur par défaut (Akanda)'}
              </span>
              {selfGpsError && (
                <span className="text-[11px] text-amber-700 font-medium">{selfGpsError}</span>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {selfGpsError ||
                'Activez votre GPS haute précision pour afficher votre quartier réel sur la carte.'}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleToggleSelfGps}
          disabled={selfGpsLoading}
          className={`px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-2 shrink-0 ${
            selfGpsActive
              ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
              : 'bg-slate-900 hover:bg-emerald-700 text-white'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>
            {selfGpsLoading
              ? 'Localisation GPS...'
              : selfGpsActive
              ? 'Mon GPS Live Actif (Couper)'
              : 'Activer mon GPS en direct'}
          </span>
        </button>
      </div>

      <LiveGpsMap
        bookings={agentMissions}
        selectedBookingId={selectedMissionId}
        onSelectBooking={setSelectedMissionId}
        title="Position GPS Agent & Quartiers en direct"
        selfPosition={selfPosition}
        selfLabel={agentName}
        selfGpsActive={selfGpsActive}
        selfGpsLoading={selfGpsLoading}
        selfGpsError={selfGpsError}
        onToggleSelfGps={handleToggleSelfGps}
      />

      <div className="space-y-4">
        {agentMissions.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-1.5">
            <div className="text-sm font-bold text-slate-900">
              Aucune mission affectée pour le moment
            </div>
            <p className="text-xs text-slate-500">
              Votre position GPS et votre quartier actuel restent consultables sur la carte ci-dessus. Dès qu&apos;une commande validée vous est assignée, elle s&apos;affichera ici en temps réel.
            </p>
          </div>
        )}
        {agentMissions.map((mission) => {
          const beforePreview =
            beforeDrafts[mission.id] ||
            mission.beforePhotos[mission.beforePhotos.length - 1];
          const afterPreview =
            afterDrafts[mission.id] ||
            mission.afterPhotos[mission.afterPhotos.length - 1];
          const err = actionErrors[mission.id] || photoErrors[mission.id];
          const successMsg = actionSuccess[mission.id];
          const loadingAction = actionLoading[mission.id] || null;
          const statusMeta = STATUS_BADGE[mission.status] || STATUS_BADGE.confirmed;
          const promoInfo = getBookingPromoInfo(mission);
          const isFocused = selectedMissionId === mission.id;

          return (
            <div
              key={mission.id}
              className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-sm space-y-5 transition-colors ${
                isFocused
                  ? 'border-emerald-500 ring-1 ring-emerald-500/20'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-emerald-800">{mission.id}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${statusMeta.className}`}
                    >
                      {statusMeta.label}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Client : {mission.clientName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{mission.clientPhone}</span>
                    {promoInfo && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                        <Tag className="w-3 h-3" />
                        <span>
                          Promo{' '}
                          {promoInfo.discountLabel ||
                            (promoInfo.discountPercent ? `-${promoInfo.discountPercent}%` : '')}{' '}
                          · {promoInfo.title}
                        </span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{mission.serviceName}</h3>
                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <NeighborhoodLabel coords={mission.clientCoords} fallback={mission.commune} /> ·{' '}
                      {mission.address}
                    </span>
                    {mission.clientGpsActive && (
                      <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                        <LocateFixed className="w-3.5 h-3.5" />
                        GPS Client en direct (
                        <NeighborhoodLabel
                          coords={mission.clientCoords}
                          fallback={mission.commune}
                        />
                        )
                      </span>
                    )}
                  </div>
                  {mission.assignedAgents.length > 0 && (
                    <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Équipe affectée :{' '}
                        <strong className="text-slate-900">
                          {mission.assignedAgents.join(', ')}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs shrink-0">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Lock className="w-3 h-3" />
                    <span>Tarif validé (non modifiable)</span>
                  </div>
                  {promoInfo && (
                    <div className="text-[11px] text-emerald-700 font-medium mt-0.5 tabular-nums">
                      <span className="line-through text-slate-400">
                        {promoInfo.originalPrice.toLocaleString()} XAF
                      </span>{' '}
                      <span>(-{promoInfo.discountAmount.toLocaleString()} XAF)</span>
                    </div>
                  )}
                  <div className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">
                    {mission.finalPrice.toLocaleString()} XAF · {mission.paymentMethod}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                  Matériau : <strong className="text-slate-900">{mission.details.material}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  État : <strong className="text-slate-900">{mission.details.condition}</strong>
                </span>
                {mission.details.vehicleBrand && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-emerald-800">
                      Véhicule : {mission.details.vehicleBrand} ({mission.details.vehicleSeats} places)
                    </span>
                  </>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-emerald-700" />
                    <span>1. Géolocalisation GPS Agent (Haute précision)</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {mission.gpsActive ? (
                      <>
                        Position active — Quartier détecté :{' '}
                        <strong className="text-emerald-800">
                          <NeighborhoodLabel
                            coords={mission.agentGps || selfPosition}
                            fallback="Localisation..."
                          />
                        </strong>
                      </>
                    ) : (
                      'Activez votre GPS au départ vers le client.'
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={mission.status === 'completed'}
                  onClick={() => handleToggleMissionGps(mission)}
                  className={`px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl transition-colors shrink-0 disabled:opacity-50 ${
                    mission.gpsActive
                      ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                      : 'bg-slate-900 text-white hover:bg-emerald-700'
                  }`}
                >
                  {mission.gpsActive ? 'GPS Actif (Désactiver)' : 'Activer le GPS'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      2. Début d&apos;intervention &amp; Image Avant
                    </span>
                    {mission.startedAt && (
                      <span className="text-[11px] font-mono text-emerald-700 tabular-nums">
                        {formatMissionTimestamp(mission.startedAt)}
                      </span>
                    )}
                  </div>

                  {beforePreview ? (
                    <img
                      src={beforePreview}
                      alt={`Avant ${mission.id}`}
                      className="w-full h-36 object-cover rounded-xl border border-slate-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-36 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-xs text-slate-500">
                      <Camera className="w-5 h-5 mb-1 text-slate-400" />
                      <span>Photo avant (optionnelle)</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-3.5 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl cursor-pointer inline-flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Choisir Image Avant</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) =>
                          handleFileChange(mission.id, 'before', e.target.files?.[0])
                        }
                      />
                    </label>

                    <button
                      type="button"
                      disabled={
                        mission.status === 'in_progress' ||
                        mission.status === 'completed' ||
                        Boolean(loadingAction)
                      }
                      onClick={() => handleStartWithPhoto(mission)}
                      className="px-4 py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
                    >
                      {loadingAction === 'start' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Enregistrement...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>
                            {mission.status === 'in_progress' || mission.status === 'completed'
                              ? 'Début marqué'
                              : 'Marquer le début'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      3. Fin de mission &amp; Image Après
                    </span>
                    {mission.completedAt && (
                      <span className="text-[11px] font-mono text-emerald-700 tabular-nums">
                        {formatMissionTimestamp(mission.completedAt)}
                      </span>
                    )}
                  </div>

                  {afterPreview ? (
                    <img
                      src={afterPreview}
                      alt={`Après ${mission.id}`}
                      className="w-full h-36 object-cover rounded-xl border border-emerald-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-36 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-xs text-slate-500">
                      <Camera className="w-5 h-5 mb-1 text-slate-400" />
                      <span>Photo après nettoyage (optionnelle)</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-3.5 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl cursor-pointer inline-flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Choisir Image Après</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) =>
                          handleFileChange(mission.id, 'after', e.target.files?.[0])
                        }
                      />
                    </label>

                    <button
                      type="button"
                      disabled={mission.status === 'completed' || Boolean(loadingAction)}
                      onClick={() =>
                        setAfterDrafts((prev) => ({
                          ...prev,
                          [mission.id]:
                            mission.beforePhotos[0] ||
                            '/src/assets/images/hero_shine_alp_1795029308068.jpg',
                        }))
                      }
                      className="px-3 py-2.5 min-h-[44px] bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-medium rounded-xl"
                    >
                      Simuler photo prise
                    </button>

                    <button
                      type="button"
                      disabled={mission.status === 'completed' || Boolean(loadingAction)}
                      onClick={() => handleFinishWithPhoto(mission)}
                      className="px-4 py-2.5 min-h-[44px] bg-slate-900 hover:bg-emerald-700 disabled:bg-emerald-100 disabled:text-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
                    >
                      {loadingAction === 'finish' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Enregistrement...</span>
                        </>
                      ) : mission.status === 'completed' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mission terminée</span>
                        </>
                      ) : (
                        <>
                          <Square className="w-3.5 h-3.5" />
                          <span>Marquer la fin</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {successMsg && !err && (
                <div
                  role="status"
                  className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {err && (
                <div
                  role="alert"
                  className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-2.5 text-xs font-medium flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
