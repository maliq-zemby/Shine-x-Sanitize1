import React from 'react';
import { Layers } from 'lucide-react';
import { Booking } from '../types';
import { getBookingItems } from '../utils/bookingItems';

interface BookingItemsListProps {
  booking: Booking;
  compact?: boolean;
}

export const BookingItemsList: React.FC<BookingItemsListProps> = ({
  booking,
  compact = false,
}) => {
  const items = getBookingItems(booking);
  if (items.length === 0) return null;

  const totalUnits = items.reduce((sum, it) => sum + Math.max(1, it.quantity || 1), 0);

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
            Détail des services sélectionnés ({items.length} ligne{items.length > 1 ? 's' : ''} ·{' '}
            {totalUnits} prestation{totalUnits > 1 ? 's' : ''})
          </span>
        </div>
      </div>

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
                {item.material && <span>Matériau : {item.material}</span>}
                {item.condition && <span>· État : {item.condition}</span>}
                {item.vehicleBrand && (
                  <span className="text-emerald-800 font-medium">
                    · {item.vehicleBrand}
                    {item.vehicleModel ? ` ${item.vehicleModel}` : ''} ({item.vehicleSeats || 5}{' '}
                    places)
                  </span>
                )}
                {item.options && item.options.length > 0 && (
                  <span>· Options : {item.options.join(', ')}</span>
                )}
              </div>
            </div>

            <div className="text-right shrink-0 tabular-nums font-bold text-slate-900">
              {item.totalPrice.toLocaleString('fr-FR')} XAF
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
