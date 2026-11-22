export type Role = 'client' | 'agent' | 'manager' | 'admin';

export type AccountStatus = 'active' | 'pending' | 'rejected' | 'banned';

/**
 * Statut de validation administrateur d'un compte Entreprise / Gérant.
 * - pending  : inscription en cours de vérification (accès bloqué)
 * - approved : entreprise validée (accès complet)
 * - rejected : inscription refusée (accès bloqué, motif dans rejectionReason)
 */
export type CompanyValidationStatus = 'pending' | 'approved' | 'rejected';

export type VehicleCategory = '4_wheels' | 'moto' | 'velo';

export type BookingStatus =
  | 'pending_negotiation'
  | 'counter_offered'
  | 'confirmed'
  | 'in_transit'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type PaymentMethod = 'Airtel Money' | 'Moov Money' | 'Espèces' | 'Carte bancaire';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  role: Role;
  accountStatus: AccountStatus;
  phone: string;
  acceptedTerms?: boolean;
  acceptedTermsAt?: string;
  companyName?: string;
  companyDescription?: string;
  commune?: string;
  banReason?: string;
  /** Validation administrateur (comptes Entreprise / Gérant uniquement). */
  status?: CompanyValidationStatus;
  /** Motif de rejet saisi par l'administrateur ("" tant qu'aucun rejet). */
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  phone: string;
  specialty: string;
  rating: number;
  missionsCount: number;
  communeBase: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  category: 'Mobilier' | 'Professionnel' | 'Literie' | 'Sol' | 'Véhicules' | 'BTP';
  vehicleType?: VehicleCategory;
  basePrice: number;
  duration: string;
  description: string;
  image: string;
  materials: string[];
  availableOptions: string[];
  updatedBy?: string;
  updatedAt?: string;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  discountLabel: string;
  serviceCategory?: string;
  companyName: string;
  validUntil?: string;
  status: 'active' | 'pending' | 'approved' | 'rejected';
  createdByUid: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GpsPoint {
  lat: number;
  lng: number;
  neighborhood?: string;
  accuracy?: number;
  updatedAt?: string;
}

export interface BookingPromoApplied {
  promotionId?: string;
  title: string;
  discountLabel?: string;
  discountPercent?: number | null;
  discountAmount: number;
  originalPrice: number;
}

export interface AssignedAgentInfo {
  uid: string;
  displayName: string;
  phone?: string;
  commune?: string;
}

export interface Booking {
  id: string;
  ownerUid: string;
  userId?: string;
  clientId?: string;
  serviceId: string;
  serviceName: string;
  serviceCategory: ServiceItem['category'];
  vehicleType?: VehicleCategory;
  clientName: string;
  clientPhone: string;
  commune: string;
  address: string;
  clientCoords: GpsPoint;
  clientGpsActive: boolean;
  details: {
    material: string;
    condition: string;
    stains: string[];
    options: string[];
    agentsCount: number;
    vehicleBrand?: string;
    vehicleModel?: string;
    vehicleSeats?: number;
  };
  clientOfferPrice: number;
  promoApplied?: BookingPromoApplied | null;
  originalPrice?: number;
  discountAmount?: number;
  appliedPromotionId?: string;
  appliedPromotionTitle?: string;
  appliedPromotionDiscount?: string;
  managerCounterPrice?: number;
  priceAdjustmentNote?: string;
  finalPrice: number;
  status: BookingStatus;
  rejectionReason?: string;
  refusalReason?: string;
  refusedAt?: string;
  assignedAgents: string[];
  assignedAgentIds?: string[];
  assignedAgentDetails?: AssignedAgentInfo[];
  gpsActive: boolean;
  agentGps?: GpsPoint;
  startedAt?: string;
  completedAt?: string;
  beforePhotos: string[];
  afterPhotos: string[];
  photosArchivedAt?: string;
  agentsCongratulatedAt?: string;
  agentsCongratulatedBy?: string;
  createdAt: string;
  updatedAt?: string;
  paymentMethod: PaymentMethod;
  rating?: number;
  review?: string;
  reviewSubmittedAt?: string;
  clientComment?: string;
  clientCommentAt?: string;
}

export type NotificationType =
  | 'new_booking'
  | 'agent_assigned'
  | 'new_registration'
  | 'promo_approved'
  | 'mission_completed'
  | 'client_thank_you'
  | 'agent_encouragement'
  | 'company_approved'
  | 'company_rejected'
  | 'order_refused';

export type ActiveTabId =
  | 'home'
  | 'services'
  | 'mes_reservations'
  | 'suivi_commande'
  | 'agent_space'
  | 'admin';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  message?: string;
  targetRoles: Role[];
  targetAgentNames?: string[];
  targetOwnerUid?: string;
  recipientId?: string;
  orderId?: string;
  relatedId: string;
  relatedTab?: ActiveTabId;
  actorUid: string;
  read?: boolean;
  createdAt: string;
}

