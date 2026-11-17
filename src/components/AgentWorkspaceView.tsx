import React, { useState } from 'react';
import {
  Camera,
  CheckCircle2,
  LocateFixed,
  Lock,
  MapPin,
  Navigation,
  Play,
  Square,
  Upload,
} from 'lucide-react';
import { Booking } from '../types';
import { LiveGpsMap } from './LiveGpsMap';

interface AgentWorkspaceViewProps {
  bookings: Booking[];
  agentName: string;
  onToggleGps: (bookingId: string) => void;
  onStartPlacement: (bookingId: string, beforePhotoUrl?: string) => void;
  onFinishPlacement: (bookingId: string, afterPhotoUrl?: string) => void;
}

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
  onToggleGps,
  onStartPlacement,
  onFinishPlacement,
}) => {
  const agentMissions = bookings.filter(
    (b) =>
      b.status !== 'cancelled' &&
      (b.assignedAgents.includes(agentName) ||
        b.assignedAgents.length > 0 ||
        b.status === 'confirmed' ||
        b.status === 'in_transit' ||
        b.status === 'in_progress')
  );

  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(
    agentMissions[0]?.id || null
  );
  const [beforeDrafts, setBeforeDrafts] = useState<Record<string, string>>({});
  const [afterDrafts, setAfterDrafts] = useState<Record<string, string>>({});
  const [photoErrors, setPhotoErrors] = useState<Record<string, string>>({});

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

  const handleStartWithPhoto = (booking: Booking) => {
    const chosenBefore =
      beforeDrafts[booking.id] ||
      booking.beforePhotos[booking.beforePhotos.length - 1];
    if (!chosenBefore) {
      setPhotoErrors((prev) => ({
        ...prev,
        [booking.id]: "Veuillez joindre une photo AVANT l'intervention.",
      }));
      return;
    }
    onStartPlacement(booking.id, beforeDrafts[booking.id]);
  };

  const handleFinishWithPhoto = (booking: Booking) => {
    const chosenAfter =
      afterDrafts[booking.id] ||
      booking.afterPhotos[booking.afterPhotos.length - 1];
    if (!chosenAfter) {
      setPhotoErrors((prev) => ({
        ...prev,
        [booking.id]:
          "Veuillez joindre la photo APRÈS intervention pour valider la fin de mission.",
      }));
      return;
    }
    onFinishPlacement(booking.id, chosenAfter);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Espace Agent · {agentName}</h1>
        <p className="text-xs text-slate-600 mt-1">
          Visualisez les positions GPS partagées par vos clients, activez votre GPS, marquez le début du placement avec photo avant puis la fin avec photo après.
        </p>
      </div>

      <LiveGpsMap
        bookings={agentMissions}
        selectedBookingId={selectedMissionId}
        onSelectBooking={setSelectedMissionId}
        title="Position GPS Agent & Position GPS Clients en direct"
      />

      <div className="space-y-4">
        {agentMissions.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-1.5">
            <div className="text-sm font-bold text-slate-900">
              Aucune mission affectée pour le moment
            </div>
            <p className="text-xs text-slate-500">
              Dès que le gérant valide une commande et vous l&apos;assigne, elle apparaîtra ici avec le suivi GPS et les photos avant/après.
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
          const err = photoErrors[mission.id];

          return (
            <div
              key={mission.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-emerald-800">{mission.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>Client : {mission.clientName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{mission.clientPhone}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{mission.serviceName}</h3>
                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      {mission.commune} · {mission.address}
                    </span>
                    {mission.clientGpsActive && (
                      <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                        <LocateFixed className="w-3.5 h-3.5" />
                        GPS Client en direct ({mission.clientCoords.lat.toFixed(4)},{' '}
                        {mission.clientCoords.lng.toFixed(4)})
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs shrink-0">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Lock className="w-3 h-3" />
                    <span>Tarif validé (non modifiable)</span>
                  </div>
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
                    <span>1. Géolocalisation GPS Agent</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {mission.gpsActive
                      ? 'Votre position est visible en temps réel par le client, le gérant et l’administrateur.'
                      : 'Activez votre GPS au départ vers le client.'}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={mission.status === 'completed'}
                  onClick={() => {
                    setSelectedMissionId(mission.id);
                    onToggleGps(mission.id);
                  }}
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
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      2. Début du placement & Image Avant
                    </span>
                    {mission.startedAt && (
                      <span className="text-[11px] font-mono text-emerald-700">
                        {mission.startedAt}
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
                      <span>Aucune photo avant chargée</span>
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
                      disabled={mission.status === 'in_progress' || mission.status === 'completed'}
                      onClick={() => handleStartWithPhoto(mission)}
                      className="px-4 py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>
                        {mission.status === 'in_progress' || mission.status === 'completed'
                          ? 'Début marqué'
                          : 'Marquer début du placement'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      3. Fin de mission & Image Après
                    </span>
                    {mission.completedAt && (
                      <span className="text-[11px] font-mono text-emerald-700">
                        {mission.completedAt}
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
                      <span>Chargez la photo après nettoyage</span>
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
                      onClick={() =>
                        setAfterDrafts((prev) => ({
                          ...prev,
                          [mission.id]:
                            mission.beforePhotos[0] ||
                            '/src/assets/images/cleaning_hero_librevile_1794914545784.jpg',
                        }))
                      }
                      className="px-3 py-2.5 min-h-[44px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-xl"
                    >
                      Simuler photo prise
                    </button>

                    <button
                      type="button"
                      disabled={mission.status === 'completed'}
                      onClick={() => handleFinishWithPhoto(mission)}
                      className="px-4 py-2.5 min-h-[44px] bg-slate-900 hover:bg-emerald-700 disabled:bg-emerald-100 disabled:text-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
                    >
                      {mission.status === 'completed' ? (
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

              {err && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-2.5 text-xs font-medium">
                  {err}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
