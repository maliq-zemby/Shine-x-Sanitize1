import {
  AgentProfile,
  Booking,
  Promotion,
  ServiceItem,
  SupplementalServiceOption,
  UserProfile,
} from '../types';

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

export const VEHICLE_4W_INTERIOR_NOTE =
  'Nettoyage intérieur uniquement : cette prestation concerne exclusivement l’intérieur du véhicule (citadine, berline, SUV, pick-up / 4x4).';

export const SUPPLEMENTAL_SERVICES: SupplementalServiceOption[] = [
  {
    id: 'anti-taches',
    label: 'Anti-tâches',
    price: 5000,
    description: 'Barrière protectrice contre les taches du quotidien',
  },
  {
    id: 'impermeabilisant',
    label: 'Imperméabilisant',
    price: 10000,
    description: 'Protection hydrofuge longue durée contre les liquides',
  },
  {
    id: 'desodorisant',
    label: 'Désodorisant',
    price: 0,
    description: 'Parfum fraîcheur et neutralisation des odeurs',
  },
  {
    id: 'anti-acariens',
    label: 'Traitement anti-acariens',
    price: 5000,
    description: 'Action assainissante antibactérienne et anti-allergènes',
  },
  {
    id: 'detachage-cible',
    label: 'Détachage ciblé',
    price: 7500,
    description: 'Traitement intensif sur zones et taches incrustées',
  },
];

export const TWO_WHEEL_VEHICLE_QUOTE_OPTION = {
  id: 'velo-moto-quad',
  label: 'Nettoyage de Vélo, Moto & Quad',
  unitPrice: 5000,
  serviceCategory: 'Véhicules' as const,
  duration: '45min - 1h15',
  image: '/src/assets/images/moto_shine_alp_1795029315085.jpg',
  description: 'Tarif fixe de 5 000 FCFA par véhicule (vélo, moto ou quad)',
};

export const SERVICE_QUOTE_OPTIONS: Record<string, { id: string; label: string; unitPrice: number }[]> = {
  'srv-1': [
    { id: 'pouf', label: 'Pouf', unitPrice: 2500 },
    { id: 'chaise', label: 'Chaise', unitPrice: 2500 },
    { id: 'fauteuil-1', label: 'Fauteuil 1 place', unitPrice: 5000 },
    { id: 'canape-2', label: 'Canapé 2 places', unitPrice: 10000 },
    { id: 'canape-3', label: 'Canapé 3 places', unitPrice: 15000 },
    { id: 'canape-l', label: 'Canapé en L', unitPrice: 25000 },
    { id: 'canape-u', label: 'Canapé en U', unitPrice: 45000 },
  ],
  'srv-4': [
    { id: 'petit-tapis', label: 'Petit tapis', unitPrice: 10000 },
    { id: 'tapis-moyen', label: 'Tapis moyen', unitPrice: 15000 },
    { id: 'grand-tapis', label: 'Grand tapis', unitPrice: 20000 },
  ],
  'srv-3': [
    { id: 'matelas-1', label: 'Matelas 1 place', unitPrice: 10000 },
    { id: 'matelas-2', label: 'Matelas 2 places', unitPrice: 15000 },
    { id: 'matelas-3', label: 'Matelas 3 places', unitPrice: 20000 },
    { id: 'matelas-4', label: 'Matelas 4 places', unitPrice: 25000 },
    { id: 'berceau', label: 'Berceau', unitPrice: 10000 },
    { id: 'poussette', label: 'Poussette', unitPrice: 10000 },
  ],
  'srv-8': [
    { id: 'baie-vitree', label: 'Baie vitrée', unitPrice: 8000 },
    { id: 'fenetre', label: 'Fenêtre', unitPrice: 4000 },
  ],
  'srv-5': [
    { id: 'citadine', label: 'Citadine', unitPrice: 10000 },
    { id: 'berline', label: 'Berline', unitPrice: 15000 },
    { id: 'suv', label: 'SUV', unitPrice: 20000 },
    { id: 'pickup-4x4', label: 'Pick-up / 4x4', unitPrice: 25000 },
  ],
  'velo-moto-quad': [
    { id: 'velo-moto-quad', label: 'Nettoyage de Vélo, Moto & Quad', unitPrice: 5000 },
  ],
};

export function getServiceQuoteOptions(
  serviceId: string
): { id: string; label: string; unitPrice: number }[] {
  return SERVICE_QUOTE_OPTIONS[serviceId] || [];
}

