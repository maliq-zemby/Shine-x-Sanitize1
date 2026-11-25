import {
  Booking,
  BookingPromoApplied,
  BookingServiceItem,
  CartItem,
  Promotion,
  ServiceItem,
  SupplementalServiceOption,
} from '../types';
import {
  buildBookingPromoApplied,
  computeDiscountedPrice,
  isFourWheelVehiclePromo,
  isTwoWheelVehiclePromo,
  matchServiceForPromotion,
} from './promotions';

export function getBookingItems(booking: Booking): BookingServiceItem[] {
  const candidates =
    (Array.isArray(booking.items) && booking.items.length > 0 && booking.items) ||
    (Array.isArray(booking.services) && booking.services.length > 0 && booking.services) ||
    (Array.isArray(booking.details?.cartItems) &&
      booking.details.cartItems.length > 0 &&
      booking.details.cartItems) ||
    [];

  return candidates
    .filter((item) => item && typeof item.serviceName === 'string' && item.serviceName.trim().length > 0)
    .map((item) => {
      const qty = Math.max(1, Math.round(item.quantity || 1));
      const unit = Math.max(1000, Math.round(item.unitPrice || 1000));
      const total = Math.max(1000, Math.round(item.totalPrice || unit * qty));
      return {
        serviceId: String(item.serviceId || '').slice(0, 64),
        serviceName: String(item.serviceName).trim().slice(0, 140),
        serviceCategory: item.serviceCategory || 'Mobilier',
        ...(item.vehicleType ? { vehicleType: item.vehicleType } : {}),
        quantity: qty,
        unitPrice: unit,
        totalPrice: total,
        ...(item.material ? { material: String(item.material).slice(0, 80) } : {}),
        ...(item.condition ? { condition: String(item.condition).slice(0, 80) } : {}),
        ...(Array.isArray(item.options) && item.options.length > 0
          ? { options: item.options.slice(0, 8).map((o) => String(o).slice(0, 80)) }
          : {}),
        ...(typeof item.agentsCount === 'number' ? { agentsCount: item.agentsCount } : {}),
        ...(item.vehicleBrand ? { vehicleBrand: String(item.vehicleBrand).slice(0, 60) } : {}),
        ...(item.vehicleModel ? { vehicleModel: String(item.vehicleModel).slice(0, 60) } : {}),
        ...(typeof item.vehicleSeats === 'number' ? { vehicleSeats: item.vehicleSeats } : {}),
        ...(item.image ? { image: String(item.image).slice(0, 300) } : {}),
      };
    });
}

function sanitizeBookingServiceItem(
  raw: BookingServiceItem,
  multiplier = 1
): BookingServiceItem {
  const qty = Math.max(1, Math.min(99, Math.round((raw.quantity || 1) * multiplier)));
  const unit = Math.max(1000, Math.round(raw.unitPrice || 1000));
  const clean: BookingServiceItem = {
    serviceId: String(raw.serviceId || '').slice(0, 64),
    serviceName: String(raw.serviceName || 'Prestation').trim().slice(0, 140),
    serviceCategory: raw.serviceCategory,
    quantity: qty,
    unitPrice: unit,
    totalPrice: unit * qty,
  };

  if (raw.vehicleType) clean.vehicleType = raw.vehicleType;
  if (raw.material) clean.material = raw.material.slice(0, 80);
  if (raw.condition) clean.condition = raw.condition.slice(0, 80);
  if (Array.isArray(raw.options) && raw.options.length > 0) {
    clean.options = raw.options.slice(0, 8).map((o) => String(o).slice(0, 80));
  }
  if (typeof raw.agentsCount === 'number') clean.agentsCount = raw.agentsCount;
  if (raw.vehicleBrand) clean.vehicleBrand = raw.vehicleBrand.slice(0, 60);
  if (raw.vehicleModel) clean.vehicleModel = raw.vehicleModel.slice(0, 60);
  if (typeof raw.vehicleSeats === 'number') clean.vehicleSeats = raw.vehicleSeats;
  if (raw.image) clean.image = raw.image.slice(0, 300);

  return clean;
}

export function serializeCartItems(items: CartItem[]): BookingServiceItem[] {
  const expanded: BookingServiceItem[] = [];

  for (const item of items) {
    const pkgQty = Math.max(1, Math.min(20, Math.round(item.quantity || 1)));
    if (Array.isArray(item.quoteLines) && item.quoteLines.length > 0) {
      for (const line of item.quoteLines) {
        expanded.push(
          sanitizeBookingServiceItem(
            {
              ...line,
              material: line.material || item.material,
              condition: line.condition || item.condition,
              agentsCount: line.agentsCount ?? item.agentsCount,
              vehicleBrand: line.vehicleBrand || item.vehicleBrand,
              vehicleModel: line.vehicleModel || item.vehicleModel,
              vehicleSeats: line.vehicleSeats ?? item.vehicleSeats,
              image: line.image || item.image,
            },
            pkgQty
          )
        );
        if (expanded.length >= 25) break;
      }
    } else {
      expanded.push(sanitizeBookingServiceItem(item, 1));
    }
    if (expanded.length >= 25) break;
  }

  return expanded.slice(0, 25);
}

