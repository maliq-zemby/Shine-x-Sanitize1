import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bike,
  Check,
  Info,
  LocateFixed,
  Minus,
  Plus,
  Receipt,
  ShoppingCart,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import {
  COMMUNES,
  SUPPLEMENTAL_SERVICES,
  TWO_WHEEL_VEHICLE_QUOTE_OPTION,
  VEHICLE_4W_INTERIOR_NOTE,
  getServiceQuoteOptions,
} from '../data/mockData';
import {
  CommuneGrandLibreville,
  DEFAULT_QUARTIER,
  QUARTIERS_BY_COMMUNE,
  QUARTIERS_GRAND_LIBREVILLE,
  matchLocalQuartier,
} from '../data/quartiers';
import {
  Booking,
  BookingServiceItem,
  CartItem,
  GpsPoint,
  PaymentMethod,
  Promotion,
  ServiceItem,
  SupplementalServiceOption,
} from '../types';
import { HIGH_ACCURACY_GEO_OPTIONS } from '../utils/geocoding';
import { buildBookingPromoApplied, computeDiscountedPrice } from '../utils/promotions';

interface ServiceConfiguratorModalProps {
  service: ServiceItem;
  ownerUid: string;
  defaultClientName?: string;
  defaultClientPhone?: string;
  appliedPromotion?: Promotion | null;
  initialIntent?: 'order' | 'cart';
  preselectTwoWheel?: boolean;
  onRemovePromotion?: () => void;
  onClose: () => void;
  onSubmitBooking: (booking: Booking) => void;
  onAddToCart?: (
    items: CartItem | CartItem[],
    selectedExtras?: SupplementalServiceOption[]
  ) => void;
}

