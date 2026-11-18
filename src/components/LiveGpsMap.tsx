import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, LocateFixed, MapPin, Navigation, RefreshCw, ShieldCheck } from 'lucide-react';
import { DEFAULT_GPS_POSITION } from '../data/quartiers';
import { Booking, GpsPoint } from '../types';
import {
  HIGH_ACCURACY_GEO_OPTIONS,
  reverseGeocodeNeighborhood,
  useReverseGeocodedNeighborhood,
} from '../utils/geocoding';

interface LiveGpsMapProps {
  bookings: Booking[];
  selectedBookingId?: string | null;
  onSelectBooking?: (bookingId: string) => void;
  title?: string;
  selfPosition?: GpsPoint | null;
  selfLabel?: string;
  selfGpsActive?: boolean;
  selfGpsLoading?: boolean;
  selfGpsError?: string;
  onToggleSelfGps?: () => void;
  allowStandaloneGps?: boolean;
}

interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  isDefaultLibreville: boolean;
}

const DEFAULT_LIBREVILLE_BOUNDS: MapBounds = {
  minLat: 0.285,
  maxLat: 0.545,
  minLng: 9.375,
  maxLng: 9.575,
  isDefaultLibreville: true,
};

function computeBounds(points: GpsPoint[]): MapBounds {
  if (points.length === 0) return DEFAULT_LIBREVILLE_BOUNDS;

  const allInsideLibreville = points.every(
    (p) =>
      p.lat >= DEFAULT_LIBREVILLE_BOUNDS.minLat - 0.02 &&
      p.lat <= DEFAULT_LIBREVILLE_BOUNDS.maxLat + 0.02 &&
      p.lng >= DEFAULT_LIBREVILLE_BOUNDS.minLng - 0.02 &&
      p.lng <= DEFAULT_LIBREVILLE_BOUNDS.maxLng + 0.02
  );

  if (allInsideLibreville) {
    return DEFAULT_LIBREVILLE_BOUNDS;
  }

  let minLat = Math.min(...points.map((p) => p.lat));
  let maxLat = Math.max(...points.map((p) => p.lat));
  let minLng = Math.min(...points.map((p) => p.lng));
  let maxLng = Math.max(...points.map((p) => p.lng));

  const latPad = Math.max(0.025, (maxLat - minLat) * 0.35);
  const lngPad = Math.max(0.025, (maxLng - minLng) * 0.35);

  minLat -= latPad;
  maxLat += latPad;
  minLng -= lngPad;
  maxLng += lngPad;

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    isDefaultLibreville: false,
  };
}

function toMapPercent(lat: number, lng: number, bounds: MapBounds) {
  const latSpan = Math.max(0.001, bounds.maxLat - bounds.minLat);
  const lngSpan = Math.max(0.001, bounds.maxLng - bounds.minLng);

  const y = 100 - ((lat - bounds.minLat) / latSpan) * 100;
  const x = ((lng - bounds.minLng) / lngSpan) * 100;

  return {
    x: Math.max(10, Math.min(90, x)),
    y: Math.max(14, Math.min(82, y)),
  };
}

function calcDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = (b.lat - a.lat) * 111;
  const dLng = (b.lng - a.lng) * 111;
  return Math.max(0.1, Math.sqrt(dLat * dLat + dLng * dLng));
}

