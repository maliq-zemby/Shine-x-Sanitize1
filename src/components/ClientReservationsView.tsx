import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  EyeOff,
  LocateFixed,
  MapPin,
  MessageCircle,
  Navigation,
  Plus,
  Star,
  Tag,
} from 'lucide-react';
import { MANAGER_DISPLAY_PHONE, MANAGER_NAME, MANAGER_WHATSAPP } from '../data/mockData';
import { Booking, GpsPoint } from '../types';
import { HIGH_ACCURACY_GEO_OPTIONS, reverseGeocodeNeighborhood } from '../utils/geocoding';
import { getBookingPromoInfo } from '../utils/promotions';
import { LiveGpsMap } from './LiveGpsMap';
import { WhatsAppComposerModal } from './WhatsAppComposerModal';

interface ClientReservationsViewProps {
  bookings: Booking[];
  isAuthenticated: boolean;
  onOpenAuth: () => void;
  onAcceptCounterOffer: (bookingId: string) => void;
  onSubmitReview: (bookingId: string, rating: number, comment: string) => void;
  onToggleClientGps: (bookingId: string, coords?: GpsPoint) => void;
  onOpenCatalog: () => void;
}

const STATUS_LABELS: Record<Booking['status'], string> = {
  pending_negotiation: 'En attente de validation du gérant',
  counter_offered: 'Nouveau tarif proposé par le gérant',
  confirmed: 'Commande validée · Agent désigné',
  in_transit: 'Agent en route · GPS en direct',
  in_progress: 'Intervention en cours sur place',
  completed: 'Intervention terminée',
  rejected: 'Commande refusée par le gérant',
  cancelled: 'Commande annulée',
};

const isTrackableBooking = (b: Booking) =>
  b.status !== 'rejected' && b.status !== 'cancelled' && b.status !== 'completed';

