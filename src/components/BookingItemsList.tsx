import React from 'react';
import { Info, Layers, Sparkles } from 'lucide-react';
import { VEHICLE_4W_INTERIOR_NOTE } from '../data/mockData';
import { Booking } from '../types';
import { getBookingItems, getBookingSupplementalServices } from '../utils/bookingItems';

interface BookingItemsListProps {
  booking: Booking;
  compact?: boolean;
}

export const BookingItemsList: React.FC<BookingItemsListProps> = ({
  booking,
  compact = false,
}) => {
  const items = getBookingItems(booking);
  const supplementalServices = getBookingSupplementalServices(booking);
  if (items.length === 0 && supplementalServices.length === 0) return null;

  const totalUnits = items.reduce((sum, it) => sum + Math.max(1, it.quantity || 1), 0);
  const rawItemsTotal = items.reduce((sum, it) => sum + Math.max(0, it.totalPrice || 0), 0);
  const extrasTotal = supplementalServices.reduce((sum, s) => sum + Math.max(0, s.price || 0), 0);
  const rawTotal = rawItemsTotal + extrasTotal;
  const hasFourWheelVehicle =
    booking.serviceId === 'srv-5' ||
    booking.vehicleType === '4_wheels' ||
    items.some((it) => it.serviceId === 'srv-5' || it.vehicleType === '4_wheels');

  return (
    <div
      className={`bg-slate-50 border border-slate-200 rounded-xl ${
        compact ? 'p-3 space-y-2' : 'p-4 space-y-2.5'
      } text-xs`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-bold text-slate-800 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span>
            Détail du devis ({items.length} ligne{items.length > 1 ? 's' : ''} · {totalUnits}{' '}
            élément{totalUnits > 1 ? 's' : ''})
          </span>
        </div>
        <span className="text-[11px] font-bold text-emerald-800 tabular-nums shrink-0">
          Sous-total : {rawTotal.toLocaleString('fr-FR')} FCFA
        </span>
      </div>

      {items.length > 0 && (
        <div className="divide-y divide-slate-200/80">
          {items.map((item, idx) => (
            <div
              key={`${item.serviceId}-${idx}`}
              className="py-2 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="font-semibold text-slate-900">
                  <span className="text-emerald-800 font-bold tabular-nums">{item.quantity}×</span>{' '}
                  {item.serviceName}
                  <span className="text-[11px] font-medium text-slate-500 ml-1.5">
                    ({item.serviceCategory})
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-2 gap-y-0.5">
                  <span className="tabular-nums font-medium text-slate-700">
                    PU : {item.unitPrice.toLocaleString('fr-FR')} FCFA
                  </span>
                  {item.material && <span>· {item.material}</span>}
                  {item.condition && <span>· État : {item.condition}</span>}
                  {item.vehicleBrand && (
                    <span className="text-emerald-800 font-medium">
                      · {item.vehicleBrand}
                      {item.vehicleModel ? ` ${item.vehicleModel}` : ''}
                      {typeof item.vehicleSeats === 'number' ? ` (${item.vehicleSeats} places)` : ''}
                    </span>
                  )}
                  {item.options && item.options.length > 0 && (
                    <span>· {item.options.join(', ')}</span>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0 tabular-nums font-bold text-slate-900">
                {item.totalPrice.toLocaleString('fr-FR')} FCFA
              </div>
            </div>
          ))}
        </div>
      )}

      {supplementalServices.length > 0 && (
        <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
          <div className="text-[11px] font-bold text-emerald-900 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>Services supplémentaires à appliquer :</span>
          </div>
          <div className="space-y-1">
            {supplementalServices.map((extra, idx) => (
              <div
                key={`${extra.id}-${idx}`}
                className="flex items-center justify-between gap-2 text-[11px] bg-white border border-slate-200/80 rounded-lg px-2.5 py-1.5"
              >
                <span className="font-semibold text-slate-800">{extra.label}</span>
                {extra.price === 0 ? (
                  <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-1.5 py-0.5 tabular-nums shrink-0">
                    Gratuit (0 FCFA)
                  </span>
                ) : (
                  <span className="font-bold text-slate-900 tabular-nums shrink-0">
                    +{extra.price.toLocaleString('fr-FR')} FCFA
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasFourWheelVehicle && (
        <div className="pt-2 border-t border-slate-200/80 flex items-start gap-1.5 text-[11px] font-medium text-amber-900">
          <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
          <span>{VEHICLE_4W_INTERIOR_NOTE}</span>
        </div>
      )}
    </div>
  );
};
