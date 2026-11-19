import { Booking, BookingPromoApplied, Promotion, ServiceItem } from '../types';

export interface ParsedDiscount {
  type: 'percent' | 'fixed' | 'none';
  value: number;
  shortLabel: string;
}

export interface DiscountedPriceBreakdown {
  originalPrice: number;
  discountPercent: number | null;
  discountAmount: number;
  finalPrice: number;
  shortLabel: string;
  offerLineLabel: string;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function extractDiscountFromString(raw: string): ParsedDiscount | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Match percentage e.g. "-15%", "15 %", "- 20%"
  const percentMatch = trimmed.match(/-\s*(\d+(?:[.,]\d+)?)\s*%|(\d+(?:[.,]\d+)?)\s*%/);
  if (percentMatch) {
    const numStr = (percentMatch[1] || percentMatch[2] || '').replace(',', '.');
    const pct = Number(numStr);
    if (Number.isFinite(pct) && pct > 0 && pct <= 95) {
      return {
        type: 'percent',
        value: pct,
        shortLabel: `-${pct}%`,
      };
    }
  }

  // Match fixed FCFA/XAF amount e.g. "-5 000 FCFA", "-5000 XAF", "5 000 CFA"
  const fixedMatch = trimmed.match(/-\s*([\d\s.,]{3,12})\s*(?:xaf|fcfa|cfa)?|([\d\s.,]{3,12})\s*(?:xaf|fcfa|cfa)/i);
  if (fixedMatch) {
    const rawNum = (fixedMatch[1] || fixedMatch[2] || '').replace(/[^\d]/g, '');
    const amount = Number(rawNum);
    if (Number.isFinite(amount) && amount >= 500) {
      return {
        type: 'fixed',
        value: Math.round(amount),
        shortLabel: `-${Math.round(amount).toLocaleString('fr-FR')} FCFA`,
      };
    }
  }

  return null;
}

export function parsePromotionDiscount(promo: Promotion): ParsedDiscount {
  return (
    extractDiscountFromString(promo.discountLabel || '') ||
    extractDiscountFromString(promo.title || '') ||
    extractDiscountFromString(promo.description || '') || {
      type: 'none',
      value: 0,
      shortLabel: promo.discountLabel || promo.title,
    }
  );
}

export function computeDiscountedPrice(
  rawPrice: number,
  promo: Promotion
): DiscountedPriceBreakdown {
  const safeBase = Math.max(1000, Math.round(rawPrice));
  const parsed = parsePromotionDiscount(promo);

  let discountPercent: number | null = null;
  let discountAmount = 0;
  let finalPrice = safeBase;

  if (parsed.type === 'percent') {
    discountPercent = parsed.value;
    const rawFinal = Math.round(safeBase * (1 - parsed.value / 100));
    finalPrice = Math.max(1000, rawFinal);
    discountAmount = Math.max(0, safeBase - finalPrice);
  } else if (parsed.type === 'fixed') {
    discountAmount = Math.min(Math.max(0, safeBase - 1000), parsed.value);
    finalPrice = Math.max(1000, safeBase - discountAmount);
  }

  const labelAlreadyHasDiscount =
    parsed.shortLabel &&
    normalizeText(promo.title).includes(normalizeText(parsed.shortLabel.replace(/\s+/g, '')));
  const offerLineLabel = labelAlreadyHasDiscount
    ? promo.title
    : `${parsed.shortLabel} - ${promo.title}`;

  return {
    originalPrice: safeBase,
    discountPercent,
    discountAmount,
    finalPrice,
    shortLabel: parsed.shortLabel,
    offerLineLabel,
  };
}

export function buildBookingPromoApplied(
  promo: Promotion,
  breakdown: DiscountedPriceBreakdown
): BookingPromoApplied {
  return {
    promotionId: promo.id.slice(0, 64),
    title: promo.title.slice(0, 140),
    discountLabel: breakdown.shortLabel.slice(0, 40),
    discountPercent: breakdown.discountPercent,
    discountAmount: breakdown.discountAmount,
    originalPrice: breakdown.originalPrice,
  };
}

/**
 * Normalise la lecture de la promotion appliquée sur une commande
 * (supporte `promoApplied` ainsi que les éventuels anciens champs plats).
 * Retourne `null` si aucune promotion n'a été appliquée.
 */