export function buildCartServiceSummary(items: BookingServiceItem[]): string {
  if (items.length === 0) return 'Commande multi-services';
  if (items.length === 1) {
    const only = items[0];
    const base = only.quantity > 1 ? `${only.quantity}× ${only.serviceName}` : only.serviceName;
    return base.slice(0, 180);
  }

  const totalCount = items.reduce((sum, it) => sum + Math.max(1, it.quantity || 1), 0);
  const parts = items.map((it) =>
    it.quantity > 1 ? `${it.quantity}× ${it.serviceName}` : it.serviceName
  );
  const prefix = `Panier (${totalCount} services) : `;
  const full = `${prefix}${parts.join(', ')}`;
  if (full.length <= 180) return full;

  let acc = prefix;
  for (let i = 0; i < parts.length; i += 1) {
    const remaining = parts.length - i;
    const suffix = remaining > 1 ? ` + ${remaining} autre(s)` : '';
    const candidate = `${acc}${i > 0 ? ', ' : ''}${parts[i]}`;
    if (candidate.length + suffix.length <= 178) {
      acc = candidate;
    } else {
      return `${acc} + ${remaining} autre(s)`.slice(0, 180);
    }
  }
  return acc.slice(0, 180);
}

export function getBookingSupplementalServices(
  booking: Booking
): { id: string; label: string; price: number }[] {
  const explicit = booking.details?.supplementalServices;
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit
      .filter((s) => s && typeof s.label === 'string' && s.label.trim().length > 0)
      .map((s, idx) => ({
        id: String(s.id || `extra-${idx}`).slice(0, 64),
        label: String(s.label).trim().slice(0, 80),
        price: Math.max(0, Math.round(Number(s.price) || 0)),
      }));
  }
  return [];
}

export interface CartPricingSummary {
  totalUnits: number;
  rawItemsSubtotal: number;
  extrasSubtotal: number;
  rawSubtotal: number;
  activePromotion: Promotion | null;
  eligibleSubtotal: number;
  discountAmount: number;
  finalTotal: number;
  promoApplied: BookingPromoApplied | null;
}

export function doesPromotionMatchCartItem(
  promo: Promotion,
  item: CartItem,
  catalogServices: ServiceItem[]
): boolean {
  if (item.promotion && item.promotion.id === promo.id) return true;
  if (item.serviceId === 'velo-moto-quad' && isTwoWheelVehiclePromo(promo)) {
    return true;
  }
  if ((item.serviceId === 'srv-5' || item.vehicleType === '4_wheels') && isFourWheelVehiclePromo(promo)) {
    return true;
  }
  const matchedService = matchServiceForPromotion(promo, catalogServices);
  if (matchedService && matchedService.id === item.serviceId) return true;
  if (promo.serviceCategory && promo.serviceCategory === item.serviceCategory) return true;
  return false;
}

export function computeCartPricing(
  items: CartItem[],
  explicitCartPromotion: Promotion | null,
  catalogServices: ServiceItem[],
  selectedExtras: SupplementalServiceOption[] = []
): CartPricingSummary {
  const totalUnits = items.reduce((sum, item) => sum + Math.max(1, item.quantity || 1), 0);
  const rawItemsSubtotal = items.reduce(
    (sum, item) => sum + Math.max(1000, Math.round(item.unitPrice)) * Math.max(1, item.quantity || 1),
    0
  );
  const extrasSubtotal =
    items.length > 0
      ? selectedExtras.reduce((sum, extra) => sum + Math.max(0, Math.round(extra.price || 0)), 0)
      : 0;
  const rawSubtotal = rawItemsSubtotal + extrasSubtotal;

  if (items.length === 0 || rawSubtotal <= 0) {
    return {
      totalUnits: 0,
      rawItemsSubtotal: 0,
      extrasSubtotal: 0,
      rawSubtotal: 0,
      activePromotion: explicitCartPromotion,
      eligibleSubtotal: 0,
      discountAmount: 0,
      finalTotal: 0,
      promoApplied: null,
    };
  }

  const resolvedPromo =
    explicitCartPromotion || items.find((item) => Boolean(item.promotion))?.promotion || null;

  if (!resolvedPromo) {
    return {
      totalUnits,
      rawItemsSubtotal,
      extrasSubtotal,
      rawSubtotal,
      activePromotion: null,
      eligibleSubtotal: 0,
      discountAmount: 0,
      finalTotal: Math.max(1000, rawSubtotal),
      promoApplied: null,
    };
  }

  const matchingItems = items.filter((item) =>
    doesPromotionMatchCartItem(resolvedPromo, item, catalogServices)
  );
  const matchingItemsSubtotal = matchingItems.reduce(
    (sum, item) => sum + Math.max(1000, Math.round(item.unitPrice)) * Math.max(1, item.quantity || 1),
    0
  );
  const eligibleSubtotal =
    matchingItems.length > 0
      ? matchingItemsSubtotal + (matchingItems.length === items.length ? extrasSubtotal : 0)
      : rawSubtotal;

  const breakdown = computeDiscountedPrice(eligibleSubtotal, resolvedPromo);
  const maxAllowedDiscount = Math.max(0, rawSubtotal - 1000);
  const discountAmount = Math.min(maxAllowedDiscount, Math.max(0, breakdown.discountAmount));
  const finalTotal = Math.max(1000, rawSubtotal - discountAmount);

  const promoApplied = buildBookingPromoApplied(resolvedPromo, {
    ...breakdown,
    originalPrice: rawSubtotal,
    discountAmount,
    finalPrice: finalTotal,
  });

  return {
    totalUnits,
    rawItemsSubtotal,
    extrasSubtotal,
    rawSubtotal,
    activePromotion: resolvedPromo,
    eligibleSubtotal,
    discountAmount,
    finalTotal,
    promoApplied,
  };
}
