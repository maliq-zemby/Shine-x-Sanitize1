import { AgentProfile, Booking, Promotion, ServiceItem, UserProfile } from '../types';

export const APP_OFFICIAL_NAME = 'Shine-x-Sanitize Alp Group';
export const BRAND_LOGO_URL = '/logo-official.png';
export const ADMIN_BOOTSTRAP_EMAIL = 'zemby.maliq@shinexsanitize.app';
export const ADMIN_BOOTSTRAP_EMAILS = new Set([
  'zemby.maliq@shinexsanitize.app',
  'maliqzemby8@gmail.com',
]);
export const ADMIN_LAST_NAME = 'ZEMBY';
export const ADMIN_FIRST_NAME = 'Maliq';
export const ADMIN_DISPLAY_NAME = 'ZEMBY Maliq';
export const ADMIN_BOOTSTRAP_DIGEST =
  'f0df0d2ee2dfa89dde86d6c5b019a9f68fa4f84a7d03a944ac7343270c80b062';
export const ADMIN_WHATSAPP_PHONE = '+241 065 96 12 38';

export const MANAGER_WHATSAPP = '241065961238';
export const MANAGER_DISPLAY_PHONE = '+241 065 96 12 38';
export const MANAGER_NAME = 'Direction Shine-x-Sanitize Alp Group';

export const PROTOTYPE_EMAILS = new Set([
  'direction@alpclean-gabon.ga',
  'contact@owendopropre.ga',
  'christian.obame@alpgroup.ga',
  'marcel.nze@gmail.com',
  'maliqzemby@gmail.com',
]);

export const PROTOTYPE_BOOKING_IDS = new Set([
  'SHINE-9021',
  'SHINE-9104',
  'SHINE-9155',
  'SHINE-8610',
]);

export const PROTOTYPE_PROMO_IDS = new Set(['promo-1', 'promo-2', 'promo-3']);

export const COMMUNES: {
  id: 'Akanda' | 'Libreville' | 'Owendo' | 'Ntoum';
  name: string;
  coords: { lat: number; lng: number };
}[] = [
  {
    id: 'Akanda',
    name: 'Akanda (Amissa Chantal / Angondjé / Sablière)',
    coords: { lat: 0.5025, lng: 9.406 },
  },
  {
    id: 'Libreville',
    name: 'Libreville (Batterie 4 / Louis / Glass / Nzeng-Ayong)',
    coords: { lat: 0.391, lng: 9.4515 },
  },
  {
    id: 'Owendo',
    name: 'Owendo (Carrefour SNI / Lalala / Port d’Owendo)',
    coords: { lat: 0.3185, lng: 9.5025 },
  },
  {
    id: 'Ntoum',
    name: 'Ntoum & Périphérie (Bikélé / Essassa)',
    coords: { lat: 0.388, lng: 9.761 },
  },
];

export const VEHICLE_BRANDS = [
  'Toyota',
  'Hyundai',
  'Mitsubishi',
  'Kia',
  'Mercedes-Benz',
  'Renault',
  'Suzuki',
  'Nissan',
  'Peugeot',
  'Ford',
  'Land Rover',
  'Autre marque',
];

export const VEHICLE_SEAT_OPTIONS = [2, 4, 5, 7, 9];

export const SERVICE_OPTION_PRICES: Record<string, number> = {
  Désodorisant: 0,
  'Traitement anti-taches ciblé': 10000,
  'Traitement anti-acariens / antibactérien': 5000,
  'Protection textile hydrofuge': 7500,
  'Décapage peinture & colle': 15000,
  'Monobrosse sols carrelés': 20000,
  'Lustrage carrosserie': 6000,
  'Protection cuir & plastiques': 5000,
  'Dégraissage & lubrification chaîne': 2000,
  'Polissage chromes & protection': 2500,
  'Dégraissage complet transmission': 1500,
  'Cire protectrice cadre & lubrification': 2000,
  'Désinfection virucide certifiée': 15000,
  'Protection anti-traces vitres': 8000,
};

