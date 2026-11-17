import React from 'react';
import { ArrowRight, Bike, Car, X } from 'lucide-react';
import { ServiceItem, VehicleCategory } from '../types';

interface VehicleMobilityModalProps {
  vehicleServices: ServiceItem[];
  onSelectVehicleService: (service: ServiceItem) => void;
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
  onSelectVehicleService,
  onClose,
}) => {
  const orderedTypes: VehicleCategory[] = ['velo', 'moto', '4_wheels'];
  const orderedServices = orderedTypes
    .map((vt) => vehicleServices.find((s) => s.vehicleType === vt))
    .filter((s): s is ServiceItem => Boolean(s));

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
            Choisissez précisément le type de véhicule à nettoyer à Libreville pour accéder au configurateur dédié.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {orderedServices.map((srv) => {
            const meta = srv.vehicleType ? SUB_LABELS[srv.vehicleType] : null;
            return (
              <button
                key={srv.id}
                type="button"
                onClick={() => onSelectVehicleService(srv)}
                className="group text-left bg-white hover:border-emerald-700 border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                <div>
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
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-900">
                  <span className="tabular-nums text-emerald-800">
                    Dès {srv.basePrice.toLocaleString()} XAF
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 group-hover:translate-x-0.5 transition-transform">
                    <span>Choisir</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