export const ServiceConfiguratorModal: React.FC<ServiceConfiguratorModalProps> = ({
  service,
  ownerUid,
  defaultClientName = '',
  defaultClientPhone = '+241 ',
  appliedPromotion = null,
  initialIntent = 'order',
  preselectTwoWheel = false,
  onRemovePromotion,
  onClose,
  onSubmitBooking,
  onAddToCart,
}) => {
  const isFourWheelService = service.id === 'srv-5' || service.vehicleType === '4_wheels';
  const isTwoWheelService = service.id === TWO_WHEEL_VEHICLE_QUOTE_OPTION.id;
  const quoteOptions = getServiceQuoteOptions(service.id).filter(
    (opt) => opt.id !== TWO_WHEEL_VEHICLE_QUOTE_OPTION.id
  );
  const allQuoteOptions = [...quoteOptions, TWO_WHEEL_VEHICLE_QUOTE_OPTION];

  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    quoteOptions.forEach((opt) => {
      initial[opt.id] = 0;
    });
    initial[TWO_WHEEL_VEHICLE_QUOTE_OPTION.id] =
      preselectTwoWheel || isTwoWheelService ? 1 : 0;
    return initial;
  });
  const [selectedExtraIds, setSelectedExtraIds] = useState<string[]>([]);

  const [commune, setCommune] = useState(COMMUNES[0].name);
  const [selectedQuartierId, setSelectedQuartierId] = useState(DEFAULT_QUARTIER.id);
  const [detectedGps, setDetectedGps] = useState<GpsPoint | null>(null);
  const [detectingGps, setDetectingGps] = useState(false);
  const [address, setAddress] = useState('');
  const [clientName, setClientName] = useState(defaultClientName);
  const [clientPhone, setClientPhone] = useState(defaultClientPhone);
  const [material, setMaterial] = useState(service.materials[0] || '');
  const [condition, setCondition] = useState('Moyen (Taches visibles)');
  const [agentsCount, setAgentsCount] = useState(2);

  const [promoRemoved, setPromoRemoved] = useState(false);
  const [hasManualOffer, setHasManualOffer] = useState(false);
  const [clientOfferPrice, setClientOfferPrice] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Airtel Money');
  const [selectionError, setSelectionError] = useState('');

  const activePromotion = !promoRemoved ? appliedPromotion : null;

  const selectedServiceLines = quoteOptions
    .map((opt) => {
      const qty = Math.max(0, Math.round(quantities[opt.id] || 0));
      return {
        ...opt,
        quantity: qty,
        subtotal: qty * opt.unitPrice,
      };
    })
    .filter((line) => line.quantity > 0);

  const twoWheelQty = Math.max(
    0,
    Math.round(quantities[TWO_WHEEL_VEHICLE_QUOTE_OPTION.id] || 0)
  );
  const twoWheelSubtotal = twoWheelQty * TWO_WHEEL_VEHICLE_QUOTE_OPTION.unitPrice;

  const selectedQuoteLines = allQuoteOptions
    .map((opt) => {
      const qty = Math.max(0, Math.round(quantities[opt.id] || 0));
      return {
        ...opt,
        quantity: qty,
        subtotal: qty * opt.unitPrice,
      };
    })
    .filter((line) => line.quantity > 0);

  const totalSelectedUnits = selectedQuoteLines.reduce((sum, line) => sum + line.quantity, 0);
  const rawItemsTotal = selectedQuoteLines.reduce((sum, line) => sum + line.subtotal, 0);
  const selectedExtras = SUPPLEMENTAL_SERVICES.filter((opt) =>
    selectedExtraIds.includes(opt.id)
  );
  const extrasTotal = selectedExtras.reduce((sum, opt) => sum + opt.price, 0);
  const rawQuoteTotal = rawItemsTotal > 0 ? rawItemsTotal + extrasTotal : 0;

  const promoBreakdown =
    activePromotion && rawQuoteTotal > 0
      ? computeDiscountedPrice(rawQuoteTotal, activePromotion)
      : null;

  const targetRecommendedOffer =
    rawQuoteTotal > 0 ? (promoBreakdown ? promoBreakdown.finalPrice : rawQuoteTotal) : 0;

  useEffect(() => {
    if (!hasManualOffer) {
      setClientOfferPrice(targetRecommendedOffer);
    }
  }, [targetRecommendedOffer, hasManualOffer]);

  const handleQuantityChange = (optionId: string, delta: number) => {
    setSelectionError('');
    setQuantities((prev) => {
      const current = prev[optionId] || 0;
      const next = Math.max(0, Math.min(20, current + delta));
      return { ...prev, [optionId]: next };
    });
  };

  const toggleExtra = (extraId: string) => {
    setSelectedExtraIds((prev) =>
      prev.includes(extraId) ? prev.filter((id) => id !== extraId) : [...prev, extraId]
    );
  };

  const handleRemovePromo = () => {
    setPromoRemoved(true);
    setHasManualOffer(false);
    setClientOfferPrice(rawQuoteTotal);
    onRemovePromotion?.();
  };

  const activeCommuneObj = COMMUNES.find((c) => c.name === commune) || COMMUNES[0];
  const communeQuartiers = QUARTIERS_BY_COMMUNE[activeCommuneObj.id] || QUARTIERS_BY_COMMUNE.Akanda;
  const selectedQuartier =
    QUARTIERS_GRAND_LIBREVILLE.find((q) => q.id === selectedQuartierId) ||
    communeQuartiers[0] ||
    DEFAULT_QUARTIER;

  const handleCommuneChange = (nextCommuneName: string) => {
    setCommune(nextCommuneName);
    setDetectedGps(null);
    const nextCommuneObj = COMMUNES.find((c) => c.name === nextCommuneName) || COMMUNES[0];
    const firstQuartier = QUARTIERS_BY_COMMUNE[nextCommuneObj.id]?.[0] || DEFAULT_QUARTIER;
    setSelectedQuartierId(firstQuartier.id);
  };

  const handleDetectMyQuartier = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const matched = matchLocalQuartier(latitude, longitude);
        const targetCommune =
          COMMUNES.find((c) => c.id === matched.quartier.commune) || COMMUNES[0];
        setCommune(targetCommune.name);
        setSelectedQuartierId(matched.quartier.id);
        setDetectedGps({
          lat: latitude,
          lng: longitude,
          neighborhood: matched.label,
          accuracy: Math.round(accuracy),
          updatedAt: new Date().toISOString(),
        });
        setDetectingGps(false);
      },
      () => {
        setCommune(COMMUNES[0].name);
        setSelectedQuartierId(DEFAULT_QUARTIER.id);
        setDetectedGps({
          lat: DEFAULT_QUARTIER.lat,
          lng: DEFAULT_QUARTIER.lng,
          neighborhood: DEFAULT_QUARTIER.label,
          updatedAt: new Date().toISOString(),
        });
        setDetectingGps(false);
      },
      HIGH_ACCURACY_GEO_OPTIONS
    );
  };

  const buildQuotePayloadDetails = () => {
    const serviceParts = selectedServiceLines.map((l) => `${l.quantity}× ${l.label}`);
    let fullServiceName = '';
    if (selectedServiceLines.length === 0 && twoWheelQty > 0) {
      fullServiceName = `${twoWheelQty}× ${TWO_WHEEL_VEHICLE_QUOTE_OPTION.label}`;
    } else if (selectedServiceLines.length > 0 && twoWheelQty > 0) {
      fullServiceName = `${service.name} (${serviceParts.join(', ')}) + ${twoWheelQty}× ${TWO_WHEEL_VEHICLE_QUOTE_OPTION.label}`;
    } else {
      fullServiceName = `${service.name} : ${serviceParts.join(', ')}`;
    }
    fullServiceName = fullServiceName.slice(0, 180);

    const formattedOptions = selectedQuoteLines.map(
      (line) =>
        `${line.quantity}× ${line.label} (${line.unitPrice.toLocaleString('fr-FR')} FCFA) = ${line.subtotal.toLocaleString('fr-FR')} FCFA`
    );

    const supplementalLines = selectedExtras.map((extra) =>
      extra.price === 0
        ? `Supplément : ${extra.label} (Gratuit · 0 FCFA)`
        : `Supplément : ${extra.label} (+${extra.price.toLocaleString('fr-FR')} FCFA)`
    );

    const quoteItems: BookingServiceItem[] = selectedQuoteLines.map((line) => {
      const isTwoWheel = line.id === TWO_WHEEL_VEHICLE_QUOTE_OPTION.id;
      return {
        serviceId: isTwoWheel ? TWO_WHEEL_VEHICLE_QUOTE_OPTION.id : service.id,
        serviceName: line.label,
        serviceCategory: isTwoWheel ? TWO_WHEEL_VEHICLE_QUOTE_OPTION.serviceCategory : service.category,
        ...(!isTwoWheel && isFourWheelService ? { vehicleType: '4_wheels' as const } : {}),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        totalPrice: line.subtotal,
        ...(!isTwoWheel && material ? { material } : {}),
        ...(condition ? { condition } : {}),
        agentsCount,
        image: isTwoWheel ? TWO_WHEEL_VEHICLE_QUOTE_OPTION.image : service.image,
      };
    });

    const resolvedServiceId =
      selectedServiceLines.length === 0 && twoWheelQty > 0
        ? TWO_WHEEL_VEHICLE_QUOTE_OPTION.id
        : service.id;

    const resolvedCategory: Booking['serviceCategory'] =
      selectedServiceLines.length === 0 && twoWheelQty > 0
        ? 'Véhicules'
        : selectedServiceLines.length > 0 && twoWheelQty > 0 && service.category !== 'Véhicules'
        ? 'Multi-services'
        : service.category;

    return {
      resolvedServiceId,
      resolvedCategory,
      fullServiceName,
      formattedOptions,
      supplementalLines,
      quoteItems,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectionError('');

    if (selectedQuoteLines.length === 0 || rawItemsTotal <= 0) {
      setSelectionError(
        'Veuillez sélectionner au moins un élément (total > 0 FCFA) avant de valider la commande.'
      );
      return;
    }

    const {
      resolvedServiceId,
      resolvedCategory,
      fullServiceName,
      formattedOptions,
      supplementalLines,
      quoteItems,
    } = buildQuotePayloadDetails();

    const formattedAddress = address.trim()
      ? `${selectedQuartier.name} — ${address.trim()}`
      : selectedQuartier.label;

    const clientCoords: GpsPoint = detectedGps
      ? detectedGps
      : {
          lat: selectedQuartier.lat,
          lng: selectedQuartier.lng,
          neighborhood: selectedQuartier.label,
        };

    const finalSubmittedOffer = Math.max(
      1000,
      Math.round(clientOfferPrice > 0 ? clientOfferPrice : targetRecommendedOffer)
    );
    const nowIso = new Date().toISOString();

    const bookingPhotos =
      selectedServiceLines.length === 0 && twoWheelQty > 0
        ? [TWO_WHEEL_VEHICLE_QUOTE_OPTION.image]
        : twoWheelQty > 0
        ? [service.image, TWO_WHEEL_VEHICLE_QUOTE_OPTION.image]
        : [service.image];

    const newBooking: Booking = {
      id: `SHINE-${Math.floor(1000 + Math.random() * 9000)}`,
      ownerUid,
      ...(ownerUid ? { userId: ownerUid } : {}),
      serviceId: resolvedServiceId,
      serviceName: fullServiceName,
      serviceCategory: resolvedCategory,
      ...(selectedServiceLines.length > 0 && isFourWheelService
        ? { vehicleType: '4_wheels' as const }
        : {}),
      items: quoteItems,
      clientName: clientName.trim() || defaultClientName,
      clientPhone: clientPhone.trim() || defaultClientPhone,
      commune: selectedQuartier.commune as CommuneGrandLibreville,
      address: formattedAddress,
      clientCoords,
      clientGpsActive: Boolean(detectedGps),
      details: {
        material:
          selectedServiceLines.length === 0 && twoWheelQty > 0
            ? 'Vélo, Moto & Quad'
            : material || 'Standard',
        condition,
        stains: ['Taches courantes'],
        options: [...formattedOptions, ...supplementalLines].slice(0, 12),
        ...(selectedExtras.length > 0
          ? {
              supplementalServices: selectedExtras.map(({ id, label, price }) => ({
                id,
                label,
                price,
              })),
            }
          : {}),
        agentsCount,
        cartItems: quoteItems,
      },
      clientOfferPrice: finalSubmittedOffer,
      ...(activePromotion && promoBreakdown
        ? {
            promoApplied: buildBookingPromoApplied(activePromotion, promoBreakdown),
          }
        : {}),
      finalPrice: finalSubmittedOffer,
      status: 'pending_negotiation',
      assignedAgents: [],
      assignedAgentIds: [],
      gpsActive: false,
      beforePhotos: bookingPhotos,
      afterPhotos: [],
      createdAt: "À l'instant",
      updatedAt: nowIso,
      paymentMethod,
    };

    onSubmitBooking(newBooking);
  };

  const handleAddConfiguredToCart = () => {
    if (!onAddToCart) return;
    setSelectionError('');

    if (selectedQuoteLines.length === 0 || rawItemsTotal <= 0) {
      setSelectionError(
        'Veuillez sélectionner au moins un élément (total > 0 FCFA) avant d’ajouter ce service au panier.'
      );
      return;
    }

    const itemsToAdd: CartItem[] = [];

    if (selectedServiceLines.length > 0) {
      const mainSubtotal = selectedServiceLines.reduce((sum, l) => sum + l.subtotal, 0);
      const mainSummary = `${service.name} : ${selectedServiceLines
        .map((l) => `${l.quantity}× ${l.label}`)
        .join(', ')}`.slice(0, 180);
      const mainOptions = selectedServiceLines.map(
        (line) =>
          `${line.quantity}× ${line.label} (${line.unitPrice.toLocaleString('fr-FR')} FCFA) = ${line.subtotal.toLocaleString('fr-FR')} FCFA`
      );
      const mainQuoteItems: BookingServiceItem[] = selectedServiceLines.map((line) => ({
        serviceId: service.id,
        serviceName: line.label,
        serviceCategory: service.category,
        ...(isFourWheelService ? { vehicleType: '4_wheels' as const } : {}),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        totalPrice: line.subtotal,
        ...(material ? { material } : {}),
        ...(condition ? { condition } : {}),
        agentsCount,
        image: service.image,
      }));
      const mainUnitPrice = Math.max(1000, Math.round(mainSubtotal));
      itemsToAdd.push({
        cartItemId: `cart-${service.id}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        serviceId: service.id,
        serviceName: mainSummary,
        serviceCategory: service.category,
        ...(isFourWheelService ? { vehicleType: '4_wheels' as const } : {}),
        quantity: 1,
        unitPrice: mainUnitPrice,
        totalPrice: mainUnitPrice,
        material,
        condition,
        options: mainOptions,
        quoteLines: mainQuoteItems,
        agentsCount,
        duration: service.duration,
        image: service.image,
        ...(activePromotion ? { promotion: activePromotion } : {}),
      });
    }

    if (twoWheelQty > 0) {
      itemsToAdd.push({
        cartItemId: `cart-${TWO_WHEEL_VEHICLE_QUOTE_OPTION.id}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        serviceId: TWO_WHEEL_VEHICLE_QUOTE_OPTION.id,
        serviceName: TWO_WHEEL_VEHICLE_QUOTE_OPTION.label,
        serviceCategory: TWO_WHEEL_VEHICLE_QUOTE_OPTION.serviceCategory,
        quantity: twoWheelQty,
        unitPrice: TWO_WHEEL_VEHICLE_QUOTE_OPTION.unitPrice,
        totalPrice: twoWheelSubtotal,
        condition,
        options: ['Tarif fixe : 5 000 FCFA / véhicule (vélo, moto ou quad)'],
        agentsCount,
        duration: TWO_WHEEL_VEHICLE_QUOTE_OPTION.duration,
        image: TWO_WHEEL_VEHICLE_QUOTE_OPTION.image,
        ...(activePromotion ? { promotion: activePromotion } : {}),
      });
    }

    onAddToCart(itemsToAdd, selectedExtras);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200 relative my-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le configurateur"
          className="absolute top-5 right-5 w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4 pr-10">
          <img
            src={service.image}
            alt={service.name}
            className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0 hidden sm:block"
            referrerPolicy="no-referrer"
          />
          <div>
            <div className="text-xs font-semibold text-emerald-700">
              {service.category} · {service.duration}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">{service.name}</h2>
            <p className="text-xs text-slate-500 mt-1">{service.description}</p>
          </div>
        </div>

        {isFourWheelService && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-amber-950">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span className="font-medium">{VEHICLE_4W_INTERIOR_NOTE}</span>
          </div>
        )}

        {activePromotion && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-emerald-950">
              <Tag className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">
                  Promotion active : {activePromotion.discountLabel} · {activePromotion.title}
                </div>
                <div className="text-[11px] text-emerald-800">
                  Offre {activePromotion.companyName} — La remise est calculée automatiquement sur votre devis.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemovePromo}
              className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 text-[11px] font-semibold transition-colors shrink-0"
            >
              Retirer la promotion
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* CONFIGURATEUR DE DEVIS EN TEMPS RÉEL (SÉLECTEUR DE QUANTITÉ 0, 1, 2...) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Receipt className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Sélectionnez les éléments et quantités (Devis en FCFA)</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-800 tabular-nums">
                {totalSelectedUnits} élément{totalSelectedUnits > 1 ? 's' : ''} sélectionné
                {totalSelectedUnits > 1 ? 's' : ''}
              </span>
            </div>

            <div className="divide-y divide-slate-200 bg-white border border-slate-200 rounded-xl overflow-hidden">
              {quoteOptions.map((opt) => {
                const qty = Math.max(0, Math.round(quantities[opt.id] || 0));
                const lineSubtotal = qty * opt.unitPrice;
                const isActive = qty > 0;

                return (
                  <div
                    key={opt.id}
                    className={`px-3.5 py-3 flex items-center justify-between gap-3 transition-colors ${
                      isActive ? 'bg-emerald-50/50' : 'bg-white'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-slate-900">
                        {opt.label}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {opt.unitPrice.toLocaleString('fr-FR')} FCFA / unité
                        {isActive && (
                          <span className="ml-2 font-bold text-emerald-800">
                            · Sous-total : {lineSubtotal.toLocaleString('fr-FR')} FCFA
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="inline-flex items-center border border-slate-200 rounded-xl bg-slate-50 p-0.5 shrink-0">
                      <button
                        type="button"
                        aria-label={`Diminuer la quantité pour ${opt.label}`}
                        disabled={qty <= 0}
                        onClick={() => handleQuantityChange(opt.id, -1)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:bg-white disabled:opacity-35 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-9 text-center text-xs font-bold text-slate-900 tabular-nums">
                        {qty}
                      </span>
                      <button
                        type="button"
                        aria-label={`Augmenter la quantité pour ${opt.label}`}
                        disabled={qty >= 20}
                        onClick={() => handleQuantityChange(opt.id, 1)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:bg-white disabled:opacity-35 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Option intégrée : Nettoyage de Vélo, Moto & Quad (5 000 FCFA fixe par véhicule) */}
              <div
                className={`px-3.5 py-3 flex items-center justify-between gap-3 transition-colors ${
                  twoWheelQty > 0 ? 'bg-emerald-50/60' : 'bg-slate-50/40'
                }`}
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="text-xs sm:text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                    <Bike className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>{TWO_WHEEL_VEHICLE_QUOTE_OPTION.label}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    {TWO_WHEEL_VEHICLE_QUOTE_OPTION.unitPrice.toLocaleString('fr-FR')} FCFA / véhicule (vélo, moto ou quad)
                    {twoWheelQty > 0 && (
                      <span className="ml-2 font-bold text-emerald-800">
                        · Sous-total : {twoWheelSubtotal.toLocaleString('fr-FR')} FCFA
                      </span>
                    )}
                  </div>
                </div>

                <div className="inline-flex items-center border border-slate-200 rounded-xl bg-slate-50 p-0.5 shrink-0">
                  <button
                    type="button"
                    aria-label={`Diminuer la quantité pour ${TWO_WHEEL_VEHICLE_QUOTE_OPTION.label}`}
                    disabled={twoWheelQty <= 0}
                    onClick={() => handleQuantityChange(TWO_WHEEL_VEHICLE_QUOTE_OPTION.id, -1)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:bg-white disabled:opacity-35 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-9 text-center text-xs font-bold text-slate-900 tabular-nums">
                    {twoWheelQty}
                  </span>
                  <button
                    type="button"
                    aria-label={`Augmenter la quantité pour ${TWO_WHEEL_VEHICLE_QUOTE_OPTION.label}`}
                    disabled={twoWheelQty >= 20}
                    onClick={() => handleQuantityChange(TWO_WHEEL_VEHICLE_QUOTE_OPTION.id, 1)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:bg-white disabled:opacity-35 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION SERVICES SUPPLÉMENTAIRES */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Services supplémentaires (optionnels)</span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-800 tabular-nums">
                  {selectedExtras.length > 0
                    ? `${selectedExtras.length} sélectionné${selectedExtras.length > 1 ? 's' : ''} · ${
                        extrasTotal === 0 ? 'Gratuit (0 FCFA)' : `+${extrasTotal.toLocaleString('fr-FR')} FCFA`
                      }`
                    : 'Aucune option cochée'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUPPLEMENTAL_SERVICES.map((extra) => {
                  const isChecked = selectedExtraIds.includes(extra.id);
                  return (
                    <button
                      key={extra.id}
                      type="button"
                      onClick={() => toggleExtra(extra.id)}
                      aria-pressed={isChecked}
                      className={`text-left px-3 py-2.5 min-h-[44px] rounded-xl border transition-colors flex items-start justify-between gap-2.5 ${
                        isChecked
                          ? 'bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500/30'
                          : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span
                          className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                            isChecked
                              ? 'bg-emerald-700 border-emerald-700 text-white'
                              : 'bg-white border-slate-300'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900">{extra.label}</div>
                          {extra.description && (
                            <div className="text-[11px] text-slate-500 leading-snug">
                              {extra.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-bold tabular-nums shrink-0 ${
                          extra.price === 0 ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {extra.price === 0
                          ? 'Gratuit (0 FCFA)'
                          : `+${extra.price.toLocaleString('fr-FR')} FCFA`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RÉCAPITULATIF LIGNE PAR LIGNE */}
            {selectedQuoteLines.length > 0 ? (
              <div className="bg-white border border-emerald-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="font-bold text-slate-900 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <span>Récapitulatif détaillé du devis</span>
                  <span className="text-[11px] font-semibold text-emerald-700">En temps réel</span>
                </div>

                <div className="space-y-1.5">
                  {selectedQuoteLines.map((line) => (
                    <div
                      key={line.id}
                      className="flex items-center justify-between gap-2 text-[11px] sm:text-xs"
                    >
                      <div className="text-slate-700 min-w-0">
                        <strong className="text-emerald-800 tabular-nums">{line.quantity}×</strong>{' '}
                        <span className="font-medium text-slate-900">{line.label}</span>{' '}
                        <span className="text-slate-500 tabular-nums">
                          ({line.unitPrice.toLocaleString('fr-FR')} FCFA)
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 tabular-nums shrink-0">
                        {line.subtotal.toLocaleString('fr-FR')} FCFA
                      </div>
                    </div>
                  ))}
                </div>

                {selectedExtras.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <div className="text-[11px] font-bold text-slate-700">
                      Services supplémentaires inclus
                    </div>
                    {selectedExtras.map((extra) => (
                      <div
                        key={extra.id}
                        className="flex items-center justify-between gap-2 text-[11px] sm:text-xs"
                      >
                        <span className="text-slate-700">+ {extra.label}</span>
                        <span
                          className={`font-bold tabular-nums shrink-0 ${
                            extra.price === 0 ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {extra.price === 0
                            ? 'Gratuit (0 FCFA)'
                            : `+${extra.price.toLocaleString('fr-FR')} FCFA`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {activePromotion && promoBreakdown && (
                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span>Sous-total avant remise</span>
                      <span className="line-through tabular-nums">
                        {promoBreakdown.originalPrice.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-700 font-semibold">
                      <span className="truncate pr-2">
                        Promotion ({promoBreakdown.offerLineLabel})
                      </span>
                      <span className="tabular-nums shrink-0">
                        -{promoBreakdown.discountAmount.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-extrabold text-emerald-900">
                  <span>Total général</span>
                  <span className="tabular-nums">
                    {targetRecommendedOffer.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-3.5 py-2.5 text-xs text-amber-900 font-medium">
                Choisissez au moins un élément ci-dessus (quantité ≥ 1) pour afficher votre devis détaillé.
              </div>
            )}
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label htmlFor="cfg-material" className="text-xs font-semibold text-slate-700">
                {service.vehicleType ? 'Type / Sellerie' : 'Revêtement / Type'}
              </label>
              <select
                id="cfg-material"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                {service.materials.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="cfg-condition" className="text-xs font-semibold text-slate-700">
                État constaté
              </label>
              <select
                id="cfg-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                <option value="Léger (Entretien régulier)">Léger (Entretien régulier)</option>
                <option value="Moyen (Taches visibles)">Moyen (Taches visibles)</option>
                <option value="Très sale (Boue / Taches tenaces)">Très sale (Boue / Taches tenaces)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="cfg-agents" className="text-xs font-semibold text-slate-700">
                Nombre d&apos;agents souhaité
              </label>
              <select
                id="cfg-agents"
                value={agentsCount}
                onChange={(e) => setAgentsCount(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                <option value={1}>1 Agent</option>
                <option value={2}>2 Agents</option>
                <option value={3}>3 Agents</option>
                <option value={4}>4 Agents (Équipe complète)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="cfg-name" className="text-xs font-semibold text-slate-700">
                Nom du client *
              </label>
              <input
                id="cfg-name"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Votre nom complet"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="cfg-phone" className="text-xs font-semibold text-slate-700">
                Téléphone WhatsApp (Gabon) *
              </label>
              <input
                id="cfg-phone"
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+241 0XX XX XX XX"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="cfg-commune" className="text-xs font-semibold text-slate-700">
                Commune (Grand Libreville)
              </label>
              <select
                id="cfg-commune"
                value={commune}
                onChange={(e) => handleCommuneChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                {COMMUNES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="cfg-quartier" className="text-xs font-semibold text-slate-700">
                  Quartier exact *
                </label>
                <button
                  type="button"
                  onClick={handleDetectMyQuartier}
                  disabled={detectingGps}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
                >
                  <LocateFixed className="w-3 h-3" />
                  <span>{detectingGps ? 'Détection...' : 'Détecter GPS'}</span>
                </button>
              </div>
              <select
                id="cfg-quartier"
                value={selectedQuartier.id}
                onChange={(e) => {
                  setSelectedQuartierId(e.target.value);
                  setDetectedGps(null);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                {communeQuartiers.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="cfg-address" className="text-xs font-semibold text-slate-700">
              Repère / Rue / Immeuble ({selectedQuartier.label}) *
            </label>
            <input
              id="cfg-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={`Ex: Derrière le lycée / Carrefour / Villa n°... (${selectedQuartier.name})`}
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="cfg-offer" className="text-xs font-semibold text-slate-700">
                Votre proposition de tarif (FCFA)
              </label>
              <input
                id="cfg-offer"
                type="number"
                value={clientOfferPrice || ''}
                placeholder="0"
                onChange={(e) => {
                  setHasManualOffer(true);
                  setClientOfferPrice(Number(e.target.value));
                }}
                step={500}
                min={1000}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
              <p className="text-[11px] text-slate-500 tabular-nums">
                Devis calculé :{' '}
                <strong className="text-emerald-800">
                  {targetRecommendedOffer.toLocaleString('fr-FR')} FCFA
                </strong>
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="cfg-payment" className="text-xs font-semibold text-slate-700">
                Moyen de paiement (Gabon)
              </label>
              <select
                id="cfg-payment"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                <option value="Airtel Money">Airtel Money Gabon</option>
                <option value="Moov Money">Moov Money Gabon</option>
                <option value="Espèces">Paiement en espèces</option>
                <option value="Carte bancaire">Carte bancaire</option>
              </select>
            </div>
          </div>

          {selectionError && (
            <div
              role="alert"
              className="bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 text-xs text-rose-800 flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{selectionError}</span>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">
                {activePromotion && promoBreakdown
                  ? 'Total général (remise incluse)'
                  : 'Total général du devis'}
              </div>
              <div className="flex items-baseline gap-2.5">
                {activePromotion && promoBreakdown && (
                  <span className="text-xs text-slate-400 line-through tabular-nums">
                    {promoBreakdown.originalPrice.toLocaleString('fr-FR')} FCFA
                  </span>
                )}
                <div className="text-lg font-bold text-emerald-900 tabular-nums">
                  {rawQuoteTotal > 0
                    ? `${Math.max(
                        1000,
                        Math.round(clientOfferPrice > 0 ? clientOfferPrice : targetRecommendedOffer)
                      ).toLocaleString('fr-FR')} FCFA`
                    : '0 FCFA'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {onAddToCart && (
                <button
                  type="button"
                  onClick={handleAddConfiguredToCart}
                  className={`px-4 py-3 min-h-[44px] font-semibold text-xs rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
                    initialIntent === 'cart'
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-md'
                      : 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900'
                  }`}
                >
                  <ShoppingCart
                    className={`w-4 h-4 ${
                      initialIntent === 'cart' ? 'text-white' : 'text-emerald-700'
                    }`}
                  />
                  <span>Ajouter au panier</span>
                </button>
              )}

              <button
                type="submit"
                className={`px-6 py-3 min-h-[44px] font-semibold text-xs rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
                  initialIntent === 'cart'
                    ? 'bg-slate-900 hover:bg-emerald-700 text-white'
                    : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-md'
                }`}
              >
                <span>Envoyer la commande</span>
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