export function getBookingPromoInfo(booking: Booking): BookingPromoApplied | null {
  if (booking.promoApplied && booking.promoApplied.title) {
    return booking.promoApplied;
  }
  if (booking.appliedPromotionTitle && booking.originalPrice !== undefined) {
    return {
      ...(booking.appliedPromotionId ? { promotionId: booking.appliedPromotionId } : {}),
      title: booking.appliedPromotionTitle,
      ...(booking.appliedPromotionDiscount ? { discountLabel: booking.appliedPromotionDiscount } : {}),
      discountPercent: null,
      discountAmount: booking.discountAmount ?? Math.max(0, booking.originalPrice - booking.finalPrice),
      originalPrice: booking.originalPrice,
    };
  }
  return null;
}

/**
 * Associe automatiquement une promotion à un service exact du catalogue
 * d'après son titre (puis sa description / catégorie) :
 * - "lavage de voiture" / "4 roues" / "auto" / "suv" / "4x4" -> Véhicule à 4 Roues (srv-5)
 * - "moto" / "scooter" / "quad" -> Lavage Moto & Scooter (srv-6)
 * - "vélo" / "vtt" -> Entretien & Lavage Vélo (srv-7)
 * - "btp" / "travaux" / "chantier" -> Nettoyage après travaux BTP (srv-btp)
 * - "canapé" / "salon" / "fauteuil" -> Canapé & Salon Complet (srv-1)
 * - "matelas" / "literie" -> Matelas & Literie Hygiène Pro (srv-3)
 * - "tapis" / "moquette" -> Tapis & Moquettes Résidentiel (srv-4)
 * - "vitre" / "baie" -> Nettoyage Vitres & Baies Vitrées (srv-8)
 * - "bureau" -> Désinfection & Nettoyage Bureaux (srv-2)
 */
export function matchServiceForPromotion(
  promo: Promotion,
  services: ServiceItem[]
): ServiceItem | null {
  const haystack = normalizeText(`${promo.title} ${promo.description || ''}`);

  if (/(moto|scooter|quad)/.test(haystack)) {
    const moto = services.find((s) => s.vehicleType === 'moto' || s.id === 'srv-6');
    if (moto) return moto;
  }

  if (/(velo|vtt|bicyclette)/.test(haystack)) {
    const velo = services.find((s) => s.vehicleType === 'velo' || s.id === 'srv-7');
    if (velo) return velo;
  }

  if (/(voiture|4 roues|quatre roues|auto|automobile|suv|4x4|berline|carrosserie|habitacle|lavage.*vehicule|vehicule)/.test(haystack)) {
    const car = services.find((s) => s.vehicleType === '4_wheels' || s.id === 'srv-5');
    if (car) return car;
  }

  if (/(btp|chantier|apres travaux|travaux|ciment|renovation)/.test(haystack)) {
    const btp = services.find((s) => s.category === 'BTP' || s.id === 'srv-btp');
    if (btp) return btp;
  }

  if (/(canape|salon|fauteuil|divan|mobilier|sofa)/.test(haystack)) {
    const sofa = services.find((s) => s.id === 'srv-1' || s.category === 'Mobilier');
    if (sofa) return sofa;
  }

  if (/(matelas|literie|lit)/.test(haystack)) {
    const matelas = services.find((s) => s.id === 'srv-3' || s.category === 'Literie');
    if (matelas) return matelas;
  }

  if (/(tapis|moquette)/.test(haystack)) {
    const tapis = services.find((s) => s.id === 'srv-4' || s.category === 'Sol');
    if (tapis) return tapis;
  }

  if (/(vitre|baie|veranda|miroir)/.test(haystack)) {
    const vitre = services.find((s) => s.id === 'srv-8');
    if (vitre) return vitre;
  }

  if (/(bureau|bureaux|professionnel|entreprise|locaux)/.test(haystack)) {
    const bureau = services.find((s) => s.id === 'srv-2' || s.category === 'Professionnel');
    if (bureau) return bureau;
  }

  // Repli sur la catégorie associée si elle désigne un service précis (hors Véhicules générique)
  if (promo.serviceCategory && promo.serviceCategory !== 'Véhicules') {
    const byCategory = services.find((s) => s.category === promo.serviceCategory);
    if (byCategory) return byCategory;
  }

  return null;
}
