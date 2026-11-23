import React from 'react';
import { ArrowRight, Bike, Car, ShoppingCart, Tag, X } from 'lucide-react';
import { Promotion, ServiceItem, VehicleCategory } from '../types';
import { parsePromotionDiscount } from '../utils/promotions';

interface VehicleMobilityModalProps {
  vehicleServices: ServiceItem[];
  appliedPromotion?: Promotion | null;
  onClearPromotion?: () => void;
  onSelectVehicleService: (service: ServiceItem) => void;
  onQuickAddVehicleToCart?: (service: ServiceItem) => void;
  onClose: () => void;
}

const SUB_LABELS: Record<VehicleCategory, { title: string; badge: string }> = {
  velo: {
    title: 'Un vélo',
    badge: 'VTT · Route · Électrique',
  },
  moto: {
    title: 'Une moto',
    badge: 'Moto · Scooter · Quad',
  },
  '4_wheels': {
    title: 'Un véhicule à 4 roues',
    badge: 'Voiture · SUV · 4x4 (Marque & Places)',
  },
};

export const VehicleMobilityModal: React.FC<VehicleMobilityModalProps> = ({
  vehicleServices,
  appliedPromotion = null,
  onClearPromotion,
  onSelectVehicleService,
  onQuickAddVehicleToCart,
  onClose,
}) => {
  const orderedTypes: VehicleCategory[] = ['velo', 'moto', '4_wheels'];
  const orderedServices = orderedTypes
    .map((vt) => vehicleServices.find((s) => s.vehicleType === vt))
    .filter((s): s is ServiceItem => Boolean(s));
  const parsedPromo = appliedPromotion ? parsePromotionDiscount(appliedPromotion) : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 relative my-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-5 right-5 w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="pr-10">
          <div className="text-xs font-semibold text-emerald-700">
            Catégorie Unifiée · Shine-x-Sanitize Alp Group
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">
            Véhicules & Mobilité
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Choisissez précisément le type de véhicule à nettoyer à Libreville pour accéder au configurateur dédié ou l&apos;ajouter au panier.
          </p>
        </div>

        {appliedPromotion && parsedPromo && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-emerald-950">
              <Tag className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                Offre active : <strong>{parsedPromo.shortLabel}</strong> — {appliedPromotion.title} (appliquée automatiquement après sélection).
              </span>
            </div>
            {onClearPromotion && (
              <button
                type="button"
                onClick={onClearPromotion}
                className="text-[11px] font-semibold text-rose-700 hover:text-rose-800 underline"
              >
                Retirer l&apos;offre
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {orderedServices.map((srv) => {
            const meta = srv.vehicleType ? SUB_LABELS[srv.vehicleType] : null;
            return (
              <div
                key={srv.id}
                className="group bg-white hover:border-emerald-700 border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all flex flex-col justify-between"
              >
                <button
                  type="button"
                  onClick={() => onSelectVehicleService(srv)}
                  className="text-left focus:outline-none focus:ring-2 focus:ring-emerald-700"
                >
                  <div className="h-44 overflow-hidden bg-slate-100">
                    <img
                      src={srv.image}
                      alt={meta?.title || srv.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="p-4 space-y-1.5">
                    <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5">
                      {srv.vehicleType === '4_wheels' ? (
                        <Car className="w-3.5 h-3.5" />
                      ) : (
                        <Bike className="w-3.5 h-3.5" />
                      )}
                      <span>{meta?.badge}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {meta?.title || srv.name}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-2">{srv.description}</p>
                  </div>
                </button>

                <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-2">
                  <button
                    type="button"
                    onClick={() => onSelectVehicleService(srv)}
                    className="w-full flex items-center justify-between text-xs font-bold text-slate-900 py-1.5"
                  >
                    <span className="tabular-nums text-emerald-800">
                      Dès {srv.basePrice.toLocaleString()} XAF
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 group-hover:translate-x-0.5 transition-transform">
                      <span>Configurer</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </button>

                  {onQuickAddVehicleToCart && (
                    <button
                      type="button"
                      onClick={() => onQuickAddVehicleToCart(srv)}
                      className="w-full py-2 min-h-[40px] px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-[11px] font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ShoppingCart className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Ajouter au panier</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
