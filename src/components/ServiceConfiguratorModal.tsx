import React, { useState } from 'react';
import { Bike, Car, Check, LocateFixed, Tag, X } from 'lucide-react';
import {
  COMMUNES,
  VEHICLE_BRANDS,
  VEHICLE_SEAT_OPTIONS,
  getOptionPrice,
} from '../data/mockData';
import {
  CommuneGrandLibreville,
  DEFAULT_QUARTIER,
  QUARTIERS_BY_COMMUNE,
  QUARTIERS_GRAND_LIBREVILLE,
  matchLocalQuartier,
} from '../data/quartiers';
import { Booking, GpsPoint, PaymentMethod, Promotion, ServiceItem } from '../types';
import { HIGH_ACCURACY_GEO_OPTIONS } from '../utils/geocoding';
import { buildBookingPromoApplied, computeDiscountedPrice } from '../utils/promotions';

interface ServiceConfiguratorModalProps {
  service: ServiceItem;
  ownerUid: string;
  defaultClientName?: string;
  defaultClientPhone?: string;
  appliedPromotion?: Promotion | null;
  onRemovePromotion?: () => void;
  onClose: () => void;
  onSubmitBooking: (booking: Booking) => void;
}

export const ServiceConfiguratorModal: React.FC<ServiceConfiguratorModalProps> = ({
  service,
  ownerUid,
  defaultClientName = '',
  defaultClientPhone = '+241 ',
  appliedPromotion = null,
  onRemovePromotion,
  onClose,
  onSubmitBooking,
}) => {
  const isFourWheelVehicle = service.vehicleType === '4_wheels';
  const isTwoWheelVehicle = service.vehicleType === 'moto' || service.vehicleType === 'velo';

  const [commune, setCommune] = useState(COMMUNES[0].name);
  const [selectedQuartierId, setSelectedQuartierId] = useState(DEFAULT_QUARTIER.id);
  const [detectedGps, setDetectedGps] = useState<GpsPoint | null>(null);
  const [detectingGps, setDetectingGps] = useState(false);
  const [address, setAddress] = useState('');
  const [clientName, setClientName] = useState(defaultClientName);
  const [clientPhone, setClientPhone] = useState(defaultClientPhone);
  const [material, setMaterial] = useState(service.materials[0] || '');
  const [condition, setCondition] = useState('Moyen (Taches visibles)');
  const [selectedOptions, setSelectedOptions] = useState<string[]>(
    service.availableOptions[0] ? [service.availableOptions[0]] : []
  );
  const [agentsCount, setAgentsCount] = useState(
    isTwoWheelVehicle ? 1 : service.category === 'BTP' ? 4 : 2
  );

  const [vehicleBrand, setVehicleBrand] = useState('Toyota');
  const [customBrand, setCustomBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleSeats, setVehicleSeats] = useState<number>(5);
  const [promoRemoved, setPromoRemoved] = useState(false);
  const [hasManualOffer, setHasManualOffer] = useState(false);

  const activePromotion = !promoRemoved ? appliedPromotion : null;

  const seatPriceDelta = (seats: number) => (seats >= 7 ? 7000 : seats === 2 ? -2000 : 0);
  const baseAdjustedPrice = isFourWheelVehicle
    ? service.basePrice + seatPriceDelta(vehicleSeats)
    : service.basePrice;

  const optionsTotal = selectedOptions.reduce((sum, opt) => sum + getOptionPrice(opt), 0);
  const recommendedPrice = baseAdjustedPrice + optionsTotal;
  const promoBreakdown = activePromotion
    ? computeDiscountedPrice(recommendedPrice, activePromotion)
    : null;
  const targetRecommendedOffer = promoBreakdown ? promoBreakdown.finalPrice : recommendedPrice;

  const [clientOfferPrice, setClientOfferPrice] = useState(() => {
    const initialOptionPrice = service.availableOptions[0]
      ? getOptionPrice(service.availableOptions[0])
      : 0;
    const initialRaw = service.basePrice + initialOptionPrice;
    return activePromotion
      ? computeDiscountedPrice(initialRaw, activePromotion).finalPrice
      : initialRaw;
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Airtel Money');

  const computeRecommendedFor = (seats: number, options: string[], promo: Promotion | null) => {
    const nextBase = isFourWheelVehicle
      ? service.basePrice + seatPriceDelta(seats)
      : service.basePrice;
    const nextOpts = options.reduce((sum, opt) => sum + getOptionPrice(opt), 0);
    const nextRaw = nextBase + nextOpts;
    return promo ? computeDiscountedPrice(nextRaw, promo).finalPrice : nextRaw;
  };

  const handleSeatsChange = (seats: number) => {
    const prevDelta = seatPriceDelta(vehicleSeats);
    const nextDelta = seatPriceDelta(seats);
    setVehicleSeats(seats);
    if (!hasManualOffer) {
      setClientOfferPrice(computeRecommendedFor(seats, selectedOptions, activePromotion));
    } else {
      setClientOfferPrice((prev) => Math.max(1000, prev - prevDelta + nextDelta));
    }
  };

  const toggleOption = (opt: string) => {
    const optionPrice = getOptionPrice(opt);
    const exists = selectedOptions.includes(opt);
    const nextOptions = exists
      ? selectedOptions.filter((item) => item !== opt)
      : [...selectedOptions, opt];
    setSelectedOptions(nextOptions);
    if (!hasManualOffer) {
      setClientOfferPrice(computeRecommendedFor(vehicleSeats, nextOptions, activePromotion));
    } else {
      setClientOfferPrice((prev) =>
        Math.max(1000, exists ? prev - optionPrice : prev + optionPrice)
      );
    }
  };

  const handleRemovePromo = () => {
    setPromoRemoved(true);
    setHasManualOffer(false);
    setClientOfferPrice(recommendedPrice);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedBrand =
      vehicleBrand === 'Autre marque' ? customBrand.trim() || 'Autre' : vehicleBrand;

    let fullServiceName = `${service.name} (${material})`;
    if (isFourWheelVehicle) {
      const modelSuffix = vehicleModel.trim() ? ` ${vehicleModel.trim()}` : '';
      fullServiceName = `Véhicule 4 roues — ${resolvedBrand}${modelSuffix} (${vehicleSeats} places)`;
    } else if (isTwoWheelVehicle) {
      const modelSuffix = vehicleModel.trim() ? ` — ${vehicleModel.trim()}` : '';
      fullServiceName = `${service.name}${modelSuffix}`;
    }

    const formattedOptions = selectedOptions.map((opt) => {
      const optPrice = getOptionPrice(opt);
      return optPrice === 0
        ? `${opt} (Gratuit · 0 XAF)`
        : `${opt} (+${optPrice.toLocaleString()} XAF)`;
    });

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

    const finalSubmittedOffer = Math.max(1000, Math.round(clientOfferPrice));
    const nowIso = new Date().toISOString();
    const newBooking: Booking = {
      id: `SHINE-${Math.floor(1000 + Math.random() * 9000)}`,
      ownerUid,
      ...(ownerUid ? { userId: ownerUid } : {}),
      serviceId: service.id,
      serviceName: fullServiceName,
      serviceCategory: service.category,
      ...(service.vehicleType ? { vehicleType: service.vehicleType } : {}),
      clientName: clientName.trim() || defaultClientName,
      clientPhone: clientPhone.trim() || defaultClientPhone,
      commune: selectedQuartier.commune as CommuneGrandLibreville,
      address: formattedAddress,
      clientCoords,
      clientGpsActive: Boolean(detectedGps),
      details: {
        material,
        condition,
        stains: isFourWheelVehicle
          ? ['Boue / Poussière', 'Habitacle']
          : service.category === 'BTP'
          ? ['Poussière ciment', 'Traces peinture']
          : ['Taches courantes'],
        options: formattedOptions,
        agentsCount,
        ...(isFourWheelVehicle
          ? {
              vehicleBrand: resolvedBrand,
              ...(vehicleModel.trim() ? { vehicleModel: vehicleModel.trim() } : {}),
              vehicleSeats,
            }
          : isTwoWheelVehicle && vehicleModel.trim()
          ? { vehicleModel: vehicleModel.trim() }
          : {}),
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
      beforePhotos: [service.image],
      afterPhotos: [],
      createdAt: "À l'instant",
      updatedAt: nowIso,
      paymentMethod,
    };

    onSubmitBooking(newBooking);
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

        {activePromotion && promoBreakdown && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-emerald-950">
              <Tag className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">
                  Promotion appliquée : {promoBreakdown.shortLabel} · {activePromotion.title}
                </div>
                <div className="text-[11px] text-emerald-800">
                  Offre {activePromotion.companyName} — Réduction calculée automatiquement sur votre total.
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {isFourWheelVehicle && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                <Car className="w-4 h-4 text-emerald-700" />
                <span>Caractéristiques obligatoires du véhicule à 4 roues</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label htmlFor="veh-brand" className="text-xs font-semibold text-slate-700">
                    Marque du véhicule *
                  </label>
                  <select
                    id="veh-brand"
                    value={vehicleBrand}
                    onChange={(e) => setVehicleBrand(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  >
                    {VEHICLE_BRANDS.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                </div>

                {vehicleBrand === 'Autre marque' ? (
                  <div className="space-y-1">
                    <label htmlFor="veh-custom-brand" className="text-xs font-semibold text-slate-700">
                      Précisez la marque *
                    </label>
                    <input
                      id="veh-custom-brand"
                      type="text"
                      value={customBrand}
                      onChange={(e) => setCustomBrand(e.target.value)}
                      placeholder="Ex: Isuzu, Chery..."
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label htmlFor="veh-model" className="text-xs font-semibold text-slate-700">
                      Modèle (optionnel)
                    </label>
                    <input
                      id="veh-model"
                      type="text"
                      value={vehicleModel}
                      onChange={(e) => setVehicleModel(e.target.value)}
                      placeholder="Ex: Rav4, Prado, Tucson..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label htmlFor="veh-seats" className="text-xs font-semibold text-slate-700">
                    Nombre de places *
                  </label>
                  <select
                    id="veh-seats"
                    value={vehicleSeats}
                    onChange={(e) => handleSeatsChange(Number(e.target.value))}
                    required
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  >
                    {VEHICLE_SEAT_OPTIONS.map((seats) => (
                      <option key={seats} value={seats}>
                        {seats} places {seats >= 7 ? '(Grand gabarit / SUV 7+)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {isTwoWheelVehicle && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                <Bike className="w-4 h-4 text-emerald-700" />
                <span>
                  Détails ({service.vehicleType === 'moto' ? 'Moto / Scooter' : 'Vélo'})
                </span>
              </div>
              <div className="space-y-1">
                <label htmlFor="two-wheel-model" className="text-xs font-semibold text-slate-700">
                  Marque / Modèle (optionnel)
                </label>
                <input
                  id="two-wheel-model"
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder={
                    service.vehicleType === 'moto'
                      ? 'Ex: Yamaha MT-07, Haojue, Vespa...'
                      : 'Ex: VTT Canyon, Vélo électrique...'
                  }
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="cfg-name" className="text-xs font-semibold text-slate-700">
                Nom du client
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
                Téléphone WhatsApp (Gabon)
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
              Repère / Rue / Immeuble ({selectedQuartier.label})
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label htmlFor="cfg-material" className="text-xs font-semibold text-slate-700">
                {service.vehicleType ? 'Formule / Revêtement' : 'Type / Revêtement'}
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
                Nombre d'agents souhaité
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

          {service.availableOptions.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">Options de traitement</span>
                <span className="text-[11px] font-medium text-emerald-800 tabular-nums">
                  Supplément options : +{optionsTotal.toLocaleString()} XAF
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {service.availableOptions.map((opt) => {
                  const active = selectedOptions.includes(opt);
                  const optPrice = getOptionPrice(opt);
                  const priceLabel =
                    optPrice === 0
                      ? 'Gratuit (0 XAF)'
                      : `+${optPrice.toLocaleString()} XAF`;
                  return (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => toggleOption(opt)}
                      className={`px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-medium border transition-colors flex items-center justify-between gap-2 text-left ${
                        active
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-semibold">{opt}</span>
                      <span
                        className={`text-[11px] font-bold tabular-nums whitespace-nowrap shrink-0 ${
                          active
                            ? 'text-emerald-100'
                            : optPrice === 0
                            ? 'text-emerald-700'
                            : 'text-slate-900'
                        }`}
                      >
                        {priceLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="cfg-offer" className="text-xs font-semibold text-slate-700">
                Votre proposition de tarif (FCFA / XAF)
              </label>
              <input
                id="cfg-offer"
                type="number"
                value={clientOfferPrice}
                onChange={(e) => {
                  setHasManualOffer(true);
                  setClientOfferPrice(Number(e.target.value));
                }}
                step={500}
                min={1000}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
              <p className="text-[11px] text-slate-500 tabular-nums">
                Référence : {baseAdjustedPrice.toLocaleString('fr-FR')} FCFA (base) +{' '}
                {optionsTotal.toLocaleString('fr-FR')} FCFA (options) ={' '}
                <strong className="text-slate-800">
                  {recommendedPrice.toLocaleString('fr-FR')} FCFA
                </strong>
                {activePromotion && promoBreakdown && (
                  <>
                    {' '}
                    → Promo :{' '}
                    <strong className="text-emerald-800">
                      {targetRecommendedOffer.toLocaleString('fr-FR')} FCFA
                    </strong>
                  </>
                )}
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

          {activePromotion && promoBreakdown && (
            <div className="bg-slate-50 border border-emerald-200 rounded-xl p-4 space-y-2 text-xs">
              <div className="font-bold text-slate-900 flex items-center justify-between gap-2">
                <span>Récapitulatif de prix avec promotion</span>
                <button
                  type="button"
                  onClick={handleRemovePromo}
                  className="text-[11px] font-semibold text-rose-700 hover:text-rose-800 underline"
                >
                  Retirer la promotion
                </button>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>Prix initial</span>
                <span className="line-through tabular-nums">
                  {promoBreakdown.originalPrice.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              <div className="flex items-center justify-between text-emerald-700 font-semibold">
                <span>
                  Promotion &quot;{promoBreakdown.offerLineLabel}&quot;
                </span>
                <span className="tabular-nums">
                  -{promoBreakdown.discountAmount.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-sm font-extrabold text-emerald-900">
                <span>Total à payer</span>
                <span className="tabular-nums">
                  {Math.max(1000, Math.round(clientOfferPrice)).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">
                {activePromotion && promoBreakdown
                  ? 'Total à payer (remise incluse)'
                  : 'Montant proposé au gérant'}
              </div>
              <div className="flex items-baseline gap-2.5">
                {activePromotion && promoBreakdown && (
                  <span className="text-xs text-slate-400 line-through tabular-nums">
                    {promoBreakdown.originalPrice.toLocaleString('fr-FR')} FCFA
                  </span>
                )}
                <div className="text-lg font-bold text-emerald-900 tabular-nums">
                  {Math.max(1000, Math.round(clientOfferPrice)).toLocaleString('fr-FR')} FCFA
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-3 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-md transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <span>Envoyer la commande</span>
              <Check className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
