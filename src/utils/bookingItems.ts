import {
  Booking,
  BookingPromoApplied,
  BookingServiceItem,
  CartItem,
  Promotion,
  ServiceItem,
} from '../types';
import {
  buildBookingPromoApplied,
  computeDiscountedPrice,
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

export function serializeCartItems(items: CartItem[]): BookingServiceItem[] {
  return items.slice(0, 25).map((item) => {
    const qty = Math.max(1, Math.min(20, Math.round(item.quantity || 1)));
    const unit = Math.max(1000, Math.round(item.unitPrice || 1000));
    const clean: BookingServiceItem = {
      serviceId: String(item.serviceId || '').slice(0, 64),
      serviceName: String(item.serviceName || 'Prestation').trim().slice(0, 140),
      serviceCategory: item.serviceCategory,
      quantity: qty,
      unitPrice: unit,
      totalPrice: unit * qty,
    };

    if (item.vehicleType) clean.vehicleType = item.vehicleType;
    if (item.material) clean.material = item.material.slice(0, 80);
    if (item.condition) clean.condition = item.condition.slice(0, 80);
    if (Array.isArray(item.options) && item.options.length > 0) {
      clean.options = item.options.slice(0, 8).map((o) => String(o).slice(0, 80));
    }
    if (typeof item.agentsCount === 'number') clean.agentsCount = item.agentsCount;
    if (item.vehicleBrand) clean.vehicleBrand = item.vehicleBrand.slice(0, 60);
    if (item.vehicleModel) clean.vehicleModel = item.vehicleModel.slice(0, 60);
    if (typeof item.vehicleSeats === 'number') clean.vehicleSeats = item.vehicleSeats;
    if (item.image) clean.image = item.image.slice(0, 300);

    return clean;
  });
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

export interface CartPricingSummary {
  totalUnits: number;
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
  const matchedService = matchServiceForPromotion(promo, catalogServices);
  if (matchedService && matchedService.id === item.serviceId) return true;
  if (promo.serviceCategory && promo.serviceCategory === item.serviceCategory) return true;
  return false;
}

export function computeCartPricing(
  items: CartItem[],
  explicitCartPromotion: Promotion | null,
  catalogServices: ServiceItem[]
): CartPricingSummary {
  const totalUnits = items.reduce((sum, item) => sum + Math.max(1, item.quantity || 1), 0);
  const rawSubtotal = items.reduce(
    (sum, item) => sum + Math.max(1000, Math.round(item.unitPrice)) * Math.max(1, item.quantity || 1),
    0
  );

  if (items.length === 0 || rawSubtotal <= 0) {
    return {
      totalUnits: 0,
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
  const eligibleSubtotal =
    matchingItems.length > 0
      ? matchingItems.reduce(
          (sum, item) =>
            sum + Math.max(1000, Math.round(item.unitPrice)) * Math.max(1, item.quantity || 1),
          0
        )
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
    rawSubtotal,
    activePromotion: resolvedPromo,
    eligibleSubtotal,
    discountAmount,
    finalTotal,
    promoApplied,
  };
}