export const LiveGpsMap: React.FC<LiveGpsMapProps> = ({
  bookings,
  selectedBookingId,
  onSelectBooking,
  title = 'Carte GPS Grand Libreville — Suivi Multi-utilisateurs',
  selfPosition: externalSelfPosition,
  selfLabel = 'Ma position en direct',
  selfGpsActive: externalSelfGpsActive,
  selfGpsLoading: externalSelfGpsLoading,
  selfGpsError: externalSelfGpsError,
  onToggleSelfGps,
  allowStandaloneGps = true,
}) => {
  const [internalSelfPosition, setInternalSelfPosition] = useState<GpsPoint | null>(null);
  const [internalGpsActive, setInternalGpsActive] = useState(false);
  const [internalGpsLoading, setInternalGpsLoading] = useState(false);
  const [internalGpsError, setInternalGpsError] = useState('');
  const watchIdRef = useRef<number | null>(null);

  const isInactive = (b: Booking) =>
    b.status === 'rejected' || b.status === 'cancelled' || b.status === 'completed';

  const activeBookings = bookings.filter(
    (b) =>
      !isInactive(b) &&
      (b.gpsActive ||
        b.clientGpsActive ||
        b.status === 'in_transit' ||
        b.status === 'in_progress' ||
        b.id === selectedBookingId)
  );

  const focused =
    activeBookings.find((b) => b.id === selectedBookingId) ||
    activeBookings.find((b) => b.gpsActive || b.clientGpsActive) ||
    activeBookings[0] ||
    null;

  const effectiveSelfPosition =
    externalSelfPosition !== undefined ? externalSelfPosition : internalSelfPosition;
  const effectiveSelfActive =
    externalSelfGpsActive !== undefined ? externalSelfGpsActive : internalGpsActive;
  const effectiveSelfLoading =
    externalSelfGpsLoading !== undefined ? externalSelfGpsLoading : internalGpsLoading;
  const effectiveSelfError =
    externalSelfGpsError !== undefined ? externalSelfGpsError : internalGpsError;

  const handleInternalToggleGps = () => {
    if (onToggleSelfGps) {
      onToggleSelfGps();
      return;
    }

    if (internalGpsActive) {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setInternalGpsActive(false);
      setInternalGpsLoading(false);
      return;
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setInternalGpsError('La géolocalisation haute précision n’est pas supportée par ce navigateur.');
      return;
    }

    setInternalGpsError('');
    setInternalGpsLoading(true);
    setInternalGpsActive(true);

    const handleCoords = async (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy } = pos.coords;
      const neighborhood = await reverseGeocodeNeighborhood(latitude, longitude);
      setInternalSelfPosition({
        lat: latitude,
        lng: longitude,
        neighborhood,
        accuracy: Math.round(accuracy),
        updatedAt: new Date().toISOString(),
      });
      setInternalGpsLoading(false);
    };

    const handleGeoError = (err: GeolocationPositionError) => {
      setInternalGpsLoading(false);
      if (err.code === err.PERMISSION_DENIED) {
        setInternalGpsError(
          'Autorisation GPS refusée. Position par défaut affichée : Amissa Chantal, Akanda.'
        );
        setInternalGpsActive(false);
        setInternalSelfPosition((prev) => prev || DEFAULT_GPS_POSITION);
      } else {
        setInternalGpsError(
          'Signal GPS faible — Position par défaut : Amissa Chantal, Akanda. Nouvelle tentative en cours...'
        );
        setInternalSelfPosition((prev) => prev || DEFAULT_GPS_POSITION);
      }
    };

    navigator.geolocation.getCurrentPosition(handleCoords, handleGeoError, HIGH_ACCURACY_GEO_OPTIONS);
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleCoords,
      handleGeoError,
      HIGH_ACCURACY_GEO_OPTIONS
    );
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const displayedSelfPosition: GpsPoint | null =
    effectiveSelfPosition || (!focused ? DEFAULT_GPS_POSITION : null);

  const clientNeighborhood = useReverseGeocodedNeighborhood(focused?.clientCoords);
  const agentNeighborhood = useReverseGeocodedNeighborhood(focused?.agentGps);
  const selfNeighborhood = useReverseGeocodedNeighborhood(displayedSelfPosition);

  const bounds = useMemo(() => {
    const pts: GpsPoint[] = [];
    activeBookings.forEach((b) => {
      pts.push(b.clientCoords);
      if (b.agentGps) pts.push(b.agentGps);
    });
    if (displayedSelfPosition) {
      pts.push(displayedSelfPosition);
    }
    return computeBounds(pts);
  }, [activeBookings, displayedSelfPosition]);

  const selfMapPos = displayedSelfPosition
    ? toMapPercent(displayedSelfPosition.lat, displayedSelfPosition.lng, bounds)
    : null;

  return (
    <div className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-lg flex flex-col">
      {/* Top Map Header */}
      <div className="px-4 py-3 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold text-white">{title}</span>
        </div>
        <div className="text-[11px] font-mono text-emerald-300 tabular-nums flex flex-wrap items-center gap-x-3 gap-y-1">
          {focused ? (
            <>
              <span>
                {focused.clientGpsActive ? 'GPS Client : ACTIF' : 'GPS Client : Statique'}
                {clientNeighborhood ? ` (${clientNeighborhood})` : ''}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {focused.gpsActive ? `GPS Agent : ACTIF (${focused.id})` : 'GPS Agent : En attente'}
                {agentNeighborhood ? ` · ${agentNeighborhood}` : ''}
              </span>
            </>
          ) : effectiveSelfActive && effectiveSelfPosition ? (
            <span className="text-emerald-300">
              GPS EN DIRECT · Quartier : {selfNeighborhood || 'Amissa Chantal, Akanda'}
            </span>
          ) : (
            <span className="text-emerald-300/90">
              Position par défaut : {selfNeighborhood || 'Amissa Chantal, Akanda'}
            </span>
          )}
        </div>
      </div>

      {/* Interactive Cartographic Canvas (jamais bloqué même sans mission active) */}
      <div className="relative h-[370px] sm:h-[410px] w-full bg-[#0B1612] overflow-hidden select-none">
        <div
          className="absolute top-0 bottom-0 left-0 w-[24%] bg-gradient-to-r from-[#09202B] to-[#0B1612] border-r border-emerald-900/30"
          aria-hidden="true"
        />

        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(16,185,129,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,185,129,0.2) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d="M 28 10 Q 34 45 45 72 T 65 92"
            fill="none"
            stroke="rgba(16, 185, 129, 0.22)"
            strokeWidth="0.9"
          />
          <path
            d="M 35 35 L 78 42"
            fill="none"
            stroke="rgba(148, 163, 184, 0.16)"
            strokeWidth="0.6"
          />
          <path
            d="M 40 52 L 85 60"
            fill="none"
            stroke="rgba(148, 163, 184, 0.16)"
            strokeWidth="0.6"
          />

          {activeBookings.map((b) => {
            if (!b.agentGps) return null;
            const agentPos = toMapPercent(b.agentGps.lat, b.agentGps.lng, bounds);
            const clientPos = toMapPercent(b.clientCoords.lat, b.clientCoords.lng, bounds);
            const isSelected = focused?.id === b.id;

            return (
              <line
                key={`route-${b.id}`}
                x1={agentPos.x}
                y1={agentPos.y}
                x2={clientPos.x}
                y2={clientPos.y}
                stroke={isSelected ? '#34D399' : '#059669'}
                strokeWidth={isSelected ? '0.9' : '0.5'}
                strokeDasharray="2 1.5"
                opacity={b.gpsActive || b.clientGpsActive ? 0.95 : 0.45}
              />
            );
          })}
        </svg>

        {bounds.isDefaultLibreville ? (
          <>
            <div className="absolute top-[11%] left-[28%] text-[10px] font-mono text-slate-400/80 pointer-events-none">
              AKANDA · AMISSA CHANTAL · ANGONDJÉ · SABLIÈRE
            </div>
            <div className="absolute top-[46%] left-[34%] text-[10px] font-mono text-slate-400/80 pointer-events-none">
              LIBREVILLE · BATTERIE 4 · LOUIS · GLASS · NZENG-AYONG
            </div>
            <div className="absolute top-[75%] left-[52%] text-[10px] font-mono text-slate-400/80 pointer-events-none">
              OWENDO · LALALA · PORT D&apos;OWENDO
            </div>
            <div className="absolute top-[46%] left-[4%] text-[10px] font-mono text-sky-400/50 -rotate-90 pointer-events-none">
              ESTUAIRE DU KOMO
            </div>
          </>
        ) : (
          <div className="absolute top-3 left-3 text-[10px] font-mono text-emerald-300/85 bg-slate-900/80 border border-emerald-800/50 px-2.5 py-1 rounded-lg pointer-events-none">
            Zone détectée : {selfNeighborhood || agentNeighborhood || clientNeighborhood || 'Amissa Chantal, Akanda'}
          </div>
        )}

        {/* Standalone / Device Live GPS Marker */}
        {selfMapPos && displayedSelfPosition && (
          <div
            style={{ left: `${selfMapPos.x}%`, top: `${selfMapPos.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700 z-25 pointer-events-none"
          >
            <div className="flex flex-col items-center">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold mb-1 whitespace-nowrap shadow-lg bg-sky-500 text-white border border-sky-300">
                {selfLabel} · {selfNeighborhood || 'Amissa Chantal, Akanda'}
              </span>
              <div className="relative flex items-center justify-center">
                <span className="absolute w-8 h-8 rounded-full bg-sky-400/40 animate-ping" />
                <div className="w-5 h-5 rounded-full bg-sky-500 border-2 border-white shadow-xl flex items-center justify-center">
                  <Crosshair className="w-3 h-3 text-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeBookings.map((b) => {
          const clientPos = toMapPercent(b.clientCoords.lat, b.clientCoords.lng, bounds);
          const agentPos = b.agentGps ? toMapPercent(b.agentGps.lat, b.agentGps.lng, bounds) : null;
          const isSelected = focused?.id === b.id;

          return (
            <React.Fragment key={b.id}>
              {/* Client Destination / Live GPS Marker */}
              <button
                type="button"
                onClick={() => onSelectBooking?.(b.id)}
                style={{ left: `${clientPos.x}%`, top: `${clientPos.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none z-10"
                title={`Client: ${b.clientName} (${b.clientCoords.neighborhood || b.address})`}
              >
                <div className="flex flex-col items-center">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold mb-1 whitespace-nowrap shadow-md border ${
                      b.clientGpsActive
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : isSelected
                        ? 'bg-white text-slate-900 border-slate-200'
                        : 'bg-slate-900/90 text-slate-200 border-slate-700'
                    }`}
                  >
                    Client · {b.clientCoords.neighborhood || b.commune.split(' ')[0]}
                    {b.clientGpsActive ? ' (GPS Live)' : ''}
                  </span>
                  <div className="relative flex items-center justify-center">
                    {b.clientGpsActive && (
                      <span className="absolute w-7 h-7 rounded-full bg-amber-400/40 animate-ping" />
                    )}
                    <div
                      className={`w-6 h-6 rounded-full border-2 shadow-lg flex items-center justify-center ${
                        b.clientGpsActive
                          ? 'bg-amber-300 border-slate-950'
                          : 'bg-white border-slate-900'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 text-emerald-800" />
                    </div>
                  </div>
                </div>
              </button>

              {/* Agent Marker */}
              {agentPos && (b.gpsActive || b.assignedAgents.length > 0) && (
                <button
                  type="button"
                  onClick={() => onSelectBooking?.(b.id)}
                  style={{ left: `${agentPos.x}%`, top: `${agentPos.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-1000 focus:outline-none z-20"
                  title={`Agent: ${b.assignedAgents.join(', ') || 'Équipe'} (${
                    b.agentGps?.neighborhood || 'Position en direct'
                  })`}
                >
                  <div className="flex flex-col items-center">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold mb-1 whitespace-nowrap shadow-lg ${
                        b.gpsActive
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {b.assignedAgents[0] || 'Agent'}
                      {b.agentGps?.neighborhood ? ` · ${b.agentGps.neighborhood}` : b.gpsActive ? ' · En direct' : ' · GPS off'}
                    </span>
                    <div className="relative flex items-center justify-center">
                      {b.gpsActive && (
                        <span className="absolute w-7 h-7 rounded-full bg-emerald-400/35 animate-ping" />
                      )}
                      <div
                        className={`w-5 h-5 rounded-full border-2 border-white shadow-xl ${
                          b.gpsActive ? 'bg-emerald-500' : 'bg-slate-500'
                        }`}
                      />
                    </div>
                  </div>
                </button>
              )}
            </React.Fragment>
          );
        })}

        {/* Non-blocking Bottom HUD */}
        {focused ? (
          <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md rounded-xl p-3.5 border border-slate-200 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs z-30">
            <div className="space-y-1 min-w-0">
              <div className="font-bold text-slate-900 truncate">
                {focused.serviceName} · {focused.address}
              </div>
              <div className="text-slate-600 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                <span>
                  Quartier client :{' '}
                  <strong className="text-slate-900">
                    {clientNeighborhood || focused.commune}
                  </strong>
                </span>
                {focused.agentGps && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Quartier agent :{' '}
                      <strong className="text-emerald-800">
                        {agentNeighborhood || 'Localisation...'}
                      </strong>
                    </span>
                  </>
                )}
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums flex flex-wrap items-center gap-x-2">
                <span>
                  Agent(s) :{' '}
                  <strong className="text-emerald-800 font-sans">
                    {focused.assignedAgents.length > 0
                      ? focused.assignedAgents.join(', ')
                      : 'Non affecté'}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Client : {focused.clientCoords.lat.toFixed(4)}, {focused.clientCoords.lng.toFixed(4)}
                </span>
                {focused.agentGps?.accuracy && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Précision ±{focused.agentGps.accuracy} m</span>
                  </>
                )}
              </div>
            </div>

            {focused.agentGps && (focused.gpsActive || focused.clientGpsActive) ? (
              <div className="flex items-center gap-4 shrink-0 font-mono tabular-nums bg-emerald-50 text-emerald-900 px-3 py-1.5 rounded-lg border border-emerald-200">
                <div>
                  <div className="text-[10px] text-emerald-700">Distance</div>
                  <div className="font-bold">
                    {calcDistanceKm(focused.agentGps, focused.clientCoords).toFixed(1)} km
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-emerald-700">ETA</div>
                  <div className="font-bold">
                    {Math.max(
                      2,
                      Math.round(calcDistanceKm(focused.agentGps, focused.clientCoords) * 2.4)
                    )}{' '}
                    min
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span>Position synchronisée dès activation GPS</span>
              </div>
            )}
          </div>
        ) : displayedSelfPosition ? (
          <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md rounded-xl p-3.5 border border-emerald-200 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs z-30">
            <div className="space-y-0.5 min-w-0">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <LocateFixed className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Quartier détecté : {selfNeighborhood || 'Amissa Chantal, Akanda'}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 font-mono tabular-nums flex flex-wrap items-center gap-x-2">
                <span>
                  Position : {displayedSelfPosition.lat.toFixed(5)}, {displayedSelfPosition.lng.toFixed(5)}
                </span>
                {displayedSelfPosition.accuracy !== undefined ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-800 font-semibold">
                      Haute précision (±{displayedSelfPosition.accuracy} m)
                    </span>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-500 font-sans">
                      {effectiveSelfError || 'Secteur par défaut (Akanda)'}
                    </span>
                  </>
                )}
              </div>
            </div>

            {allowStandaloneGps && (
              <button
                type="button"
                onClick={handleInternalToggleGps}
                className={`px-3.5 py-2 min-h-[38px] text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 shrink-0 ${
                  effectiveSelfActive
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                    : 'bg-slate-900 hover:bg-emerald-700 text-white'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${effectiveSelfLoading ? 'animate-spin' : ''}`} />
                <span>
                  {effectiveSelfLoading
                    ? 'Localisation...'
                    : effectiveSelfActive
                    ? 'GPS Actif (Couper)'
                    : 'Actualiser GPS réel'}
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md rounded-xl p-3.5 border border-slate-700 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs z-30">
            <div className="space-y-0.5">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <LocateFixed className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Carte Grand Libreville prête (géolocalisation haute précision)</span>
              </div>
              <p className="text-[11px] text-slate-300">
                {effectiveSelfError ||
                  'Activez le GPS pour afficher instantanément votre quartier réel et votre position sur la carte.'}
              </p>
            </div>
            {allowStandaloneGps && (
              <button
                type="button"
                onClick={handleInternalToggleGps}
                disabled={effectiveSelfLoading}
                className="px-4 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 shrink-0"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>
                  {effectiveSelfLoading ? 'Localisation...' : 'Activer mon GPS en direct'}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
