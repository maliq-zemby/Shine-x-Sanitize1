import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  DollarSign,
  LocateFixed,
  Lock,
  MapPin,
  Megaphone,
  MessageCircle,
  Navigation,
  Plus,
  Tag,
  Users,
  XCircle,
} from 'lucide-react';
import { Booking, Promotion, ServiceItem, UserProfile } from '../types';
import { LiveGpsMap } from './LiveGpsMap';
import { WhatsAppComposerModal } from './WhatsAppComposerModal';

interface ManagerOrdersViewProps {
  bookings: Booking[];
  services: ServiceItem[];
  promotions: Promotion[];
  registeredAgents: UserProfile[];
  companyDisplayName?: string;
  onValidateOrder: (bookingId: string) => void;
  onRefuseOrder: (bookingId: string, reason: string) => void;
  onUpdatePrice: (bookingId: string, newPrice: number, note: string) => void;
  onAssignAgents: (bookingId: string, agents: string[]) => void;
  onUpdateServiceBasePrice: (serviceId: string, newBasePrice: number) => void;
  onCreatePromotion: (promo: Omit<Promotion, 'id' | 'status' | 'createdAt' | 'createdByUid'>) => void;
}

export const ManagerOrdersView: React.FC<ManagerOrdersViewProps> = ({
  bookings,
  services,
  promotions,
  registeredAgents,
  companyDisplayName = 'Shine-x-Sanitize Alp Group',
  onValidateOrder,
  onRefuseOrder,
  onUpdatePrice,
  onAssignAgents,
  onUpdateServiceBasePrice,
  onCreatePromotion,
}) => {
  const [subTab, setSubTab] = useState<'orders' | 'pricing' | 'promos'>('orders');
  const [selectedMapBookingId, setSelectedMapBookingId] = useState<string | null>(
    bookings.find((b) => b.gpsActive || b.clientGpsActive || b.status === 'in_transit')?.id ||
      bookings[0]?.id ||
      null
  );
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState<number>(0);
  const [priceNote, setPriceNote] = useState<string>('');
  const [assigningBookingId, setAssigningBookingId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<Record<string, string>>({});
  const [customAgentDraft, setCustomAgentDraft] = useState<Record<string, string>>({});
  const [whatsappClientBooking, setWhatsappClientBooking] = useState<Booking | null>(null);

  // Real-time base price drafts
  const [servicePriceDrafts, setServicePriceDrafts] = useState<Record<string, number>>({});
  const [savedPriceNotice, setSavedPriceNotice] = useState<string>('');

  // Promotion form state
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDiscount, setPromoDiscount] = useState('-15%');
  const [promoCategory, setPromoCategory] = useState('Véhicules');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoValidUntil, setPromoValidUntil] = useState('31 Décembre 2026');
  const [promoNotice, setPromoNotice] = useState('');

  const activeGpsCount = bookings.filter((b) => b.gpsActive || b.clientGpsActive).length;
  const pendingCount = bookings.filter((b) => b.status === 'pending_negotiation').length;
  const confirmedRevenue = bookings
    .filter((b) => b.status !== 'cancelled')
    .reduce((sum, b) => sum + b.finalPrice, 0);

  const getBusyBookingForAgent = (agentName: string, currentBookingId: string): Booking | undefined =>
    bookings.find(
      (b) =>
        b.id !== currentBookingId &&
        (b.status === 'in_transit' || b.status === 'in_progress') &&
        b.assignedAgents.includes(agentName)
    );

  const toggleAgentForBooking = (booking: Booking, agentName: string) => {
    const exists = booking.assignedAgents.includes(agentName);
    if (!exists) {
      const busyBooking = getBusyBookingForAgent(agentName, booking.id);
      if (busyBooking) {
        setAssignError((prev) => ({
          ...prev,
          [booking.id]: `Impossible d'affecter cet agent : il est actuellement en intervention sur la commande #${busyBooking.id}. Il doit d'abord terminer et clôturer sa tâche en cours.`,
        }));
        return;
      }
    }

    setAssignError((prev) => {
      if (!prev[booking.id]) return prev;
      const updated = { ...prev };
      delete updated[booking.id];
      return updated;
    });

    const next = exists
      ? booking.assignedAgents.filter((a) => a !== agentName)
      : [...booking.assignedAgents, agentName];
    onAssignAgents(booking.id, next);
  };

  const handleSaveServicePrice = (service: ServiceItem) => {
    const nextPrice = servicePriceDrafts[service.id] ?? service.basePrice;
    if (nextPrice < 1000) return;
    onUpdateServiceBasePrice(service.id, nextPrice);
    setSavedPriceNotice(
      `Tarif de base mis à jour en temps réel sur l'écran d'accueil : ${service.name} (${nextPrice.toLocaleString()} XAF).`
    );
  };

  const handleSubmitPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoTitle.trim() || !promoDescription.trim()) return;
    onCreatePromotion({
      title: promoTitle.trim(),
      discountLabel: promoDiscount.trim() || 'Offre spéciale',
      serviceCategory: promoCategory,
      description: promoDescription.trim(),
      companyName: companyDisplayName,
      validUntil: promoValidUntil.trim(),
    });
    setPromoTitle('');
    setPromoDescription('');
    setPromoNotice(
      "Annonce envoyée à l'administrateur. Dès validation, elle sera visible par tous les clients."
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suivi et Commande</h1>
          <p className="text-xs text-slate-600 mt-1">
            Interface Gérant & Administrateur : gérez les commandes, modifiez les tarifs d'accueil en temps réel, suivez les GPS clients/agents et publiez des annonces promotionnelles.
          </p>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start">
          <button
            type="button"
            onClick={() => setSubTab('orders')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              subTab === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Commandes & GPS
          </button>
          <button
            type="button"
            onClick={() => setSubTab('pricing')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              subTab === 'pricing' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Tarifs Accueil
          </button>
          <button
            type="button"
            onClick={() => setSubTab('promos')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              subTab === 'promos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Annonces Promo
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-medium">Commandes à traiter</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{pendingCount}</div>
          <div className="text-[11px] text-amber-700 font-medium">En attente de validation gérant</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-medium">Signaux GPS actifs (Client/Agent)</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">{activeGpsCount}</div>
          <div className="text-[11px] text-emerald-700 font-medium">Synchronisation temps réel</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-medium">Volume d'affaires validé</div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {confirmedRevenue.toLocaleString()} XAF
          </div>
          <div className="text-[11px] text-emerald-700 font-medium">
            Commission 10% : {Math.round(confirmedRevenue * 0.1).toLocaleString()} XAF
          </div>
        </div>
      </div>

      {/* SUBTAB 1: COMMANDES & GPS */}
      {subTab === 'orders' && (
        <>
          <LiveGpsMap
            bookings={bookings}
            selectedBookingId={selectedMapBookingId}
            onSelectBooking={setSelectedMapBookingId}
            title="Déplacement en temps réel des agents & GPS clients — Vue Gérant"
          />

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">
              Gestion des Commandes & Affectation des Agents
            </h2>

            {bookings.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-1.5">
                <div className="text-sm font-bold text-slate-900">
                  Aucune commande enregistrée pour le moment
                </div>
                <p className="text-xs text-slate-500">
                  Les nouvelles réservations envoyées par les clients à Libreville apparaîtront ici en temps réel.
                </p>
              </div>
            )}

            {bookings.map((booking) => {
              const isEditingPrice = editingPriceId === booking.id;
              const isAssigning = assigningBookingId === booking.id;

              return (
                <div
                  key={booking.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-semibold text-emerald-800">{booking.id}</span>
                        <span aria-hidden="true">·</span>
                        <span>{booking.clientName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{booking.clientPhone}</span>
                        <span aria-hidden="true">·</span>
                        <span>{booking.createdAt}</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900">{booking.serviceName}</h3>
                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          {booking.commune} · {booking.address}
                        </span>
                        {booking.clientGpsActive && (
                          <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                            <LocateFixed className="w-3.5 h-3.5" />
                            GPS Client Partagé
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs text-slate-500">
                        Offre client :{' '}
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {booking.clientOfferPrice.toLocaleString()} XAF
                        </span>
                      </div>
                      <div className="text-base font-bold text-emerald-800 tabular-nums">
                        Tarif actuel : {booking.finalPrice.toLocaleString()} XAF
                      </div>
                      <div className="text-[11px] font-medium text-slate-600 mt-0.5">
                        Statut : <strong className="text-slate-900">{booking.status}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span>
                      Matériau / Formule : <strong className="text-slate-900">{booking.details.material}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      État : <strong className="text-slate-900">{booking.details.condition}</strong>
                    </span>
                    {booking.details.vehicleBrand && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-800 font-semibold">
                          Véhicule : {booking.details.vehicleBrand} ({booking.details.vehicleSeats} places)
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>
                      Agents affectés :{' '}
                      <strong className="text-slate-900">
                        {booking.assignedAgents.length > 0
                          ? booking.assignedAgents.join(', ')
                          : 'Aucun agent désigné'}
                      </strong>
                    </span>
                  </div>

                  {isEditingPrice && (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-3">
                      <div className="text-xs font-bold text-amber-950">
                        Modifier le prix (Offre client : {booking.clientOfferPrice.toLocaleString()} XAF)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="number"
                          step={1000}
                          min={2000}
                          value={priceInput}
                          onChange={(e) => setPriceInput(Number(e.target.value))}
                          className="bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-700"
                        />
                        <input
                          type="text"
                          value={priceNote}
                          onChange={(e) => setPriceNote(e.target.value)}
                          placeholder="Motif (ex: Véhicule 7 places / taches tenaces)"
                          className="bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingPriceId(null)}
                          className="px-3.5 py-2 min-h-[40px] text-xs font-semibold text-slate-600"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onUpdatePrice(booking.id, priceInput, priceNote);
                            setEditingPriceId(null);
                          }}
                          className="px-4 py-2 min-h-[40px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl"
                        >
                          Envoyer le nouveau tarif au client
                        </button>
                      </div>
                    </div>
                  )}

                  {isAssigning && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          Désigner les agents affectés à la commande {booking.id}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAssigningBookingId(null)}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          Terminer
                        </button>
                      </div>

                      {assignError[booking.id] && (
                        <div
                          role="alert"
                          className="bg-rose-50 border border-rose-300 text-rose-900 rounded-xl px-3.5 py-2.5 text-xs font-medium flex items-start gap-2"
                        >
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <span>{assignError[booking.id]}</span>
                        </div>
                      )}

                      {registeredAgents.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600">
                          Aucun profil agent actif listé automatiquement. Saisissez le nom d&apos;un agent ci-dessous ou demandez à vos techniciens de créer leur compte Agent.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {registeredAgents.map((agent) => {
                            const assigned = booking.assignedAgents.includes(agent.displayName);
                            const busyBooking = getBusyBookingForAgent(agent.displayName, booking.id);
                            const isLocked = !assigned && Boolean(busyBooking);
                            const lockLabel = busyBooking
                              ? busyBooking.status === 'in_transit'
                                ? `En route · #${busyBooking.id}`
                                : `En mission · #${busyBooking.id}`
                              : null;

                            return (
                              <button
                                key={agent.uid}
                                type="button"
                                onClick={() => toggleAgentForBooking(booking, agent.displayName)}
                                className={`p-3 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 ${
                                  assigned
                                    ? 'bg-emerald-700 text-white border-emerald-700'
                                    : isLocked
                                    ? 'bg-amber-50/70 text-slate-600 border-amber-300 hover:bg-amber-100/70'
                                    : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-bold flex items-center gap-1.5">
                                    <span>{agent.displayName}</span>
                                  </div>
                                  <div
                                    className={`text-[11px] truncate ${
                                      assigned
                                        ? 'text-emerald-100'
                                        : isLocked
                                        ? 'text-amber-800 font-semibold'
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    {isLocked
                                      ? `Verrouillé (${lockLabel})`
                                      : `${agent.phone} · ${agent.commune || 'Libreville'}`}
                                  </div>
                                </div>
                                {assigned ? (
                                  <Check className="w-4 h-4 shrink-0" />
                                ) : isLocked ? (
                                  <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <input
                          type="text"
                          value={customAgentDraft[booking.id] || ''}
                          onChange={(e) =>
                            setCustomAgentDraft((prev) => ({
                              ...prev,
                              [booking.id]: e.target.value,
                            }))
                          }
                          placeholder="Affecter / retirer un technicien par nom complet..."
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const name = (customAgentDraft[booking.id] || '').trim();
                            if (!name) return;
                            toggleAgentForBooking(booking, name);
                            setCustomAgentDraft((prev) => ({ ...prev, [booking.id]: '' }));
                          }}
                          className="px-4 py-2 min-h-[40px] bg-slate-900 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap"
                        >
                          Affecter cet agent
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
                    {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                      <>
                        {(booking.status === 'pending_negotiation' ||
                          booking.status === 'counter_offered') && (
                          <button
                            type="button"
                            onClick={() => onValidateOrder(booking.id)}
                            className="px-4 py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Valider la commande</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setEditingPriceId(isEditingPrice ? null : booking.id);
                            setPriceInput(booking.finalPrice + 5000);
                            setPriceNote('');
                          }}
                          className="px-4 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Modifier le prix</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setAssigningBookingId(isAssigning ? null : booking.id)
                          }
                          className="px-4 py-2.5 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Désigner les agents</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onRefuseOrder(booking.id, 'Commande refusée par le gérant')
                          }
                          className="px-4 py-2.5 min-h-[44px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Refuser</span>
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setWhatsappClientBooking(booking)}
                      className="px-4 py-2.5 min-h-[44px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp Client</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMapBookingId(booking.id)}
                      className="px-4 py-2.5 min-h-[44px] bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
                    >
                      <Navigation className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Centrer sur la carte</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* SUBTAB 2: REAL-TIME HOME SERVICE BASE PRICING */}
      {subTab === 'pricing' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Gestion en Temps Réel des Tarifs de Base (Écran d'Accueil)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Toute modification enregistrée ici met à jour instantanément les prix affichés aux clients sur l'écran d'accueil.
            </p>
          </div>

          {savedPriceNotice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-3 text-xs font-medium">
              {savedPriceNotice}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((service) => {
              const currentDraft = servicePriceDrafts[service.id] ?? service.basePrice;
              return (
                <div
                  key={service.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={service.image}
                      alt={service.name}
                      className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-emerald-700">
                        {service.category} · {service.duration}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 truncate">{service.name}</h3>
                      <div className="text-xs text-slate-500 tabular-nums">
                        Tarif actuel : <strong>{service.basePrice.toLocaleString()} XAF</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      step={500}
                      min={1000}
                      value={currentDraft}
                      onChange={(e) =>
                        setServicePriceDrafts((prev) => ({
                          ...prev,
                          [service.id]: Number(e.target.value),
                        }))
                      }
                      aria-label={`Nouveau tarif pour ${service.name}`}
                      className="w-28 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveServicePrice(service)}
                      className="px-3.5 py-2 min-h-[40px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>Appliquer</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB 3: PROMOTIONAL ANNOUNCEMENTS */}
      {subTab === 'promos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleSubmitPromo}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Megaphone className="w-5 h-5 text-emerald-700" />
              <span>Soumettre une Annonce Promotionnelle</span>
            </div>
            <p className="text-xs text-slate-600">
              Une fois validée par l'administrateur central, votre offre promotionnelle apparaîtra instantanément chez tous les clients.
            </p>

            {promoNotice && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-2.5 text-xs font-medium">
                {promoNotice}
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="promo-title" className="text-xs font-semibold text-slate-700">
                Titre de l'offre *
              </label>
              <input
                id="promo-title"
                type="text"
                required
                value={promoTitle}
                onChange={(e) => setPromoTitle(e.target.value)}
                placeholder="Ex: Spécial Week-end Nettoyage BTP & Villa"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label htmlFor="promo-disc" className="text-xs font-semibold text-slate-700">
                  Avantage / Réduction *
                </label>
                <input
                  id="promo-disc"
                  type="text"
                  required
                  value={promoDiscount}
                  onChange={(e) => setPromoDiscount(e.target.value)}
                  placeholder="-20% ou Offert"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="promo-cat" className="text-xs font-semibold text-slate-700">
                  Catégorie ciblée
                </label>
                <select
                  id="promo-cat"
                  value={promoCategory}
                  onChange={(e) => setPromoCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900"
                >
                  <option value="Véhicules">Véhicules & Mobilité</option>
                  <option value="BTP">Nettoyage après travaux BTP</option>
                  <option value="Mobilier">Canapés & Mobilier</option>
                  <option value="Professionnel">Bureaux & Vitres</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="promo-valid" className="text-xs font-semibold text-slate-700">
                  Valable jusqu'au
                </label>
                <input
                  id="promo-valid"
                  type="text"
                  value={promoValidUntil}
                  onChange={(e) => setPromoValidUntil(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="promo-desc" className="text-xs font-semibold text-slate-700">
                Détails de la promotion *
              </label>
              <textarea
                id="promo-desc"
                rows={3}
                required
                value={promoDescription}
                onChange={(e) => setPromoDescription(e.target.value)}
                placeholder="Décrivez les conditions et la zone (Libreville, Akanda, Owendo)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Soumettre pour validation Admin</span>
            </button>
          </form>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Historique de vos annonces</h3>
            {promotions.map((promo) => (
              <div
                key={promo.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-emerald-800">{promo.discountLabel}</span>
                  <span
                    className={`text-[11px] font-semibold ${
                      promo.status === 'approved'
                        ? 'text-emerald-700'
                        : promo.status === 'rejected'
                        ? 'text-rose-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {promo.status === 'approved'
                      ? 'Validée (Visible Clients)'
                      : promo.status === 'rejected'
                      ? 'Refusée'
                      : 'En attente Admin'}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">{promo.title}</div>
                <p className="text-xs text-slate-600">{promo.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {whatsappClientBooking && (
        <WhatsAppComposerModal
          recipientLabel={whatsappClientBooking.clientName}
          recipientPhone={whatsappClientBooking.clientPhone}
          bookingId={whatsappClientBooking.id}
          defaultMessage={`Bonjour ${whatsappClientBooking.clientName}, ici ${companyDisplayName} concernant votre commande ${whatsappClientBooking.id} (${whatsappClientBooking.serviceName}). `}
          onClose={() => setWhatsappClientBooking(null)}
        />
      )}
    </div>
  );
};