export const ClientReservationsView: React.FC<ClientReservationsViewProps> = ({
  bookings,
  isAuthenticated,
  onOpenAuth,
  onAcceptCounterOffer,
  onSubmitReview,
  onToggleClientGps,
  onOpenCatalog,
}) => {
  const activeTrackableBookings = bookings.filter(isTrackableBooking);
  const [selectedGpsBookingId, setSelectedGpsBookingId] = useState<string | null>(
    activeTrackableBookings.find(
      (b) => b.gpsActive || b.clientGpsActive || b.status === 'in_transit'
    )?.id ||
      activeTrackableBookings[0]?.id ||
      null
  );
  const [showMap, setShowMap] = useState<boolean>(
    () => bookings.some(isTrackableBooking)
  );
  const [whatsappTarget, setWhatsappTarget] = useState<Booking | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { rating: number; text: string }>>({});
  const [openReviewId, setOpenReviewId] = useState<string | null>(null);
  const [gpsNotice, setGpsNotice] = useState<string>('');

  // Fermeture automatique de la carte GPS dès que la commande est refusée, purgée ou n'est plus active
  useEffect(() => {
    const activeList = bookings.filter(isTrackableBooking);
    if (activeList.length === 0) {
      setSelectedGpsBookingId(null);
      setShowMap(false);
      return;
    }

    if (selectedGpsBookingId) {
      const focused = bookings.find((b) => b.id === selectedGpsBookingId);
      if (!focused || !isTrackableBooking(focused)) {
        setSelectedGpsBookingId(null);
        setShowMap(false);
      }
    }
  }, [bookings, selectedGpsBookingId]);

  const handleSaveReview = (bookingId: string) => {
    const draft = reviewDrafts[bookingId] || { rating: 5, text: '' };
    if (!draft.text.trim()) return;
    onSubmitReview(bookingId, draft.rating || 5, draft.text.trim());
    setOpenReviewId(null);
  };

  const handleActivateClientGps = (booking: Booking) => {
    if (!isTrackableBooking(booking)) return;
    setSelectedGpsBookingId(booking.id);
    setShowMap(true);
    if (booking.clientGpsActive) {
      onToggleClientGps(booking.id);
      setGpsNotice(`Partage GPS client désactivé pour ${booking.id}.`);
      return;
    }

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const accuracy = Math.round(pos.coords.accuracy);
          const neighborhood = await reverseGeocodeNeighborhood(lat, lng);
          onToggleClientGps(booking.id, {
            lat,
            lng,
            neighborhood,
            accuracy,
            updatedAt: new Date().toISOString(),
          });
          setGpsNotice(
            `Votre position GPS (${neighborhood} · ±${accuracy} m) est désormais visible en direct par l'agent, le gérant et l'administrateur.`
          );
        },
        () => {
          onToggleClientGps(booking.id, booking.clientCoords);
          setGpsNotice(
            `Position GPS synchronisée (${booking.id}) sur la carte des agents, du gérant et de l'administrateur.`
          );
        },
        HIGH_ACCURACY_GEO_OPTIONS
      );
    } else {
      onToggleClientGps(booking.id, booking.clientCoords);
      setGpsNotice(
        `Position GPS synchronisée (${booking.id}) sur la carte des agents, du gérant et de l'administrateur.`
      );
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mes Réservations</h1>
          <p className="text-xs text-slate-600 mt-1">
            Activez votre GPS client, suivez vos agents en temps réel, contactez le gérant sur WhatsApp en cas de problème ou laissez un commentaire.
          </p>
        </div>
      </div>

      {gpsNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-xl px-4 py-3 text-xs font-medium flex items-center gap-2">
          <LocateFixed className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{gpsNotice}</span>
        </div>
      )}

      {!isAuthenticated ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center">
            <LocateFixed className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-base font-bold text-slate-900">
              Vos réservations sont strictement confidentielles
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Connectez-vous à votre compte personnel pour accéder uniquement à vos propres commandes, à votre suivi GPS en direct et à votre historique.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-5 py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              Me connecter pour voir mes réservations
            </button>
            <button
              type="button"
              onClick={onOpenCatalog}
              className="px-5 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors"
            >
              Découvrir le catalogue
            </button>
          </div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-sm">
          <div className="space-y-1 max-w-md mx-auto">
            <h2 className="text-base font-bold text-slate-900">
              Aucune réservation sur votre compte
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Vous n'avez pas encore passé de commande. Configurez une prestation à domicile à Libreville, Akanda ou Owendo en quelques clics.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCatalog}
            className="px-5 py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Réserver une prestation</span>
          </button>
        </div>
      ) : (
        <>
          {/* Live Multi-User GPS Map (auto-closed when no active/trackable booking remains) */}
          {showMap && activeTrackableBookings.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowMap(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg inline-flex items-center gap-1.5"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Masquer la carte GPS</span>
                </button>
              </div>
              <LiveGpsMap
                bookings={activeTrackableBookings}
                selectedBookingId={selectedGpsBookingId}
                onSelectBooking={setSelectedGpsBookingId}
                title="Suivi GPS Multi-utilisateurs — Mes Réservations"
              />
            </div>
          )}

          {!showMap && activeTrackableBookings.length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedGpsBookingId(activeTrackableBookings[0].id);
                  setShowMap(true);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Afficher le suivi GPS en direct</span>
              </button>
            </div>
          )}

          {/* Reservations List */}
          <div className="space-y-4">
        {bookings.map((booking) => {
          const isRefusedOrCancelled =
            booking.status === 'rejected' || booking.status === 'cancelled';
          const promoInfo = getBookingPromoInfo(booking);
          const draft = reviewDrafts[booking.id] || {
            rating: booking.rating || 5,
            text: booking.review || '',
          };
          const isEditingReview = openReviewId === booking.id;

          return (
            <div
              key={booking.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-emerald-800">{booking.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>{booking.serviceCategory}</span>
                    <span aria-hidden="true">·</span>
                    <span>{booking.createdAt}</span>
                    {promoInfo && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                        <Tag className="w-3 h-3" />
                        <span>
                          Promo {promoInfo.discountLabel || (promoInfo.discountPercent ? `-${promoInfo.discountPercent}%` : '')} · {promoInfo.title}
                        </span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{booking.serviceName}</h3>
                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>
                      {booking.commune} · {booking.address}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 shrink-0">
                  {booking.status === 'in_transit' && (
                    <Navigation className="w-4 h-4 text-emerald-700" />
                  )}
                  {booking.status === 'completed' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  )}
                  {(booking.status === 'rejected' || booking.status === 'cancelled') && (
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                  )}
                  <span
                    className={
                      booking.status === 'rejected' || booking.status === 'cancelled'
                        ? 'text-rose-700'
                        : booking.status === 'counter_offered'
                        ? 'text-amber-700'
                        : 'text-emerald-800'
                    }
                  >
                    {STATUS_LABELS[booking.status]}
                  </span>
                </div>
              </div>

              {booking.status === 'completed' && (
                <div
                  role="status"
                  className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1 text-xs text-emerald-950"
                >
                  <div className="font-bold flex items-center gap-2 text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Prestation terminée — Merci pour votre confiance !</span>
                  </div>
                  <p className="text-emerald-800 leading-relaxed">
                    Merci pour votre confiance, {booking.clientName} ! L&apos;équipe{' '}
                    <strong>Shine-x-Sanitize Alp Group</strong> vous remercie et espère vous revoir très bientôt.
                  </p>
                </div>
              )}

              {isRefusedOrCancelled && (
                <div
                  role="status"
                  className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-1.5 text-xs text-rose-950"
                >
                  <div className="font-bold flex items-center gap-2 text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      {booking.status === 'rejected'
                        ? 'Votre commande a été refusée par le gérant'
                        : 'Cette commande a été annulée'}
                    </span>
                  </div>
                  <p className="text-rose-900 leading-relaxed">
                    {booking.rejectionReason ||
                      "Le gérant n'a pas pu valider cette intervention. Le suivi GPS en direct a été automatiquement désactivé."}
                  </p>
                  <p className="text-[11px] text-rose-700">
                    Vous pouvez contacter le gérant sur WhatsApp pour plus d'informations ou créer une nouvelle réservation.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="bg-slate-50 p-4 rounded-xl space-y-1.5">
                  <div className="font-semibold text-slate-700">Détails techniques</div>
                  <div className="text-slate-600">
                    Formule / Matériau : <strong className="text-slate-900">{booking.details.material}</strong>
                  </div>
                  <div className="text-slate-600">
                    État : <strong className="text-slate-900">{booking.details.condition}</strong>
                  </div>
                  {booking.details.vehicleBrand && (
                    <div className="text-emerald-800 font-medium">
                      Véhicule : {booking.details.vehicleBrand}
                      {booking.details.vehicleModel ? ` ${booking.details.vehicleModel}` : ''} ·{' '}
                      {booking.details.vehicleSeats} places
                    </div>
                  )}
                  {booking.details.options.length > 0 && (
                    <div className="text-slate-500">
                      Options : {booking.details.options.join(', ')}
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 p-4 rounded-xl space-y-1.5">
                  <div className="font-semibold text-slate-700">Tarification & Paiement</div>
                  {promoInfo && (
                    <>
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Prix initial :</span>
                        <span className="line-through tabular-nums">
                          {promoInfo.originalPrice.toLocaleString()} XAF
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-emerald-700 font-semibold">
                        <span className="truncate pr-2">
                          Promo ({promoInfo.discountLabel || (promoInfo.discountPercent ? `-${promoInfo.discountPercent}%` : '')} {promoInfo.title}) :
                        </span>
                        <span className="tabular-nums shrink-0">
                          -{promoInfo.discountAmount.toLocaleString()} XAF
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Votre proposition :</span>
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {booking.clientOfferPrice.toLocaleString()} XAF
                    </span>
                  </div>
                  {booking.managerCounterPrice !== undefined && (
                    <div className="flex items-center justify-between text-amber-800 font-medium">
                      <span>Tarif ajusté par le gérant :</span>
                      <span className="tabular-nums">
                        {booking.managerCounterPrice.toLocaleString()} XAF
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-200 font-bold text-emerald-800">
                    <span>Prix retenu :</span>
                    <span className="tabular-nums">{booking.finalPrice.toLocaleString()} XAF</span>
                  </div>
                  <div className="text-slate-500 pt-0.5">Mode : {booking.paymentMethod}</div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl space-y-2 flex flex-col justify-between">
                  <div>
                    <div className="font-semibold text-slate-700">
                      {isRefusedOrCancelled ? 'Statut de suivi' : 'Agents désignés & GPS Client'}
                    </div>
                    {isRefusedOrCancelled ? (
                      <div className="text-rose-700 font-medium mt-1">
                        Suivi en direct arrêté suite au refus de la commande.
                      </div>
                    ) : (
                      <>
                        <div className="text-slate-900 font-medium mt-1">
                          {booking.assignedAgents.length > 0
                            ? booking.assignedAgents.join(', ')
                            : 'En attente de désignation par le gérant'}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1">
                          Mon GPS client :{' '}
                          <strong
                            className={
                              booking.clientGpsActive ? 'text-emerald-700' : 'text-slate-700'
                            }
                          >
                            {booking.clientGpsActive ? 'Activé (synchronisé)' : 'Inactif'}
                          </strong>
                        </div>
                      </>
                    )}
                  </div>

                  {booking.status === 'counter_offered' && (
                    <button
                      type="button"
                      onClick={() => onAcceptCounterOffer(booking.id)}
                      className="w-full py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl transition-colors"
                    >
                      Accepter le tarif ({booking.finalPrice.toLocaleString()} XAF)
                    </button>
                  )}
                </div>
              </div>

              {(booking.beforePhotos.length > 0 || booking.afterPhotos.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {booking.beforePhotos.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-slate-500" />
                        <span>Photo avant intervention</span>
                      </div>
                      <img
                        src={booking.beforePhotos[booking.beforePhotos.length - 1]}
                        alt={`Avant intervention ${booking.id}`}
                        className="w-full h-36 object-cover rounded-xl border border-slate-200"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  {booking.afterPhotos.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Photo après intervention</span>
                      </div>
                      <img
                        src={booking.afterPhotos[booking.afterPhotos.length - 1]}
                        alt={`Après intervention ${booking.id}`}
                        className="w-full h-36 object-cover rounded-xl border border-emerald-200"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                </div>
              )}

              {booking.review && !isEditingReview && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= (booking.rating || 5)
                              ? 'fill-amber-400 text-amber-500'
                              : 'text-slate-300'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-slate-900 ml-1.5">
                        Votre commentaire
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">{booking.reviewSubmittedAt}</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{booking.review}</p>
                </div>
              )}

              {isEditingReview && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      Laisser un commentaire sur la prestation
                    </span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() =>
                            setReviewDrafts((prev) => ({
                              ...prev,
                              [booking.id]: { ...draft, rating: star },
                            }))
                          }
                          aria-label={`Noter ${star} sur 5`}
                          className="p-1"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= draft.rating
                                ? 'fill-amber-400 text-amber-500'
                                : 'text-slate-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={draft.text}
                    onChange={(e) =>
                      setReviewDrafts((prev) => ({
                        ...prev,
                        [booking.id]: { ...draft, text: e.target.value },
                      }))
                    }
                    placeholder="Partagez votre avis sur la ponctualité, la qualité du nettoyage ou le comportement de l'agent..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenReviewId(null)}
                      className="px-3.5 py-2 min-h-[40px] text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveReview(booking.id)}
                      className="px-4 py-2 min-h-[40px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors"
                    >
                      Publier le commentaire
                    </button>
                  </div>
                </div>
              )}

              {/* Action Bar for Client: Activate Client GPS (active orders only), Focus Map, WhatsApp Gérant, Review */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
                {isTrackableBooking(booking) && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleActivateClientGps(booking)}
                      className={`px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-2 ${
                        booking.clientGpsActive
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                          : 'bg-slate-900 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <LocateFixed className="w-3.5 h-3.5" />
                      <span>
                        {booking.clientGpsActive
                          ? 'GPS Client Actif (Partagé)'
                          : 'Activer mon GPS Client'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGpsBookingId(booking.id);
                        setShowMap(true);
                      }}
                      className={`px-4 py-2.5 min-h-[44px] text-xs font-semibold rounded-xl border transition-colors inline-flex items-center gap-2 ${
                        showMap && selectedGpsBookingId === booking.id
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                          : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Centrer sur la carte</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setWhatsappTarget(booking)}
                  className="px-4 py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-2"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Gérant</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOpenReviewId(isEditingReview ? null : booking.id)}
                  className="px-4 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-2"
                >
                  <Star className="w-3.5 h-3.5" />
                  <span>{booking.review ? 'Modifier mon commentaire' : 'Laisser un commentaire'}</span>
                </button>
              </div>
            </div>
          );
        })}
          </div>
        </>
      )}

      {whatsappTarget && (
        <WhatsAppComposerModal
          recipientLabel={MANAGER_NAME}
          recipientPhone={MANAGER_DISPLAY_PHONE || MANAGER_WHATSAPP}
          bookingId={whatsappTarget.id}
          defaultMessage={`Bonjour Gérant Shine-x-Sanitize Alp Group, je vous contacte concernant ma réservation ${whatsappTarget.id} (${whatsappTarget.serviceName}) à ${whatsappTarget.address}. Voici mon message : `}
          onClose={() => setWhatsappTarget(null)}
        />
      )}
    </div>
  );
};
