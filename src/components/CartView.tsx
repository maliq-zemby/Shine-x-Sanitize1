import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Loader2,
  LocateFixed,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Trash2,
} from 'lucide-react';
import { COMMUNES } from '../data/mockData';
import {
  CommuneGrandLibreville,
  DEFAULT_QUARTIER,
  QUARTIERS_BY_COMMUNE,
  QUARTIERS_GRAND_LIBREVILLE,
  matchLocalQuartier,
} from '../data/quartiers';
import {
  Booking,
  CartItem,
  GpsPoint,
  PaymentMethod,
  Promotion,
  ServiceItem,
} from '../types';
import {
  buildCartServiceSummary,
  computeCartPricing,
  doesPromotionMatchCartItem,
  serializeCartItems,
} from '../utils/bookingItems';
import { HIGH_ACCURACY_GEO_OPTIONS } from '../utils/geocoding';
import { parsePromotionDiscount } from '../utils/promotions';

interface CartViewProps {
  items: CartItem[];
  catalogServices: ServiceItem[];
  availablePromotions: Promotion[];
  selectedCartPromotion: Promotion | null;
  ownerUid: string;
  defaultClientName?: string;
  defaultClientPhone?: string;
  isSubmitting?: boolean;
  submitError?: string;
  onSelectCartPromotion: (promo: Promotion | null) => void;
  onUpdateQuantity: (cartItemId: string, nextQuantity: number) => void;
  onRemoveItem: (cartItemId: string) => void;
  onClearCart: () => void;
  onOpenCatalog: () => void;
  onSubmitCartOrder: (booking: Booking) => Promise<void> | void;
}