export const SERVICE_OPTION_PRICES: Record<string, number> = {
  'Anti-tâches': 5000,
  Imperméabilisant: 10000,
  Désodorisant: 0,
  'Traitement anti-acariens': 5000,
  'Détachage ciblé': 7500,
};

export function getOptionPrice(optionName: string): number {
  return SERVICE_OPTION_PRICES[optionName] ?? 0;
}

export const AGENTS_ROSTER: AgentProfile[] = [];

export const SERVICES: ServiceItem[] = [
  {
    id: 'srv-1',
    name: 'Canapés & Assises',
    category: 'Mobilier',
    basePrice: 2500,
    duration: '1h - 3h',
    description:
      'Nettoyage en profondeur par injection-extraction vapeur pour poufs, chaises, fauteuils et canapés (2 places, 3 places, en L ou en U).',
    image: '/src/assets/images/sofa_shine_alp_black_tech_1795438790341.jpg',
    materials: ['Velours', 'Cuir', 'Tissu Coton', 'Synthétique', 'Daim'],
    availableOptions: [],
    updatedAt: '2026-11-24T08:00:00Z',
  },
  {
    id: 'srv-4',
    name: 'Tapis & Moquettes',
    category: 'Sol',
    basePrice: 10000,
    duration: '1h - 2h',
    description:
      'Shampouinage en profondeur et brossage mécanisé pour petits tapis, tapis moyens et grands tapis afin de restaurer éclat et hygiène.',
    image: '/src/assets/images/tapis_shine_alp_1795029313826.jpg',
    materials: ['Laine', 'Soie', 'Fibres Synthétiques', 'Jute'],
    availableOptions: [],
    updatedAt: '2026-11-24T08:00:00Z',
  },
  {
    id: 'srv-3',
    name: 'Matelas & Articles bébé',
    category: 'Literie',
    basePrice: 10000,
    duration: '1h - 1h30',
    description:
      'Assainissement vapeur haute température des matelas (1 à 4 places), berceaux et poussettes avec élimination des acariens et auréoles.',
    image: '/src/assets/images/matelas_shine_alp_1795029312918.jpg',
    materials: ['Matelas Latex', 'Mousse Mémoire', 'Ressorts', 'Textile Bébé'],
    availableOptions: [],
    updatedAt: '2026-11-24T08:00:00Z',
  },
  {
    id: 'srv-8',
    name: 'Vitrerie (Baies & Fenêtres)',
    category: 'Professionnel',
    basePrice: 4000,
    duration: '1h - 2h',
    description:
      'Lavage sans traces des baies vitrées et fenêtres avec finition soignée anti-calcaire et anti-embruns.',
    image: '/src/assets/images/office_shine_alp_1795029308753.jpg',
    materials: ['Baie vitrée', 'Fenêtre standard', 'Verre teinté / miroir'],
    availableOptions: [],
    updatedAt: '2026-11-24T08:00:00Z',
  },
  {
    id: 'srv-5',
    name: 'Nettoyage Véhicules à 4 roues',
    category: 'Véhicules',
    vehicleType: '4_wheels',
    basePrice: 10000,
    duration: '1h30 - 3h',
    description:
      'Nettoyage intérieur uniquement pour citadine, berline, SUV et pick-up / 4x4 : aspiration complète, injection-extraction des sièges, moquettes, garnitures et tableau de bord.',
    image: '/src/assets/images/car_shine_alp_1795029311865.jpg',
    materials: ['Tissu / Sellerie standard', 'Cuir / Simili cuir', 'Alcantara', 'Sellerie mixte'],
    availableOptions: [],
    updatedAt: '2026-11-24T08:00:00Z',
  },
  {
    id: 'velo-moto-quad',
    name: 'Nettoyage Vélo, Moto & Quad',
    category: 'Véhicules',
    vehicleType: 'moto',
    basePrice: 5000,
    duration: '45min - 1h15',
    description:
      'Lavage complet et dégraissage haute précision à domicile pour vélo, moto et quad (cadre, carénage, jantes et finition soignée).',
    image: '/src/assets/images/moto_shine_alp_1795029315085.jpg',
    materials: ['Standard (Vélo / Moto / Quad)', 'Moto routière / Sportive', 'Quad tout-terrain', 'Vélo / VTT'],
    availableOptions: [],
    updatedAt: '2026-11-24T08:00:00Z',
  },
];

export const INITIAL_USERS: UserProfile[] = [];

export const INITIAL_PROMOTIONS: Promotion[] = [];

export const INITIAL_BOOKINGS: Booking[] = [];
