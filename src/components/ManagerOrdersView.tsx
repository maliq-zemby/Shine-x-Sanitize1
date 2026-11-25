import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Camera,
  Check,
  CheckCircle2,
  DollarSign,
  Loader2,
  LocateFixed,
  Lock,
  MapPin,
  Megaphone,
  MessageCircle,
  Navigation,
  Pencil,
  Plus,
  Star,
  Tag,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { Booking, GpsPoint, Promotion, ServiceItem, UserProfile } from '../types';
import { useReverseGeocodedNeighborhood } from '../utils/geocoding';
import { getBookingPromoInfo } from '../utils/promotions';
import { BookingItemsList } from './BookingItemsList';
import { LiveGpsMap } from './LiveGpsMap';
import { WhatsAppComposerModal } from './WhatsAppComposerModal';

const ResolvedNeighborhood: React.FC<{ coords?: GpsPoint | null; fallback?: string }> = ({
  coords,
  fallback,
}) => {
  const name = useReverseGeocodedNeighborhood(coords);
  return <span>{name || fallback || 'Détection...'}</span>;
};

const MANAGER_STATUS_META: Record<
  Booking['status'],
  { label: string; className: string }
> = {
  pending_negotiation: {
    label: 'En attente de validation',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  counter_offered: {
    label: 'Contre-offre envoyée',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  confirmed: {
    label: 'Validée · Agent affecté',
    className: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  in_transit: {
    label: 'Agent en route',
    className: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  },
  in_progress: {
    label: 'Intervention en cours',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  completed: {
    label: 'Intervention terminée',
    className: 'bg-emerald-700 text-white border-emerald-700',
  },
  rejected: {
    label: 'Commande refusée',
    className: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  cancelled: {
    label: 'Commande annulée',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  },
};

function formatOrderTimestamp(value?: string): string {
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

interface ManagerOrdersViewProps {
  bookings: Booking[];
  services: ServiceItem[];
  promotions: Promotion[];
  registeredAgents: UserProfile[];
  companyDisplayName?: string;
  currentUserUid?: string;
  isAdmin?: boolean;
  onValidateOrder: (
    bookingId: string,
    selectedAgentIds?: string[],
    selectedAgentNames?: string[]
  ) => Promise<void> | void;
  onRefuseOrder: (bookingId: string, reason: string) => void;
  onDeleteOrder: (bookingId: string) => Promise<void> | void;
  onCongratulateAgents?: (bookingId: string) => Promise<void> | void;
  onArchivePhotos: (bookingId: string) => void;
  onUpdatePrice: (bookingId: string, newPrice: number, note: string) => void;
  onAssignAgents: (bookingId: string, agents: string[], agentIds?: string[]) => Promise<void> | void;
  onUpdateServiceBasePrice: (serviceId: string, newBasePrice: number) => void;
  onCreatePromotion: (
    promo: Omit<Promotion, 'id' | 'status' | 'createdAt' | 'createdByUid'>
  ) => Promise<void> | void;
  onUpdatePromotion: (
    promoId: string,
    updates: {
      title: string;
      description: string;
      discountLabel: string;
      serviceCategory?: string;
      validUntil?: string;
    }
  ) => Promise<void> | void;
  onDeletePromotion: (promoId: string) => Promise<void> | void;
}

export const ManagerOrdersView: React.FC<ManagerOrdersViewProps> = ({
  bookings,
  services,
  promotions,
  registeredAgents,
  companyDisplayName = 'Shine-x-Sanitize Alp Group',
  currentUserUid = '',
  isAdmin = false,
  onValidateOrder,
  onRefuseOrder,
  onDeleteOrder,
  onCongratulateAgents,
  onArchivePhotos: _onArchivePhotos,
  onUpdatePrice,
  onAssignAgents,
  onUpdateServiceBasePrice,
  onCreatePromotion,
  onUpdatePromotion,
  onDeletePromotion,
}) => {
  const [subTab, setSubTab] = useState<'orders' | 'pricing' | 'promos'>('orders');
  const [selectedMapBookingId, setSelectedMapBookingId] = useState<string | null>(
    bookings.find(
      (b) =>
        b.status !== 'rejected' &&
        b.status !== 'cancelled' &&
        (b.gpsActive || b.clientGpsActive || b.status === 'in_transit')
    )?.id ||
      bookings.find((b) => b.status !== 'rejected' && b.status !== 'cancelled')?.id ||
      null
  );
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState<number>(0);
  const [priceNote, setPriceNote] = useState<string>('');
  const [assigningBookingId, setAssigningBookingId] = useState<string | null>(null);
  const [validatingBookingId, setValidatingBookingId] = useState<string | null>(null);
  const [validationAgentDraft, setValidationAgentDraft] = useState<
    Record<string, { ids: string[]; names: string[] }>
  >({});
  const [validationError, setValidationError] = useState<Record<string, string>>({});
  const [validatingBusyId, setValidatingBusyId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<Record<string, string>>({});
  const [customAgentDraft, setCustomAgentDraft] = useState<Record<string, string>>({});
  const [refusingBookingId, setRefusingBookingId] = useState<string | null>(null);
  const [refusalReasonDraft, setRefusalReasonDraft] = useState<string>(
    'Commande refusée par le gérant : créneau ou tarif non disponible.'
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<Record<string, string>>({});
  const [congratulatingId, setCongratulatingId] = useState<string | null>(null);
  const [congratulateError, setCongratulateError] = useState<Record<string, string>>({});
  const [congratulateSuccess, setCongratulateSuccess] = useState<Record<string, string>>({});
  const [whatsappClientBooking, setWhatsappClientBooking] = useState<Booking | null>(null);

  const handleConfirmDeleteBooking = async (bookingId: string) => {
    if (deletingId) return;
    setDeletingId(bookingId);
    setDeleteError((prev) => ({ ...prev, [bookingId]: '' }));
    try {
      await onDeleteOrder(bookingId);
      setConfirmDeleteId(null);
    } catch (error) {
      console.error('[ManagerOrdersView] Delete booking failed:', { bookingId, error });
      setDeleteError((prev) => ({
        ...prev,
        [bookingId]:
          error instanceof Error && error.message
            ? error.message
            : 'Impossible de supprimer cette commande dans Firestore.',
      }));
    } finally {
      setDeletingId(null);
    }
  };

  const handleCongratulateClick = async (bookingId: string) => {
    if (!onCongratulateAgents || congratulatingId) return;
    setCongratulatingId(bookingId);
    setCongratulateError((prev) => ({ ...prev, [bookingId]: '' }));
    try {
      await onCongratulateAgents(bookingId);
      setCongratulateSuccess((prev) => ({
        ...prev,
        [bookingId]: 'Message d’encouragement et félicitations envoyés en temps réel.',
      }));
    } catch (error) {
      console.error('[ManagerOrdersView] Congratulate agents failed:', { bookingId, error });
      setCongratulateError((prev) => ({
        ...prev,
        [bookingId]:
          error instanceof Error && error.message
            ? error.message
            : "Impossible d'envoyer les félicitations aux agents.",
      }));
    } finally {
      setCongratulatingId(null);
    }
  };

  // Real-time base price drafts
  const [servicePriceDrafts, setServicePriceDrafts] = useState<Record<string, number>>({});
  const [savedPriceNotice, setSavedPriceNotice] = useState<string>('');

  // Promotion form & edit/delete state
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDiscount, setPromoDiscount] = useState('-15%');
  const [promoCategory, setPromoCategory] = useState('Véhicules');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoValidUntil, setPromoValidUntil] = useState('31 Décembre 2026');
  const [promoNotice, setPromoNotice] = useState('');
  const [promoError, setPromoError] = useState('');
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [editPromoTitle, setEditPromoTitle] = useState('');
  const [editPromoDiscount, setEditPromoDiscount] = useState('');
  const [editPromoCategory, setEditPromoCategory] = useState('Véhicules');
  const [editPromoValidUntil, setEditPromoValidUntil] = useState('');
  const [editPromoDescription, setEditPromoDescription] = useState('');
  const [confirmDeletePromoId, setConfirmDeletePromoId] = useState<string | null>(null);
  const [promoBusyId, setPromoBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedMapBookingId) return;
    const focused = bookings.find((b) => b.id === selectedMapBookingId);
    if (
      !focused ||
      focused.status === 'rejected' ||
      focused.status === 'cancelled' ||
      focused.status === 'completed'
    ) {
      const nextActive = bookings.find(
        (b) => b.status !== 'rejected' && b.status !== 'cancelled' && b.status !== 'completed'
      );
      setSelectedMapBookingId(nextActive?.id || null);
    }
  }, [bookings, selectedMapBookingId]);

  const activeGpsCount = bookings.filter(
    (b) => b.status !== 'rejected' && b.status !== 'cancelled' && (b.gpsActive || b.clientGpsActive)
  ).length;
  const pendingCount = bookings.filter((b) => b.status === 'pending_negotiation').length;
  const confirmedRevenue = bookings
    .filter((b) => b.status !== 'cancelled' && b.status !== 'rejected')
    .reduce((sum, b) => sum + b.finalPrice, 0);

  const getBusyBookingForAgent = (
    agentName: string,
    currentBookingId: string,
    agentUid?: string
  ): Booking | undefined =>
    bookings.find(
      (b) =>
        b.id !== currentBookingId &&
        (b.status === 'in_transit' || b.status === 'in_progress') &&
        (b.assignedAgents.includes(agentName) ||
          (agentUid ? (b.assignedAgentIds || []).includes(agentUid) : false))
    );

  const resolveAgentIdsForNames = (names: string[]): string[] => {
    const ids = new Set<string>();
    names.forEach((name) => {
      const normalized = name.trim().toLowerCase();
      const match =
        registeredAgents.find((a) => a.displayName === name) ||
        registeredAgents.find((a) => a.displayName.trim().toLowerCase() === normalized);
      if (match) ids.add(match.uid);
    });
    return Array.from(ids);
  };

  const toggleAgentForBooking = async (booking: Booking, agentName: string, agentUid?: string) => {
    const existsByName = booking.assignedAgents.includes(agentName);
    const existsById = agentUid ? (booking.assignedAgentIds || []).includes(agentUid) : false;
    const exists = existsByName || existsById;

    if (!exists) {
      const busyBooking = getBusyBookingForAgent(agentName, booking.id, agentUid);
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

    const nextNames = exists
      ? booking.assignedAgents.filter((a) => a !== agentName)
      : [...booking.assignedAgents, agentName];
    const currentIds =
      booking.assignedAgentIds && booking.assignedAgentIds.length > 0
        ? booking.assignedAgentIds
        : resolveAgentIdsForNames(booking.assignedAgents);
    const normalizedAgentName = agentName.trim().toLowerCase();
    const resolvedUid =
      agentUid ||
      registeredAgents.find(
        (a) =>
          a.displayName === agentName ||
          a.displayName.trim().toLowerCase() === normalizedAgentName
      )?.uid;
    const nextIds = resolvedUid
      ? exists
        ? currentIds.filter((id) => id !== resolvedUid)
        : Array.from(new Set([...currentIds, resolvedUid]))
      : currentIds;

    try {
      await onAssignAgents(booking.id, nextNames, nextIds);
    } catch (error) {
      setAssignError((prev) => ({
        ...prev,
        [booking.id]:
          error instanceof Error && error.message
            ? error.message
            : "Impossible d'enregistrer l'affectation dans Firestore.",
      }));
    }
  };

  const openValidationPanel = (booking: Booking) => {
    const existingIds =
      booking.assignedAgentIds && booking.assignedAgentIds.length > 0
        ? booking.assignedAgentIds
        : resolveAgentIdsForNames(booking.assignedAgents);
    setValidationAgentDraft((prev) => ({
      ...prev,
      [booking.id]: {
        ids: existingIds,
        names: [...booking.assignedAgents],
      },
    }));
    setValidationError((prev) => {
      const next = { ...prev };
      delete next[booking.id];
      return next;
    });
    setAssigningBookingId(null);
    setValidatingBookingId(validatingBookingId === booking.id ? null : booking.id);
  };

  const toggleValidationAgent = (booking: Booking, agent: UserProfile) => {
    const current = validationAgentDraft[booking.id] || {
      ids: booking.assignedAgentIds || [],
      names: booking.assignedAgents || [],
    };
    const isSelected =
      current.ids.includes(agent.uid) || current.names.includes(agent.displayName);

    if (!isSelected) {
      const busyBooking = getBusyBookingForAgent(agent.displayName, booking.id, agent.uid);
      if (busyBooking) {
        setValidationError((prev) => ({
          ...prev,
          [booking.id]: `Impossible d'affecter ${agent.displayName} : déjà en intervention sur #${busyBooking.id}.`,
        }));
        return;
      }
    }

    setValidationError((prev) => {
      if (!prev[booking.id]) return prev;
      const next = { ...prev };
      delete next[booking.id];
      return next;
    });

    const nextIds = isSelected
      ? current.ids.filter((id) => id !== agent.uid)
      : Array.from(new Set([...current.ids, agent.uid]));
    const nextNames = isSelected
      ? current.names.filter((n) => n !== agent.displayName)
      : Array.from(new Set([...current.names, agent.displayName]));

    setValidationAgentDraft((prev) => ({
      ...prev,
      [booking.id]: { ids: nextIds, names: nextNames },
    }));
  };

  const handleConfirmValidation = async (booking: Booking) => {
    const draft = validationAgentDraft[booking.id] || {
      ids: booking.assignedAgentIds || resolveAgentIdsForNames(booking.assignedAgents),
      names: booking.assignedAgents,
    };
    const mergedIds = Array.from(
      new Set([...draft.ids, ...resolveAgentIdsForNames(draft.names)])
    );

    if (registeredAgents.length > 0 && mergedIds.length === 0 && draft.names.length === 0) {
      setValidationError((prev) => ({
        ...prev,
        [booking.id]:
          'Sélectionnez au moins un agent disponible à affecter avant de valider la commande.',
      }));
      return;
    }

    setValidatingBusyId(booking.id);
    try {
      await onValidateOrder(booking.id, mergedIds, draft.names);
      setValidatingBookingId(null);
    } catch (error) {
      setValidationError((prev) => ({
        ...prev,
        [booking.id]:
          error instanceof Error && error.message
            ? error.message
            : 'Impossible de valider cette commande dans Firestore.',
      }));
    } finally {
      setValidatingBusyId(null);
    }
  };

  const handleSaveServicePrice = (service: ServiceItem) => {
    const nextPrice = servicePriceDrafts[service.id] ?? service.basePrice;
    if (nextPrice < 1000) return;
    onUpdateServiceBasePrice(service.id, nextPrice);
    setSavedPriceNotice(
      `Tarif de base mis à jour en temps réel sur l'écran d'accueil : ${service.name} (${nextPrice.toLocaleString()} XAF).`
    );
  };

  const handleSubmitPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError('');
    setPromoNotice('');
    const titleTrimmed = promoTitle.trim();
    const descTrimmed = promoDescription.trim();
    const discountTrimmed = (promoDiscount.trim() || 'Offre spéciale').slice(0, 40);

    if (titleTrimmed.length < 3) {
      setPromoError("Le titre de l'offre doit contenir au moins 3 caractères.");
      return;
    }
    if (descTrimmed.length < 5) {
      setPromoError('Les détails de la promotion doivent contenir au moins 5 caractères.');
      return;
    }
    if (discountTrimmed.length < 2) {
      setPromoError("L'avantage ou la réduction doit contenir au moins 2 caractères.");
      return;
    }

    try {
      await onCreatePromotion({
        title: titleTrimmed.slice(0, 120),
        discountLabel: discountTrimmed,
        serviceCategory: promoCategory,
        description: descTrimmed.slice(0, 500),
        companyName: companyDisplayName.slice(0, 120),
        validUntil: promoValidUntil.trim().slice(0, 40),
      });
      setPromoTitle('');
      setPromoDescription('');
      setPromoNotice(
        "Promotion publiée en direct ! Elle apparaît immédiatement pour tous les utilisateurs sur la page d'Accueil."
      );
    } catch (err) {
      setPromoError(
        err instanceof Error ? err.message : 'Impossible de publier cette promotion.'
      );
    }
  };

  const startEditingPromo = (promo: Promotion) => {
    setPromoError('');
    setPromoNotice('');
    setConfirmDeletePromoId(null);
    setEditingPromoId(promo.id);
    setEditPromoTitle(promo.title);
    setEditPromoDiscount(promo.discountLabel);
    setEditPromoCategory(promo.serviceCategory || 'Véhicules');
    setEditPromoValidUntil(promo.validUntil || '');
    setEditPromoDescription(promo.description);
  };

  const handleSaveEditedPromo = async (e: React.FormEvent, promoId: string) => {
    e.preventDefault();
    setPromoError('');
    setPromoNotice('');
    const titleTrimmed = editPromoTitle.trim();
    const descTrimmed = editPromoDescription.trim();
    const discountTrimmed = editPromoDiscount.trim();

    if (titleTrimmed.length < 3 || descTrimmed.length < 5 || discountTrimmed.length < 2) {
      setPromoError(
        'Vérifiez le titre (3 car. min), la réduction (2 car. min) et la description (5 car. min).'
      );
      return;
    }

    setPromoBusyId(promoId);
    try {
      await onUpdatePromotion(promoId, {
        title: titleTrimmed.slice(0, 120),
        discountLabel: discountTrimmed.slice(0, 40),
        serviceCategory: editPromoCategory,
        validUntil: editPromoValidUntil.trim().slice(0, 40),
        description: descTrimmed.slice(0, 500),
      });
      setEditingPromoId(null);
      setPromoNotice("Promotion mise à jour en temps réel sur la page d'Accueil.");
    } catch (err) {
      setPromoError(
        err instanceof Error ? err.message : 'Impossible de modifier cette promotion.'
      );
    } finally {
      setPromoBusyId(null);
    }
  };

  const handleConfirmDeletePromo = async (promoId: string) => {
    setPromoError('');
    setPromoNotice('');
    setPromoBusyId(promoId);
    try {
      await onDeletePromotion(promoId);
      setConfirmDeletePromoId(null);
      if (editingPromoId === promoId) setEditingPromoId(null);
      setPromoNotice("Promotion supprimée. Elle a été retirée de la page d'Accueil.");
    } catch (err) {
      setPromoError(
        err instanceof Error ? err.message : 'Impossible de supprimer cette promotion.'
      );
    } finally {
      setPromoBusyId(null);
    }
  };

  const managedPromotions = [...promotions]
    .filter((p) => isAdmin || !currentUserUid || p.createdByUid === currentUserUid)
    .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));

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
              const promoInfo = getBookingPromoInfo(booking);
              const clientCommentText = (booking.clientComment || booking.review || '').trim();
              const clientCommentDate =
                booking.clientCommentAt || booking.reviewSubmittedAt || '';

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
                        {promoInfo && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                            <Tag className="w-3 h-3" />
                            <span>
                              Promo {promoInfo.discountLabel || (promoInfo.discountPercent ? `-${promoInfo.discountPercent}%` : '')} · {promoInfo.title}
                            </span>
                          </span>
                        )}
                        {clientCommentText && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                            <span>
                              Avis client
                              {typeof booking.rating === 'number' ? ` · ${booking.rating}/5` : ''}
                            </span>
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900">{booking.serviceName}</h3>
                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <strong className="text-slate-900">
                            <ResolvedNeighborhood
                              coords={booking.clientCoords}
                              fallback={booking.commune}
                            />
                          </strong>{' '}
                          · {booking.address}
                        </span>
                        {booking.clientGpsActive && (
                          <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                            <LocateFixed className="w-3.5 h-3.5" />
                            GPS Client Partagé
                          </span>
                        )}
                        {booking.agentGps && (booking.gpsActive || booking.assignedAgents.length > 0) && (
                          <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            <Navigation className="w-3 h-3" />
                            Quartier Agent :{' '}
                            <ResolvedNeighborhood
                              coords={booking.agentGps}
                              fallback="En route"
                            />
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {promoInfo && (
                        <div className="text-[11px] font-semibold text-emerald-700 mb-0.5">
                          Promo {promoInfo.discountLabel || (promoInfo.discountPercent ? `-${promoInfo.discountPercent}%` : '')} · {promoInfo.title}{' '}
                          (<span className="line-through text-slate-400 tabular-nums">
                            {promoInfo.originalPrice.toLocaleString()} XAF
                          </span>{' '}
                          <span className="tabular-nums">
                            -{promoInfo.discountAmount.toLocaleString()} XAF
                          </span>)
                        </div>
                      )}
                      <div className="text-xs text-slate-500">
                        Offre client :{' '}
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {booking.clientOfferPrice.toLocaleString()} XAF
                        </span>
                      </div>
                      <div className="text-base font-bold text-emerald-800 tabular-nums">
                        Tarif final à payer : {booking.finalPrice.toLocaleString()} XAF
                      </div>
                      <div className="mt-1 flex flex-col items-end gap-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-[11px] font-bold ${
                            (MANAGER_STATUS_META[booking.status] || {
                              className: 'bg-slate-100 text-slate-800 border-slate-200',
                            }).className
                          }`}
                        >
                          {MANAGER_STATUS_META[booking.status]?.label || booking.status}
                        </span>
                        {(booking.startedAt || booking.completedAt) && (
                          <div className="text-[11px] font-mono text-slate-600 tabular-nums flex flex-wrap justify-end gap-x-2">
                            {booking.startedAt && (
                              <span>Début : {formatOrderTimestamp(booking.startedAt)}</span>
                            )}
                            {booking.completedAt && (
                              <span>Fin : {formatOrderTimestamp(booking.completedAt)}</span>
                            )}
                          </div>
                        )}
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

                  <BookingItemsList booking={booking} compact />

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
                            const assigned =
                              booking.assignedAgents.includes(agent.displayName) ||
                              (booking.assignedAgentIds || []).includes(agent.uid);
                            const busyBooking = getBusyBookingForAgent(
                              agent.displayName,
                              booking.id,
                              agent.uid
                            );
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
                                onClick={() =>
                                  toggleAgentForBooking(booking, agent.displayName, agent.uid)
                                }
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
                                      : `${agent.phone} · ${agent.commune || 'Amissa Chantal, Akanda'}`}
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

                  {booking.status === 'completed' && (
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 sm:p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/70 pb-3">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-emerald-950 flex items-center gap-2">
                            <Camera className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span>Résultat final de la commande terminée</span>
                          </div>
                          <p className="text-[11px] text-emerald-900">
                            {booking.serviceName} · Tarif final :{' '}
                            <strong className="tabular-nums">
                              {booking.finalPrice.toLocaleString()} XAF
                            </strong>
                            {promoInfo
                              ? ` (Promo ${promoInfo.discountLabel || promoInfo.title})`
                              : ''}{' '}
                            · Agents :{' '}
                            <strong>
                              {booking.assignedAgents.length > 0
                                ? booking.assignedAgents.join(', ')
                                : 'Non renseigné'}
                            </strong>
                          </p>
                        </div>
                        {booking.completedAt && (
                          <span className="text-[11px] font-mono text-emerald-800 tabular-nums shrink-0">
                            Terminée : {formatOrderTimestamp(booking.completedAt)}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-700">
                            Photo du début
                          </div>
                          {booking.beforePhotos.length > 0 ? (
                            <img
                              src={booking.beforePhotos[booking.beforePhotos.length - 1]}
                              alt={`Début ${booking.id}`}
                              className="w-full h-44 object-cover rounded-xl border border-slate-200 bg-white"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="h-44 rounded-xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-xs text-slate-500">
                              <Camera className="w-5 h-5 mb-1 text-slate-400" />
                              <span>Aucune photo du début transmise</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <div className="text-[11px] font-semibold text-emerald-900">
                            Photo de la fin
                          </div>
                          {booking.afterPhotos.length > 0 ? (
                            <img
                              src={booking.afterPhotos[booking.afterPhotos.length - 1]}
                              alt={`Fin ${booking.id}`}
                              className="w-full h-44 object-cover rounded-xl border border-emerald-200 bg-white"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="h-44 rounded-xl border border-dashed border-emerald-200 bg-white flex flex-col items-center justify-center text-xs text-slate-500">
                              <Camera className="w-5 h-5 mb-1 text-slate-400" />
                              <span>Aucune photo de la fin transmise</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {(booking.agentsCongratulatedAt || congratulateSuccess[booking.id]) && (
                        <div
                          role="status"
                          className="bg-white border border-emerald-200 rounded-xl px-3.5 py-2.5 text-xs text-emerald-900 flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>
                            {booking.agentsCongratulatedAt
                              ? `Agents félicités le ${formatOrderTimestamp(booking.agentsCongratulatedAt)}${booking.agentsCongratulatedBy ? ` par ${booking.agentsCongratulatedBy}` : ''} — notification envoyée en temps réel.`
                              : congratulateSuccess[booking.id]}
                          </span>
                        </div>
                      )}

                      {congratulateError[booking.id] && (
                        <div
                          role="alert"
                          className="bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 text-xs text-rose-800 flex items-start gap-2"
                        >
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <span>{congratulateError[booking.id]}</span>
                        </div>
                      )}

                      {onCongratulateAgents &&
                        ((booking.assignedAgentIds && booking.assignedAgentIds.length > 0) ||
                          booking.assignedAgents.length > 0) && (() => {
                          const agentCount = Math.max(
                            booking.assignedAgentIds?.length || 0,
                            booking.assignedAgents.length
                          );
                          const isSingleAgent = agentCount === 1;
                          return (
                            <div className="flex flex-wrap items-center gap-2.5 pt-1">
                              <button
                                type="button"
                                disabled={
                                  Boolean(booking.agentsCongratulatedAt) ||
                                  congratulatingId === booking.id
                                }
                                onClick={() => handleCongratulateClick(booking.id)}
                                className="px-4 py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-100 disabled:text-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
                              >
                                {congratulatingId === booking.id ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Envoi des félicitations...</span>
                                  </>
                                ) : booking.agentsCongratulatedAt ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>
                                      {isSingleAgent ? 'Agent félicité' : 'Agents félicités'}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Award className="w-3.5 h-3.5" />
                                    <span>
                                      {isSingleAgent
                                        ? "Féliciter l'agent affecté"
                                        : 'Féliciter les agents affectés'}
                                    </span>
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })()}
                    </div>
                  )}

                  {booking.status !== 'completed' &&
                    (booking.beforePhotos.length > 0 || booking.afterPhotos.length > 0) && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <Camera className="w-4 h-4 text-emerald-700" />
                          <span>Photos transmises en cours d&apos;intervention</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {booking.beforePhotos.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-[11px] font-semibold text-slate-600">
                                Photo du début
                              </div>
                              <img
                                src={booking.beforePhotos[booking.beforePhotos.length - 1]}
                                alt={`Avant ${booking.id}`}
                                className="w-full h-40 object-cover rounded-xl border border-slate-200 bg-white"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                          {booking.afterPhotos.length > 0 && (
                            <div className="space-y-1">
                              <div className="text-[11px] font-semibold text-emerald-800">
                                Photo de la fin
                              </div>
                              <img
                                src={booking.afterPhotos[booking.afterPhotos.length - 1]}
                                alt={`Après ${booking.id}`}
                                className="w-full h-40 object-cover rounded-xl border border-emerald-200 bg-white"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {clientCommentText && (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 text-[11px] font-bold">
                            <MessageCircle className="w-3 h-3 text-amber-700" />
                            <span>Commentaire client</span>
                          </span>
                          {typeof booking.rating === 'number' && (
                            <div className="flex items-center gap-0.5" aria-label={`Note ${booking.rating} sur 5`}>
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
                              <span className="text-[11px] font-bold text-amber-950 ml-1 tabular-nums">
                                {booking.rating}/5
                              </span>
                            </div>
                          )}
                          <span className="text-[11px] font-medium text-slate-600">
                            par {booking.clientName}
                          </span>
                        </div>
                        {clientCommentDate && (
                          <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                            {formatOrderTimestamp(clientCommentDate)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                        {clientCommentText}
                      </p>
                    </div>
                  )}

                  {(booking.status === 'rejected' || booking.status === 'cancelled') && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-900 flex items-start gap-2.5">
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="font-bold">Commande refusée (GPS désactivé)</div>
                        <p className="text-rose-800">
                          {booking.refusalReason ||
                            booking.rejectionReason ||
                            'Commande refusée par le gérant.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {refusingBookingId === booking.id && (
                    <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-4 space-y-3">
                      <div className="text-xs font-bold text-rose-950">
                        Message de refus visible par le client ({booking.clientName})
                      </div>
                      <input
                        type="text"
                        value={refusalReasonDraft}
                        onChange={(e) => setRefusalReasonDraft(e.target.value)}
                        placeholder="Ex: Aucun agent disponible sur ce créneau..."
                        className="w-full bg-white border border-rose-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-600"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setRefusingBookingId(null)}
                          className="px-3.5 py-2 min-h-[40px] text-xs font-semibold text-slate-600"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onRefuseOrder(
                              booking.id,
                              refusalReasonDraft.trim() ||
                                'Commande refusée par le gérant.'
                            );
                            setRefusingBookingId(null);
                          }}
                          className="px-4 py-2 min-h-[40px] bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded-xl"
                        >
                          Confirmer le refus
                        </button>
                      </div>
                    </div>
                  )}

                  {validatingBookingId === booking.id && (
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-emerald-950">
                            Valider la commande #{booking.id} &amp; Affecter les agents
                          </div>
                          <p className="text-[11px] text-emerald-900">
                            Montant final conservé :{' '}
                            <strong className="tabular-nums">
                              {booking.finalPrice.toLocaleString()} XAF
                            </strong>
                            {promoInfo
                              ? ` (Promo ${promoInfo.discountLabel || promoInfo.title} appliquée)`
                              : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setValidatingBookingId(null)}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900 self-start sm:self-auto"
                        >
                          Fermer
                        </button>
                      </div>

                      {validationError[booking.id] && (
                        <div
                          role="alert"
                          className="bg-rose-50 border border-rose-300 text-rose-900 rounded-xl px-3.5 py-2.5 text-xs font-medium flex items-start gap-2"
                        >
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <span>{validationError[booking.id]}</span>
                        </div>
                      )}

                      {registeredAgents.length === 0 ? (
                        <div className="bg-white border border-emerald-200 rounded-xl p-3 text-xs text-slate-600">
                          Aucun compte Agent actif enregistré pour le moment. Vous pouvez tout de même valider ou ajouter un nom via « Désigner les agents ».
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {registeredAgents.map((agent) => {
                            const draft = validationAgentDraft[booking.id] || {
                              ids: booking.assignedAgentIds || [],
                              names: booking.assignedAgents || [],
                            };
                            const isSelected =
                              draft.ids.includes(agent.uid) ||
                              draft.names.includes(agent.displayName);
                            const busyBooking = getBusyBookingForAgent(
                              agent.displayName,
                              booking.id,
                              agent.uid
                            );
                            const isLocked = !isSelected && Boolean(busyBooking);

                            return (
                              <button
                                key={agent.uid}
                                type="button"
                                onClick={() => toggleValidationAgent(booking, agent)}
                                className={`p-3 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 ${
                                  isSelected
                                    ? 'bg-emerald-700 text-white border-emerald-700'
                                    : isLocked
                                    ? 'bg-amber-50/70 text-slate-600 border-amber-300'
                                    : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-bold truncate">
                                    {agent.displayName}
                                  </div>
                                  <div
                                    className={`text-[11px] truncate ${
                                      isSelected
                                        ? 'text-emerald-100'
                                        : isLocked
                                        ? 'text-amber-800 font-semibold'
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    {isLocked
                                      ? `En mission · #${busyBooking?.id}`
                                      : `${agent.phone} · ${agent.commune || 'Libreville'}`}
                                  </div>
                                </div>
                                {isSelected ? (
                                  <Check className="w-4 h-4 shrink-0" />
                                ) : isLocked ? (
                                  <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setValidatingBookingId(null)}
                          className="px-3.5 py-2 min-h-[40px] text-xs font-semibold text-slate-600"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          disabled={validatingBusyId === booking.id}
                          onClick={() => handleConfirmValidation(booking)}
                          className="px-4 py-2 min-h-[40px] bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {validatingBusyId === booking.id
                              ? 'Validation en cours...'
                              : 'Confirmer la validation & notifier'}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
                    {booking.status !== 'cancelled' &&
                      booking.status !== 'rejected' &&
                      booking.status !== 'completed' && (
                        <>
                          {(booking.status === 'pending_negotiation' ||
                            booking.status === 'counter_offered') && (
                            <button
                              type="button"
                              onClick={() => openValidationPanel(booking)}
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
                            onClick={() => {
                              setRefusingBookingId(
                                refusingBookingId === booking.id ? null : booking.id
                              );
                              setRefusalReasonDraft(
                                'Commande refusée par le gérant : créneau ou tarif non disponible.'
                              );
                            }}
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

                    {booking.status !== 'rejected' &&
                      booking.status !== 'cancelled' &&
                      booking.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => setSelectedMapBookingId(booking.id)}
                          className="px-4 py-2.5 min-h-[44px] bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
                        >
                          <Navigation className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Centrer sur la carte</span>
                        </button>
                      )}

                    {confirmDeleteId === booking.id ? (
                      <div className="inline-flex items-center gap-2 ml-auto">
                        <button
                          type="button"
                          disabled={deletingId === booking.id}
                          onClick={() => handleConfirmDeleteBooking(booking.id)}
                          className="px-4 py-2.5 min-h-[44px] bg-rose-700 hover:bg-rose-800 disabled:opacity-60 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5"
                        >
                          {deletingId === booking.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {deletingId === booking.id
                              ? 'Suppression...'
                              : 'Confirmer la suppression'}
                          </span>
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === booking.id}
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-2.5 min-h-[44px] text-xs font-semibold text-slate-600 hover:text-slate-900"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError((prev) => {
                            if (!prev[booking.id]) return prev;
                            const next = { ...prev };
                            delete next[booking.id];
                            return next;
                          });
                          setConfirmDeleteId(booking.id);
                        }}
                        className="px-4 py-2.5 min-h-[44px] bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer la commande</span>
                      </button>
                    )}
                  </div>

                  {deleteError[booking.id] && (
                    <div
                      role="alert"
                      className="bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 text-xs text-rose-800 flex items-start gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{deleteError[booking.id]}</span>
                    </div>
                  )}
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
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 self-start"
          >
            <div className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Megaphone className="w-5 h-5 text-emerald-700" />
              <span>Publier une Annonce Promotionnelle</span>
            </div>
            <p className="text-xs text-slate-600">
              Votre offre est publiée immédiatement sans validation administrateur et apparaît en direct pour tous les utilisateurs sur la page d&apos;Accueil.
            </p>

            {promoNotice && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-2.5 text-xs font-medium">
                {promoNotice}
              </div>
            )}
            {promoError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl px-4 py-2.5 text-xs font-medium">
                {promoError}
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="promo-title" className="text-xs font-semibold text-slate-700">
                Titre de l&apos;offre *
              </label>
              <input
                id="promo-title"
                type="text"
                required
                minLength={3}
                maxLength={120}
                value={promoTitle}
                onChange={(e) => setPromoTitle(e.target.value)}
                placeholder="Ex: Spécial Week-end Nettoyage Canapés & Véhicules"
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
                  minLength={2}
                  maxLength={40}
                  value={promoDiscount}
                  onChange={(e) => setPromoDiscount(e.target.value)}
                  placeholder="-20% ou 15 000 XAF"
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
                  <option value="Véhicules">Véhicules (4 roues, Vélo, Moto &amp; Quad)</option>
                  <option value="Mobilier">Canapés &amp; Assises</option>
                  <option value="Professionnel">Vitrerie (Baies &amp; Fenêtres)</option>
                  <option value="Literie">Matelas &amp; Articles bébé</option>
                  <option value="Sol">Tapis &amp; Moquettes</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="promo-valid" className="text-xs font-semibold text-slate-700">
                  Valable jusqu&apos;au
                </label>
                <input
                  id="promo-valid"
                  type="text"
                  maxLength={40}
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
                minLength={5}
                maxLength={500}
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
              <span>Publier la promotion immédiatement</span>
            </button>
          </form>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Vos annonces promotionnelles ({managedPromotions.length})
              </h3>
              <span className="text-[11px] font-medium text-emerald-700">
                Synchronisées en direct avec l&apos;Accueil
              </span>
            </div>

            {managedPromotions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-500">
                Aucune promotion publiée pour le moment. Utilisez le formulaire ci-contre pour lancer votre première offre en direct.
              </div>
            ) : (
              managedPromotions.map((promo) => {
                const isOwnerOrAdmin = isAdmin || !currentUserUid || promo.createdByUid === currentUserUid;
                const isEditing = editingPromoId === promo.id;
                const isBusy = promoBusyId === promo.id;
                const isPublished = promo.status === 'active' || promo.status === 'approved';

                return (
                  <div
                    key={promo.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3"
                  >
                    {isEditing ? (
                      <form
                        onSubmit={(e) => handleSaveEditedPromo(e, promo.id)}
                        className="space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-emerald-800">
                            Modifier la promotion
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingPromoId(null)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
                            aria-label="Fermer la modification"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">
                            Titre *
                          </label>
                          <input
                            type="text"
                            required
                            minLength={3}
                            maxLength={120}
                            value={editPromoTitle}
                            onChange={(e) => setEditPromoTitle(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-700">
                              Réduction / Prix *
                            </label>
                            <input
                              type="text"
                              required
                              minLength={2}
                              maxLength={40}
                              value={editPromoDiscount}
                              onChange={(e) => setEditPromoDiscount(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-700">
                              Catégorie
                            </label>
                            <select
                              value={editPromoCategory}
                              onChange={(e) => setEditPromoCategory(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                            >
                              <option value="Véhicules">Véhicules (4 roues, Vélo, Moto &amp; Quad)</option>
                              <option value="Mobilier">Canapés &amp; Assises</option>
                              <option value="Professionnel">Vitrerie (Baies &amp; Fenêtres)</option>
                              <option value="Literie">Matelas &amp; Articles bébé</option>
                              <option value="Sol">Tapis &amp; Moquettes</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-700">
                              Valable jusqu&apos;au
                            </label>
                            <input
                              type="text"
                              maxLength={40}
                              value={editPromoValidUntil}
                              onChange={(e) => setEditPromoValidUntil(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-slate-700">
                            Description *
                          </label>
                          <textarea
                            rows={3}
                            required
                            minLength={5}
                            maxLength={500}
                            value={editPromoDescription}
                            onChange={(e) => setEditPromoDescription(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingPromoId(null)}
                            className="px-3.5 py-2 min-h-[38px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                          >
                            Annuler
                          </button>
                          <button
                            type="submit"
                            disabled={isBusy}
                            className="px-4 py-2 min-h-[38px] bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isBusy ? 'Enregistrement...' : 'Enregistrer'}</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-emerald-800">
                              {promo.discountLabel}
                            </span>
                            <span
                              className={`text-[11px] font-semibold ${
                                isPublished
                                  ? 'text-emerald-700'
                                  : promo.status === 'rejected'
                                  ? 'text-rose-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {isPublished
                                ? 'Active (Visible Accueil)'
                                : promo.status === 'rejected'
                                ? 'Désactivée'
                                : 'Brouillon'}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-slate-900">{promo.title}</div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {promo.description}
                          </p>
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                            <span>{promo.serviceCategory || 'Toutes catégories'}</span>
                            {promo.validUntil && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Jusqu&apos;au {promo.validUntil}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {isOwnerOrAdmin && (
                          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => startEditingPromo(promo)}
                              className="px-3.5 py-2 min-h-[38px] bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Modifier</span>
                            </button>

                            {confirmDeletePromoId === promo.id ? (
                              <div className="inline-flex items-center gap-2 ml-auto">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleConfirmDeletePromo(promo.id)}
                                  className="px-3.5 py-2 min-h-[38px] bg-rose-700 hover:bg-rose-800 disabled:opacity-60 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>{isBusy ? 'Suppression...' : 'Confirmer'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePromoId(null)}
                                  className="px-3 py-2 min-h-[38px] text-xs font-semibold text-slate-600 hover:text-slate-900"
                                >
                                  Annuler
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePromoId(promo.id)}
                                className="px-3.5 py-2 min-h-[38px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 ml-auto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Supprimer</span>
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })
            )}
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
