import React from 'react';
import { MapPin, Navigation, ShieldCheck } from 'lucide-react';
import { Booking } from '../types';

interface LiveGpsMapProps {
  bookings: Booking[];
  selectedBookingId?: string | null;
  onSelectBooking?: (bookingId: string) => void;
  title?: string;
}

function toMapPercent(lat: number, lng: number) {
  const minLat = 0.31;
  const maxLat = 0.48;
  const minLng = 9.41;
  const maxLng = 9.53;

  const y = 100 - ((lat - minLat) / (maxLat - minLat)) * 100;
  const x = ((lng - minLng) / (maxLng - minLng)) * 100;

  return {
    x: Math.max(10, Math.min(90, x)),
    y: Math.max(12, Math.min(88, y)),
  };
}

function calcDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = (b.lat - a.lat) * 111;
  const dLng = (b.lng - a.lng) * 111;
  return Math.max(0.2, Math.sqrt(dLat * dLat + dLng * dLng));
}

export const LiveGpsMap: React.FC<LiveGpsMapProps> = ({
  bookings,
  selectedBookingId,
  onSelectBooking,
  title = 'Carte GPS Grand Libreville — Suivi Multi-utilisateurs',
}) => {
  const activeBookings = bookings.filter(
    (b) =>
      b.gpsActive ||
      b.clientGpsActive ||
      b.status === 'in_transit' ||
      b.status === 'in_progress' ||
      b.id === selectedBookingId
  );

  const focused =
    bookings.find((b) => b.id === selectedBookingId) ||
    activeBookings.find((b) => b.gpsActive || b.clientGpsActive) ||
    activeBookings[0] ||
    null;

  return (
    <div className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-lg flex flex-col">
      {/* Top Map Header */}
      <div className="px-4 py-3 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Navigation className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white">{title}</span>
        </div>
        <div className="text-[11px] font-mono text-emerald-300 tabular-nums flex items-center gap-3">
          <span>
            {focused?.clientGpsActive ? 'GPS Client : ACTIF' : 'GPS Client : Statique'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {focused?.gpsActive ? `GPS Agent : ACTIF (${focused.id})` : 'GPS Agent : En attente'}
          </span>
        </div>
      </div>

      {/* Interactive Cartographic Canvas */}
      <div className="relative h-[360px] sm:h-[400px] w-full bg-[#0B1612] overflow-hidden select-none">
        <div
          className="absolute top-0 bottom-0 left-0 w-[26%] bg-gradient-to-r from-[#09202B] to-[#0B1612] border-r border-emerald-900/30"
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

        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
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
            const agentPos = toMapPercent(b.agentGps.lat, b.agentGps.lng);
            const clientPos = toMapPercent(b.clientCoords.lat, b.clientCoords.lng);
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

        <div className="absolute top-[16%] left-[32%] text-[10px] font-mono text-slate-400/80 pointer-events-none">
          AKANDA / ANGONDJÉ
        </div>
        <div className="absolute top-[46%] left-[34%] text-[10px] font-mono text-slate-400/80 pointer-events-none">
          LIBREVILLE CENTRE · LOUIS · GLASS
        </div>
        <div className="absolute top-[78%] left-[52%] text-[10px] font-mono text-slate-400/80 pointer-events-none">
          OWENDO · LALALA
        </div>
        <div className="absolute top-[48%] left-[5%] text-[10px] font-mono text-sky-400/50 -rotate-90 pointer-events-none">
          ESTUAIRE DU KOMO
        </div>

        {activeBookings.map((b) => {
          const clientPos = toMapPercent(b.clientCoords.lat, b.clientCoords.lng);
          const agentPos = b.agentGps ? toMapPercent(b.agentGps.lat, b.agentGps.lng) : null;
          const isSelected = focused?.id === b.id;

          return (
            <React.Fragment key={b.id}>
              {/* Client Destination / Live GPS Marker */}
              <button
                type="button"
                onClick={() => onSelectBooking?.(b.id)}
                style={{ left: `${clientPos.x}%`, top: `${clientPos.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none z-10"
                title={`Client: ${b.clientName} (${b.address})`}
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
                    Client · {b.id} {b.clientGpsActive ? '(GPS Live)' : ''}
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
                  title={`Agent: ${b.assignedAgents.join(', ') || 'Équipe'}`}
                >
                  <div className="flex flex-col items-center">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[10px] font-bold mb-1 whitespace-nowrap shadow-lg ${
                        b.gpsActive
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {b.assignedAgents[0] || 'Agent'} {b.gpsActive ? '· En direct' : '· GPS off'}
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

        {focused ? (
          <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md rounded-xl p-3.5 border border-slate-200 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs z-30">
            <div className="space-y-0.5 min-w-0">
              <div className="font-bold text-slate-900 truncate">
                {focused.serviceName} · {focused.address}
              </div>
              <div className="text-slate-600 flex flex-wrap items-center gap-x-2">
                <span>
                  Agent(s) :{' '}
                  <strong className="text-emerald-800">
                    {focused.assignedAgents.length > 0
                      ? focused.assignedAgents.join(', ')
                      : 'Non affecté'}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[11px] tabular-nums">
                  GPS Client : {focused.clientCoords.lat.toFixed(4)}, {focused.clientCoords.lng.toFixed(4)}
                </span>
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
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div className="bg-slate-900/90 border border-slate-700 rounded-xl px-5 py-4 text-xs text-slate-300 max-w-sm">
              Aucune mission active sélectionnée pour le suivi GPS en temps réel.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
