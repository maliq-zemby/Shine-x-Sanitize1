import React, { useState } from 'react';
import { Bike, Car, Check, X } from 'lucide-react';
import {
  COMMUNES,
  VEHICLE_BRANDS,
  VEHICLE_SEAT_OPTIONS,
  getOptionPrice,
} from '../data/mockData';
import { Booking, PaymentMethod, ServiceItem } from '../types';

interface ServiceConfiguratorModalProps {
  service: ServiceItem;
  ownerUid: string;
  defaultClientName?: string;
  defaultClientPhone?: string;
  onClose: () => void;
  onSubmitBooking: (booking: Booking) => void;
}

export const ServiceConfiguratorModal: React.FC<ServiceConfiguratorModalProps> = ({
  service,
  ownerUid,
  defaultClientName = '',
  defaultClientPhone = '+241 ',
  onClose,
  onSubmitBooking,
}) => {
  const isFourWheelVehicle = service.vehicleType === '4_wheels';
  const isTwoWheelVehicle = service.vehicleType === 'moto' || service.vehicleType === 'velo';

  const [commune, setCommune] = useState(COMMUNES[0].name);
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

  const seatPriceDelta = (seats: number) => (seats >= 7 ? 7000 : seats === 2 ? -2000 : 0);
  const baseAdjustedPrice = isFourWheelVehicle
    ? service.basePrice + seatPriceDelta(vehicleSeats)
    : service.basePrice;

  const optionsTotal = selectedOptions.reduce((sum, opt) => sum + getOptionPrice(opt), 0);
  const recommendedPrice = baseAdjustedPrice + optionsTotal;

  const [clientOfferPrice, setClientOfferPrice] = useState(() => {
    const initialOptionPrice = service.availableOptions[0]
      ? getOptionPrice(service.availableOptions[0])
      : 0;
    return service.basePrice + initialOptionPrice;
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Airtel Money');

  const handleSeatsChange = (seats: number) => {
    const prevDelta = seatPriceDelta(vehicleSeats);
    const nextDelta = seatPriceDelta(seats);
    setVehicleSeats(seats);
    setClientOfferPrice((prev) => Math.max(2000, prev - prevDelta + nextDelta));
  };

  const toggleOption = (opt: string) => {
    const optionPrice = getOptionPrice(opt);
    const exists = selectedOptions.includes(opt);
    setSelectedOptions((prev) =>
      exists ? prev.filter((item) => item !== opt) : [...prev, opt]
    );
    setClientOfferPrice((prev) =>
      Math.max(2000, exists ? prev - optionPrice : prev + optionPrice)
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedBrand =
      vehicleBrand === 'Autre marque' ? customBrand.trim() || 'Autre' : vehicleBrand;
    const communeObj = COMMUNES.find((c) => c.name === commune) || COMMUNES[0];

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

    const nowIso = new Date().toISOString();
    const newBooking: Booking = {
      id: `SHINE-${Math.floor(1000 + Math.random() * 9000)}`,
      ownerUid,
      serviceId: service.id,
      serviceName: fullServiceName,
      serviceCategory: service.category,
      ...(service.vehicleType ? { vehicleType: service.vehicleType } : {}),
      clientName: clientName.trim() || defaultClientName,
      clientPhone: clientPhone.trim() || defaultClientPhone,
      commune,
      address,
      clientCoords: {
        lat: communeObj.coords.lat + (Math.random() - 0.5) * 0.015,
        lng: communeObj.coords.lng + (Math.random() - 0.5) * 0.015,
      },
      clientGpsActive: false,
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
      clientOfferPrice,
      finalPrice: clientOfferPrice,
      status: 'pending_negotiation',
      assignedAgents: [],
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
                onChange={(e) => setCommune(e.target.value)}
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
              <label htmlFor="cfg-address" className="text-xs font-semibold text-slate-700">
                Adresse précise / Quartier
              </label>
              <input
                id="cfg-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Quartier Louis, Batterie IV, Ambowè..."
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
            </div>
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
                Votre proposition de tarif (XAF)
              </label>
              <input
                id="cfg-offer"
                type="number"
                value={clientOfferPrice}
                onChange={(e) => setClientOfferPrice(Number(e.target.value))}
                step={1000}
                min={2000}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
              <p className="text-[11px] text-slate-500 tabular-nums">
                Référence : {baseAdjustedPrice.toLocaleString()} XAF (base) + {optionsTotal.toLocaleString()} XAF (options) ={' '}
                <strong className="text-slate-800">{recommendedPrice.toLocaleString()} XAF</strong>
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

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">Montant proposé au gérant</div>
              <div className="text-lg font-bold text-slate-900 tabular-nums">
                {clientOfferPrice.toLocaleString()} XAF
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