export function getOptionPrice(optionName: string): number {
  return SERVICE_OPTION_PRICES[optionName] ?? 0;
}

export const AGENTS_ROSTER: AgentProfile[] = [];

export const SERVICES: ServiceItem[] = [
  {
    id: 'srv-1',
    name: 'Canapé & Salon Complet',
    category: 'Mobilier',
    basePrice: 30000,
    duration: '2h - 3h',
    description:
      'Nettoyage en profondeur par injection-extraction vapeur, élimination des acariens et des taches tenaces.',
    image: '/src/assets/images/sofa_shine_alp_black_tech_1795438790341.jpg',
    materials: ['Velours', 'Cuir', 'Tissu Coton', 'Synthétique', 'Daim'],
    availableOptions: [
      'Désodorisant',
      'Traitement anti-taches ciblé',
      'Traitement anti-acariens / antibactérien',
      'Protection textile hydrofuge',
    ],
    updatedAt: '2026-11-17T08:00:00Z',
  },
  {
    id: 'srv-btp',
    name: 'Nettoyage après travaux BTP',
    category: 'BTP',
    basePrice: 145000,
    duration: '5h - 8h',
    description:
      'Remise en état complète après construction ou rénovation : évacuation poussières fines de ciment, décapage traces de peinture sur vitres, lavage mécanisé des sols et sanitaires.',
    image: '/src/assets/images/btp_shine_alp_1795029312202.jpg',
    materials: ['Appartement / Villa neuve', 'Immeuble / Bureaux BTP', 'Local commercial rénové', 'Façade & Baies vitrées'],
    availableOptions: [
      'Désodorisant',
      'Traitement anti-taches ciblé',
      'Décapage peinture & colle',
      'Monobrosse sols carrelés',
    ],
    updatedAt: '2026-11-17T08:00:00Z',
  },
  {
    id: 'srv-5',
    name: 'Véhicule à 4 Roues (Voiture / SUV / 4x4)',
    category: 'Véhicules',
    vehicleType: '4_wheels',
    basePrice: 15000,
    duration: '1h30 - 2h30',
    description:
      'Lavage complet intérieur et extérieur à domicile à Libreville : carrosserie, aspiration, shampoing des sièges et désinfection habitacle selon la marque et le nombre de places.',
    image: '/src/assets/images/car_shine_alp_1795029311865.jpg',
    materials: ['Carrosserie + Sièges Tissu', 'Carrosserie + Sellerie Cuir', 'Intérieur Complet Uniquement', 'Extérieur + Lustrage'],
    availableOptions: [
      'Désodorisant',
      'Traitement anti-taches ciblé',
      'Lustrage carrosserie',
      'Protection cuir & plastiques',
    ],
    updatedAt: '2026-11-17T08:00:00Z',
  },
  {
    id: 'srv-6',
    name: 'Lavage Moto & Scooter',
    category: 'Véhicules',
    vehicleType: 'moto',
    basePrice: 6000,
    duration: '45 min',
    description:
      'Dégraissage chaîne et moteur, lavage mousse active sans rayure à Libreville, séchage microfibre et protection plastiques & chromes.',
    image: '/src/assets/images/moto_shine_alp_1795029315085.jpg',
    materials: ['Moto Routière / Trail', 'Scooter Urbain', 'Moto Cross / Quad'],
    availableOptions: [
      'Désodorisant',
      'Traitement anti-taches ciblé',
      'Dégraissage & lubrification chaîne',
      'Polissage chromes & protection',
    ],
    updatedAt: '2026-11-17T08:00:00Z',
  },
  {
    id: 'srv-7',
    name: 'Entretien & Lavage Vélo',
    category: 'Véhicules',
    vehicleType: 'velo',
    basePrice: 4000,
    duration: '30 - 45 min',
    description:
      'Nettoyage haute précision pour VTT, vélo de route ou vélo électrique : cadre, transmission, dérailleur et lubrification.',
    image: '/src/assets/images/velo_shine_alp_1795029315713.jpg',
    materials: ['VTT', 'Vélo de Route Carbone', 'Vélo Électrique (VAE)', 'Vélo de Ville'],
    availableOptions: [
      'Désodorisant',
      'Traitement anti-taches ciblé',
      'Dégraissage complet transmission',
      'Cire protectrice cadre & lubrification',
    ],
    updatedAt: '2026-11-17T08:00:00Z',
  },
  {
    id: 'srv-2',
    name: 'Désinfection & Nettoyage Bureaux',
    category: 'Professionnel',
    basePrice: 95000,
    duration: '4h - 6h',
    description:
      'Nettoyage complet des espaces professionnels, cloisons vitrées, sols, postes de travail et sanitaires.',
    image: '/src/assets/images/office_shine_alp_1795029308753.jpg',
    materials: ['Surfaces Verre', 'Moquette Bureau', 'Carrelage', 'Mobilier Bois'],
    availableOptions: [
      'Désodorisant',
      'Traitement anti-taches ciblé',
      'Désinfection virucide certifiée',
      'Protection anti-traces vitres',
    ],
    updatedAt: '2026-11-17T08:00:00Z',
  },
  {
    id: 'srv-3',
    name: 'Matelas & Literie Hygiène Pro',
    category: 'Literie',
    basePrice: 20000,
    duration: '1h30',
    description:
      'Intervention par injection-extraction vapeur haute température directement sur votre matelas, élimination des acariens, bactéries et auréoles.',
    image: '/src/assets/images/matelas_shine_alp_1795029312918.jpg',
    materials: ['Matelas Latex', 'Mousse Mémoire', 'Ressorts', 'Coton Bio'],
    availableOptions: [
      'Désodorisant',
      'Traitement anti-taches ciblé',
      'Traitement anti-acariens / antibactérien',
      'Protection textile hydrofuge',
    ],
    updatedAt: '2026-11-17T08:00:00Z',
  },
  {
    id: 'srv-4',
    name: 'Tapis & Moquettes Résidentiel',
    category: 'Sol',
    basePrice: 25000,
    duration: '2h',
    description:
      'Shampouinage en profondeur et brossage rotatif mécanisé pour redonner éclat, douceur et propreté à vos tapis et moquettes.',
    image: '/src/assets/images/tapis_shine_alp_1795029313826.jpg',
    materials: ['Laine', 'Soie', 'Fibres Synthétiques', 'Jute'],
    availableOptions: [
      'Désodorisant',
      'Traitement anti-taches ciblé',
      'Traitement anti-acariens / antibactérien',
      'Protection textile hydrofuge',
    ],
    updatedAt: '2026-11-17T08:00:00Z',
  },
  {
    id: 'srv-8',
    name: 'Nettoyage Vitres & Baies Vitrées',
    category: 'Professionnel',
    basePrice: 22000,
    duration: '1h30 - 2h',
    description:
      'Lavage sans trace des baies vitrées, vérandas, garde-corps et miroirs avec traitement anti-calcaire et anti-embruns marins.',
    image: '/src/assets/images/office_shine_alp_1795029308753.jpg',
    materials: ['Baies vitrées villa', 'Vitrine commerciale', 'Verre teinté / miroir'],
    availableOptions: [
      'Désodorisant',
      'Traitement anti-taches ciblé',
      'Désinfection virucide certifiée',
      'Protection anti-traces vitres',
    ],
    updatedAt: '2026-11-17T08:00:00Z',
  },
];

export const INITIAL_USERS: UserProfile[] = [];

export const INITIAL_PROMOTIONS: Promotion[] = [];

export const INITIAL_BOOKINGS: Booking[] = [];