export const CartView: React.FC<CartViewProps> = ({
  items,
  catalogServices,
  availablePromotions,
  selectedCartPromotion,
  ownerUid,
  defaultClientName = '',
  defaultClientPhone = '+241 ',
  isSubmitting = false,
  submitError = '',
  onSelectCartPromotion,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOpenCatalog,
  onSubmitCartOrder,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [clientName, setClientName] = useState(defaultClientName);
  const [clientPhone, setClientPhone] = useState(defaultClientPhone);
  const [commune, setCommune] = useState(COMMUNES[0].name);
  const [selectedQuartierId, setSelectedQuartierId] = useState(DEFAULT_QUARTIER.id);
  const [address, setAddress] = useState('');
  const [detectedGps, setDetectedGps] = useState<GpsPoint | null>(null);
  const [detectingGps, setDetectingGps] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Airtel Money');
  const [hasManualOffer, setHasManualOffer] = useState(false);

  const pricing = computeCartPricing(items, selectedCartPromotion, catalogServices);
  const [clientOfferPrice, setClientOfferPrice] = useState<number>(pricing.finalTotal || 1000);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (defaultClientName && !clientName.trim()) {
      setClientName(defaultClientName);
    }
  }, [defaultClientName, clientName]);

  useEffect(() => {
    if (defaultClientPhone && (clientPhone === '+241 ' || !clientPhone.trim())) {
      setClientPhone(defaultClientPhone);
    }
  }, [defaultClientPhone, clientPhone]);

  useEffect(() => {
    if (!hasManualOffer && pricing.finalTotal > 0) {
      setClientOfferPrice(pricing.finalTotal);
    }
  }, [pricing.finalTotal, hasManualOffer]);

  useEffect(() => {
    if (items.length === 0) {
      setConfirmClear(false);
      setHasManualOffer(false);
    }
  }, [items.length]);

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

  const handleRemovePromo = () => {
    onSelectCartPromotion(null);
    setHasManualOffer(false);
  };

  const handleApplyPromo = (promo: Promotion) => {
    onSelectCartPromotion(promo);
    setHasManualOffer(false);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (items.length === 0) {
      setLocalError('Votre panier est vide.');
      return;
    }

    const trimmedName = clientName.trim() || defaultClientName.trim();
    const trimmedPhone = clientPhone.trim() || defaultClientPhone.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName) {
      setLocalError('Veuillez saisir votre nom complet.');
      return;
    }
    if (trimmedPhone.length < 6) {
      setLocalError('Veuillez saisir un numéro de téléphone WhatsApp valide.');
      return;
    }
    if (!trimmedAddress) {
      setLocalError('Veuillez préciser votre repère, rue ou immeuble.');
      return;
    }

    const serializedItems = serializeCartItems(items);
    const serviceSummary = buildCartServiceSummary(serializedItems);
    const uniqueCategories = Array.from(new Set(serializedItems.map((it) => it.serviceCategory)));
    const resolvedCategory: Booking['serviceCategory'] =
      uniqueCategories.length === 1 ? uniqueCategories[0] : 'Multi-services';

    const uniqueMaterials = Array.from(
      new Set(serializedItems.map((it) => it.material).filter((m): m is string => Boolean(m)))
    );
    const uniqueConditions = Array.from(
      new Set(serializedItems.map((it) => it.condition).filter((c): c is string => Boolean(c)))
    );
    const combinedOptions = serializedItems.flatMap((it) =>
      (it.options || []).map((opt) =>
        serializedItems.length > 1 ? `${it.serviceName} : ${opt}` : opt
      )
    );
    const maxAgents = Math.max(
      1,
      ...serializedItems.map((it) => it.agentsCount || (it.serviceCategory === 'BTP' ? 4 : 2))
    );
    const vehicleItem = serializedItems.find((it) => Boolean(it.vehicleBrand));
    const uniqueImages = Array.from(
      new Set(serializedItems.map((it) => it.image).filter((img): img is string => Boolean(img)))
    ).slice(0, 5);

    const formattedAddress = `${selectedQuartier.name} — ${trimmedAddress}`.slice(0, 240);
    const clientCoords: GpsPoint = detectedGps
      ? detectedGps
      : {
          lat: selectedQuartier.lat,
          lng: selectedQuartier.lng,
          neighborhood: selectedQuartier.label,
        };

    const finalOffer = Math.max(1000, Math.round(clientOfferPrice || pricing.finalTotal || 1000));
    const nowIso = new Date().toISOString();

    const newBooking: Booking = {
      id: `SHINE-${Math.floor(1000 + Math.random() * 9000)}`,
      ownerUid,
      ...(ownerUid ? { userId: ownerUid, clientId: ownerUid } : {}),
      serviceId: serializedItems.length === 1 ? serializedItems[0].serviceId : 'cart-multi',
      serviceName: serviceSummary,
      serviceCategory: resolvedCategory,
      ...(serializedItems.length === 1 && serializedItems[0].vehicleType
        ? { vehicleType: serializedItems[0].vehicleType }
        : {}),
      items: serializedItems,
      clientName: trimmedName,
      clientPhone: trimmedPhone,
      commune: selectedQuartier.commune as CommuneGrandLibreville,
      address: formattedAddress,
      clientCoords,
      clientGpsActive: Boolean(detectedGps),
      details: {
        material:
          uniqueMaterials.length > 0
            ? uniqueMaterials.join(' · ').slice(0, 120)
            : 'Prestations multiples',
        condition:
          uniqueConditions.length > 0
            ? uniqueConditions.join(' · ').slice(0, 120)
            : 'Standard',
        stains: ['Prestations multiples du panier'],
        options: combinedOptions.slice(0, 12),
        agentsCount: maxAgents,
        ...(vehicleItem?.vehicleBrand
          ? {
              vehicleBrand: vehicleItem.vehicleBrand,
              ...(vehicleItem.vehicleModel ? { vehicleModel: vehicleItem.vehicleModel } : {}),
              ...(typeof vehicleItem.vehicleSeats === 'number'
                ? { vehicleSeats: vehicleItem.vehicleSeats }
                : {}),
            }
          : {}),
        cartItems: serializedItems,
      },
      clientOfferPrice: finalOffer,
      ...(pricing.promoApplied ? { promoApplied: pricing.promoApplied } : {}),
      finalPrice: finalOffer,
      status: 'pending_negotiation',
      assignedAgents: [],
      assignedAgentIds: [],
      gpsActive: false,
      beforePhotos: uniqueImages,
      afterPhotos: [],
      createdAt: "À l'instant",
      updatedAt: nowIso,
      paymentMethod,
    };

    await onSubmitCartOrder(newBooking);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <ShoppingCart className="w-6 h-6 text-emerald-700 shrink-0" />
            <span>Mon Panier</span>
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Regroupez plusieurs prestations (maison, BTP, véhicules) et validez-les en une seule commande suivie en temps réel.
          </p>
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenCatalog}
              className="px-4 py-2 min-h-[40px] bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-700" />
              <span>Ajouter d&apos;autres services</span>
            </button>

            {confirmClear ? (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onClearCart();
                    setConfirmClear(false);
                  }}
                  className="px-3.5 py-2 min-h-[40px] bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap"
                >
                  Confirmer le vidage
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-2 min-h-[40px] text-xs font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="px-3.5 py-2 min-h-[40px] bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vider le panier</span>
              </button>
            )}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-base font-bold text-slate-900">Votre panier est vide</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Parcourez nos services (canapés, matelas, tapis, bureaux, nettoyage BTP, véhicules) et cliquez sur « Ajouter au panier » pour préparer votre commande groupée.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCatalog}
            className="px-5 py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl transition-colors inline-flex items-center gap-2"
          >
            <span>Découvrir le catalogue des services</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Cart Items + Promotions */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600 px-1">
              <span>
                <strong className="text-slate-900 tabular-nums">{items.length}</strong> ligne
                {items.length > 1 ? 's' : ''} de service ·{' '}
                <strong className="text-slate-900 tabular-nums">{pricing.totalUnits}</strong>{' '}
                prestation{pricing.totalUnits > 1 ? 's' : ''} au total
              </span>
              <span className="font-semibold text-emerald-800 tabular-nums">
                Sous-total : {pricing.rawSubtotal.toLocaleString('fr-FR')} XAF
              </span>
            </div>

            {items.map((item) => {
              const lineTotal = item.unitPrice * item.quantity;
              const promoMatchesItem = pricing.activePromotion
                ? doesPromotionMatchCartItem(pricing.activePromotion, item, catalogServices)
                : false;

              return (
                <div
                  key={item.cartItemId}
                  className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row gap-4 justify-between"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.serviceName}
                        className="w-20 h-20 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl border border-slate-200 bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                    )}

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-semibold text-emerald-800">
                          {item.serviceCategory}
                        </span>
                        {item.duration && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{item.duration}</span>
                          </>
                        )}
                        {promoMatchesItem && pricing.activePromotion && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold">
                            <Tag className="w-3 h-3" />
                            <span>{parsePromotionDiscount(pricing.activePromotion).shortLabel}</span>
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        {item.serviceName}
                      </h3>

                      <div className="text-xs text-slate-600 space-y-0.5">
                        {item.material && (
                          <div>
                            Matériau / Formule :{' '}
                            <strong className="text-slate-800">{item.material}</strong>
                          </div>
                        )}
                        {item.condition && (
                          <div>
                            État : <strong className="text-slate-800">{item.condition}</strong>
                          </div>
                        )}
                        {item.vehicleBrand && (
                          <div className="text-emerald-800 font-medium">
                            Véhicule : {item.vehicleBrand}
                            {item.vehicleModel ? ` ${item.vehicleModel}` : ''} ·{' '}
                            {item.vehicleSeats || 5} places
                          </div>
                        )}
                        {item.options && item.options.length > 0 && (
                          <div className="text-slate-500">
                            Options : {item.options.join(', ')}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 tabular-nums pt-0.5">
                          Tarif unitaire : {item.unitPrice.toLocaleString('fr-FR')} XAF
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0 border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500">Total ligne</div>
                      <div className="text-base font-bold text-emerald-900 tabular-nums">
                        {lineTotal.toLocaleString('fr-FR')} XAF
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center border border-slate-200 rounded-xl bg-slate-50 p-0.5">
                        <button
                          type="button"
                          aria-label={`Diminuer la quantité pour ${item.serviceName}`}
                          disabled={item.quantity <= 1 || isSubmitting}
                          onClick={() => onUpdateQuantity(item.cartItemId, item.quantity - 1)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:bg-white disabled:opacity-40 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold text-slate-900 tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Augmenter la quantité pour ${item.serviceName}`}
                          disabled={item.quantity >= 20 || isSubmitting}
                          onClick={() => onUpdateQuantity(item.cartItemId, item.quantity + 1)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-700 hover:bg-white disabled:opacity-40 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => onRemoveItem(item.cartItemId)}
                        aria-label={`Supprimer ${item.serviceName} du panier`}
                        className="w-10 h-10 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center justify-center transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Promotion Management Card inside Cart */}
            {pricing.activePromotion && pricing.promoApplied ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 text-xs text-emerald-950">
                  <Tag className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="font-bold">
                      Offre appliquée : {pricing.promoApplied.discountLabel} ·{' '}
                      {pricing.promoApplied.title}
                    </div>
                    <div className="text-[11px] text-emerald-800 tabular-nums">
                      Remise calculée : -{pricing.discountAmount.toLocaleString('fr-FR')} XAF sur
                      votre panier.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleRemovePromo}
                  className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-semibold transition-colors"
                >
                  Retirer la promotion
                </button>
              </div>
            ) : (
              availablePromotions.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <Tag className="w-4 h-4 text-emerald-700" />
                    <span>Appliquer une promotion en cours</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {availablePromotions.map((promo) => {
                      const matchesCart = items.some((it) =>
                        doesPromotionMatchCartItem(promo, it, catalogServices)
                      );
                      return (
                        <button
                          key={promo.id}
                          type="button"
                          onClick={() => handleApplyPromo(promo)}
                          className={`text-left p-3 rounded-xl border transition-colors flex items-center justify-between gap-2 ${
                            matchesCart
                              ? 'border-emerald-300 bg-emerald-50/70 hover:bg-emerald-50'
                              : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-emerald-800 truncate">
                              {parsePromotionDiscount(promo).shortLabel} · {promo.title}
                            </div>
                            <div className="text-[11px] text-slate-600 truncate">
                              {promo.companyName}
                              {matchesCart ? ' · Compatible avec votre panier' : ''}
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-700 shrink-0">
                            Appliquer
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Right Column: Unified Single-Order Checkout Form */}
          <form
            onSubmit={handleCheckoutSubmit}
            className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4 lg:sticky lg:top-24"
          >
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Validation en une commande unique
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Renseignez vos coordonnées et votre localisation pour envoyer tous les services du panier en une seule commande.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="cart-client-name" className="text-xs font-semibold text-slate-700">
                  Nom complet *
                </label>
                <input
                  id="cart-client-name"
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Votre nom complet"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="cart-client-phone" className="text-xs font-semibold text-slate-700">
                  Téléphone WhatsApp *
                </label>
                <input
                  id="cart-client-phone"
                  type="tel"
                  required
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+241 0XX XX XX XX"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="cart-commune" className="text-xs font-semibold text-slate-700">
                  Commune *
                </label>
                <select
                  id="cart-commune"
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
                  <label htmlFor="cart-quartier" className="text-xs font-semibold text-slate-700">
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
                  id="cart-quartier"
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
              <label htmlFor="cart-address" className="text-xs font-semibold text-slate-700">
                Repère / Rue / Immeuble ({selectedQuartier.label}) *
              </label>
              <input
                id="cart-address"
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={`Ex: Derrière le lycée / Carrefour / Villa n°...`}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="cart-offer" className="text-xs font-semibold text-slate-700">
                  Proposition totale (XAF)
                </label>
                <input
                  id="cart-offer"
                  type="number"
                  min={1000}
                  step={500}
                  value={clientOfferPrice}
                  onChange={(e) => {
                    setHasManualOffer(true);
                    setClientOfferPrice(Number(e.target.value));
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="cart-payment" className="text-xs font-semibold text-slate-700">
                  Moyen de paiement
                </label>
                <select
                  id="cart-payment"
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

            {/* Pricing Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Prestations sélectionnées ({pricing.totalUnits})</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {pricing.rawSubtotal.toLocaleString('fr-FR')} XAF
                </span>
              </div>

              {pricing.promoApplied && pricing.discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-700 font-semibold">
                  <span className="truncate pr-2">
                    Promo ({pricing.promoApplied.discountLabel || pricing.promoApplied.title})
                  </span>
                  <span className="tabular-nums shrink-0">
                    -{pricing.discountAmount.toLocaleString('fr-FR')} XAF
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-sm font-extrabold text-emerald-900">
                <span>Montant total de la commande</span>
                <span className="tabular-nums">
                  {Math.max(1000, Math.round(clientOfferPrice || pricing.finalTotal)).toLocaleString(
                    'fr-FR'
                  )}{' '}
                  XAF
                </span>
              </div>
            </div>

            {(localError || submitError) && (
              <div
                role="alert"
                className="bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 text-xs text-rose-800 flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{localError || submitError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-semibold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement de la commande...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Valider le panier et envoyer la commande</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
