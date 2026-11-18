export type Role = 'client' | 'agent' | 'manager' | 'admin';

export type AccountStatus = 'active' | 'pending' | 'rejected' | 'banned';

export type VehicleCategory = '4_wheels' | 'moto' | 'velo';

export type BookingStatus =
  | 'pending_negotiation'
  | 'counter_offered'
  | 'confirmed'
  | 'in_transit'
  | 'in_progress'
  | 'completed'
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
  status: 'pending' | 'approved' | 'rejected';
  createdByUid: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  ownerUid: string;
  serviceId: string;
  serviceName: string;
  serviceCategory: ServiceItem['category'];
  vehicleType?: VehicleCategory;
  clientName: string;
  clientPhone: string;
  commune: string;
  address: string;
  clientCoords: { lat: number; lng: number };
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
  managerCounterPrice?: number;
  priceAdjustmentNote?: string;
  finalPrice: number;
  status: BookingStatus;
  rejectionReason?: string;
  assignedAgents: string[];
  gpsActive: boolean;
  agentGps?: { lat: number; lng: number };
  startedAt?: string;
  completedAt?: string;
  beforePhotos: string[];
  afterPhotos: string[];
  createdAt: string;
  updatedAt?: string;
  paymentMethod: PaymentMethod;
  rating?: number;
  review?: string;
  reviewSubmittedAt?: string;
}

export type NotificationType =
  | 'new_booking'
  | 'agent_assigned'
  | 'new_registration'
  | 'promo_approved';

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
  targetRoles: Role[];
  targetAgentNames?: string[];
  relatedId: string;
  relatedTab?: ActiveTabId;
  actorUid: string;
  createdAt: string;
}

