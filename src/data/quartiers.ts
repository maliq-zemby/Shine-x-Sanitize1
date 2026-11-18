import { GpsPoint } from '../types';

export type CommuneGrandLibreville = 'Akanda' | 'Libreville' | 'Owendo' | 'Ntoum';

export interface QuartierEntry {
  id: string;
  name: string;
  commune: CommuneGrandLibreville;
  label: string;
  lat: number;
  lng: number;
  aliases?: string[];
}

export const DEFAULT_QUARTIER: QuartierEntry = {
  id: 'akanda-amissa-chantal',
  name: 'Amissa Chantal',
  commune: 'Akanda',
  label: 'Amissa Chantal, Akanda',
  lat: 0.5025,
  lng: 9.406,
  aliases: ['Amissa', 'Amissa Chantal', 'Cité Amissa', 'Secteur Amissa'],
};

export const DEFAULT_GPS_POSITION: GpsPoint = {
  lat: DEFAULT_QUARTIER.lat,
  lng: DEFAULT_QUARTIER.lng,
  neighborhood: DEFAULT_QUARTIER.label,
};

export const QUARTIERS_GRAND_LIBREVILLE: QuartierEntry[] = [
  // =========================================================================
  // COMMUNE D'AKANDA (Nord du Grand Libreville — défaut : Amissa Chantal)
  // =========================================================================
  DEFAULT_QUARTIER,
  {
    id: 'akanda-marseille-1',
    name: 'Marseille 1',
    commune: 'Akanda',
    label: 'Marseille 1, Akanda',
    lat: 0.4965,
    lng: 9.4095,
    aliases: ['Marseille', 'Marseille 1er'],
  },
  {
    id: 'akanda-marseille-2',
    name: 'Marseille 2',
    commune: 'Akanda',
    label: 'Marseille 2, Akanda',
    lat: 0.4995,
    lng: 9.4135,
  },
  {
    id: 'akanda-angondje',
    name: 'Angondjé',
    commune: 'Akanda',
    label: 'Angondjé, Akanda',
    lat: 0.4835,
    lng: 9.4185,
    aliases: ['Angondje', 'Cité Angondjé', 'Stade d’Angondjé'],
  },
  {
    id: 'akanda-angondje-chateau',
    name: 'Angondjé Château',
    commune: 'Akanda',
    label: 'Angondjé Château, Akanda',
    lat: 0.491,
    lng: 9.415,
    aliases: ['Château Angondjé'],
  },
  {
    id: 'akanda-angondje-stade',
    name: 'Angondjé Stade (Amitié)',
    commune: 'Akanda',
    label: 'Angondjé Stade, Akanda',
    lat: 0.4885,
    lng: 9.4235,
    aliases: ['Stade de l’Amitié'],
  },
  {
    id: 'akanda-angondje-cite-1',
    name: 'Angondjé 1ère Cité',
    commune: 'Akanda',
    label: 'Angondjé 1ère Cité, Akanda',
    lat: 0.4795,
    lng: 9.417,
  },
  {
    id: 'akanda-angondje-cite-2',
    name: 'Angondjé 2ème Cité',
    commune: 'Akanda',
    label: 'Angondjé 2ème Cité, Akanda',
    lat: 0.4855,
    lng: 9.4215,
  },
  {
    id: 'akanda-sherko',
    name: 'Sherko',
    commune: 'Akanda',
    label: 'Sherko, Akanda',
    lat: 0.476,
    lng: 9.4255,
  },
  {
    id: 'akanda-delta-postal',
    name: 'Delta Postal',
    commune: 'Akanda',
    label: 'Delta Postal, Akanda',
    lat: 0.4715,
    lng: 9.4205,
  },
  {
    id: 'akanda-avorbam',
    name: 'Avorbam',
    commune: 'Akanda',
    label: 'Avorbam, Akanda',
    lat: 0.4645,
    lng: 9.4235,
  },
  {
    id: 'akanda-sabliere',
    name: 'La Sablière',
    commune: 'Akanda',
    label: 'La Sablière, Akanda',
    lat: 0.4495,
    lng: 9.419,
    aliases: ['Sablière'],
  },
  {
    id: 'akanda-okala',
    name: 'Okala',
    commune: 'Akanda',
    label: 'Okala, Akanda',
    lat: 0.446,
    lng: 9.4265,
  },
  {
    id: 'akanda-okala-mikolongo',
    name: 'Okala Mikolongo',
    commune: 'Akanda',
    label: 'Okala Mikolongo, Akanda',
    lat: 0.453,
    lng: 9.433,
    aliases: ['Mikolongo'],
  },
  {
    id: 'akanda-okala-carriere',
    name: 'Okala Carrière',
    commune: 'Akanda',
    label: 'Okala Carrière, Akanda',
    lat: 0.442,
    lng: 9.431,
  },
  {
    id: 'akanda-okala-riviere',
    name: 'Okala Rivière',
    commune: 'Akanda',
    label: 'Okala Rivière, Akanda',
    lat: 0.4485,
    lng: 9.435,
  },
  {
    id: 'akanda-ciciba',
    name: 'Ciciba',
    commune: 'Akanda',
    label: 'Ciciba, Akanda',
    lat: 0.461,
    lng: 9.432,
  },
  {
    id: 'akanda-alibandeng-nord',
    name: 'Alibandeng Nord',
    commune: 'Akanda',
    label: 'Alibandeng Nord, Akanda',
    lat: 0.441,
    lng: 9.438,
  },
  {
    id: 'akanda-premier-campement',
    name: 'Premier Campement',
    commune: 'Akanda',
    label: 'Premier Campement, Akanda',
    lat: 0.514,
    lng: 9.402,
    aliases: ['1er Campement'],
  },
  {
    id: 'akanda-cap-caravane',
    name: 'Cap Caravane',
    commune: 'Akanda',
    label: 'Cap Caravane, Akanda',
    lat: 0.525,
    lng: 9.392,
  },
  {
    id: 'akanda-malibe-1',
    name: 'Malibé 1',
    commune: 'Akanda',
    label: 'Malibé 1, Akanda',
    lat: 0.538,
    lng: 9.415,
    aliases: ['Malibe 1'],
  },
  {
    id: 'akanda-malibe-2',
    name: 'Malibé 2',
    commune: 'Akanda',
    label: 'Malibé 2, Akanda',
    lat: 0.548,
    lng: 9.424,
    aliases: ['Malibe 2'],
  },
  {
    id: 'akanda-cap-esterias',
    name: 'Cap Estérias',
    commune: 'Akanda',
    label: 'Cap Estérias, Akanda',
    lat: 0.598,
    lng: 9.335,
    aliases: ['Cap Esterias'],
  },

  // =========================================================================
  // COMMUNE DE LIBREVILLE (Centre, Nord-Est, Est et Sud-Est)
  // =========================================================================
  {
    id: 'lbv-batterie-4',
    name: 'Batterie 4',
    commune: 'Libreville',
    label: 'Batterie 4, Libreville',
    lat: 0.432,
    lng: 9.4285,
    aliases: ['Batterie IV', 'Batterie Quatre'],
  },
  {
    id: 'lbv-louis',
    name: 'Louis',
    commune: 'Libreville',
    label: 'Louis, Libreville',
    lat: 0.4095,
    lng: 9.4355,
    aliases: ['Quartier Louis'],
  },
  {
    id: 'lbv-quaben',
    name: 'Quaben',
    commune: 'Libreville',
    label: 'Quaben, Libreville',
    lat: 0.4155,
    lng: 9.4385,
  },
  {
    id: 'lbv-kalikak',
    name: 'Kalikak',
    commune: 'Libreville',
    label: 'Kalikak, Libreville',
    lat: 0.421,
    lng: 9.435,
  },
  {
    id: 'lbv-hauts-kalikak',
    name: 'Hauts de Kalikak',
    commune: 'Libreville',
    label: 'Hauts de Kalikak, Libreville',
    lat: 0.4245,
    lng: 9.438,
  },
  {
    id: 'lbv-tahitien',
    name: 'Tahitien',
    commune: 'Libreville',
    label: 'Tahitien, Libreville',
    lat: 0.425,
    lng: 9.4425,
  },
  {
    id: 'lbv-gue-gue',
    name: 'Gué-Gué',
    commune: 'Libreville',
    label: 'Gué-Gué, Libreville',
    lat: 0.424,
    lng: 9.446,
    aliases: ['Gue-Gue', 'Gue Gue'],
  },
  {
    id: 'lbv-haut-gue-gue',
    name: 'Haut de Gué-Gué',
    commune: 'Libreville',
    label: 'Haut de Gué-Gué, Libreville',
    lat: 0.429,
    lng: 9.4505,
  },
  {
    id: 'lbv-bas-gue-gue',
    name: 'Bas de Gué-Gué',
    commune: 'Libreville',
    label: 'Bas de Gué-Gué, Libreville',
    lat: 0.419,
    lng: 9.4455,
  },
  {
    id: 'lbv-trois-quartiers',
    name: 'Trois-Quartiers',
    commune: 'Libreville',
    label: 'Trois-Quartiers, Libreville',
    lat: 0.4025,
    lng: 9.443,
    aliases: ['3 Quartiers'],
  },
  {
    id: 'lbv-centre-ville',
    name: 'Centre-Ville (Plateau)',
    commune: 'Libreville',
    label: 'Centre-Ville, Libreville',
    lat: 0.391,
    lng: 9.4515,
    aliases: ['Plateau', 'Boulevard Triomphal', 'Libreville Centre'],
  },
  {
    id: 'lbv-bord-de-mer',
    name: 'Bord de Mer',
    commune: 'Libreville',
    label: 'Bord de Mer, Libreville',
    lat: 0.3935,
    lng: 9.4445,
  },
  {
    id: 'lbv-montagne-sainte',
    name: 'Montagne Sainte',
    commune: 'Libreville',
    label: 'Montagne Sainte, Libreville',
    lat: 0.3965,
    lng: 9.447,
  },
  {
    id: 'lbv-nombakele',
    name: 'Nombakélé',
    commune: 'Libreville',
    label: 'Nombakélé, Libreville',
    lat: 0.3935,
    lng: 9.4575,
    aliases: ['Nombakele'],
  },
  {
    id: 'lbv-likouala',
    name: 'Likouala',
    commune: 'Libreville',
    label: 'Likouala, Libreville',
    lat: 0.388,
    lng: 9.459,
  },
  {
    id: 'lbv-akebe-ville',
    name: 'Akébé-Ville',
    commune: 'Libreville',
    label: 'Akébé-Ville, Libreville',
    lat: 0.3835,
    lng: 9.461,
    aliases: ['Akebe'],
  },
  {
    id: 'lbv-akebe-plaine',
    name: 'Akébé-Plaine',
    commune: 'Libreville',
    label: 'Akébé-Plaine, Libreville',
    lat: 0.3805,
    lng: 9.4655,
  },
  {
    id: 'lbv-akebe-poteau',
    name: 'Akébé-Poteau',
    commune: 'Libreville',
    label: 'Akébé-Poteau, Libreville',
    lat: 0.3855,
    lng: 9.4665,
  },
  {
    id: 'lbv-london',
    name: 'London',
    commune: 'Libreville',
    label: 'London, Libreville',
    lat: 0.3855,
    lng: 9.4545,
  },
  {
    id: 'lbv-plaine-orety',
    name: 'Plaine Orety',
    commune: 'Libreville',
    label: 'Plaine Orety, Libreville',
    lat: 0.383,
    lng: 9.452,
  },
  {
    id: 'lbv-glass',
    name: 'Glass',
    commune: 'Libreville',
    label: 'Glass, Libreville',
    lat: 0.3715,
    lng: 9.462,
  },
  {
    id: 'lbv-toulon',
    name: 'Toulon',
    commune: 'Libreville',
    label: 'Toulon, Libreville',
    lat: 0.3765,
    lng: 9.465,
  },
  {
    id: 'lbv-baraka',
    name: 'Baraka',
    commune: 'Libreville',
    label: 'Baraka, Libreville',
    lat: 0.3785,
    lng: 9.4715,
  },
  {
    id: 'lbv-oloumi',
    name: 'Oloumi',
    commune: 'Libreville',
    label: 'Oloumi, Libreville',
    lat: 0.3655,
    lng: 9.4685,
    aliases: ['Zone Industrielle Oloumi'],
  },
  {
    id: 'lbv-lalala-droite',
    name: 'Lalala à Droite',
    commune: 'Libreville',
    label: 'Lalala à Droite, Libreville',
    lat: 0.355,
    lng: 9.4745,
    aliases: ['Lalala'],
  },
  {
    id: 'lbv-lalala-gauche',
    name: 'Lalala à Gauche',
    commune: 'Libreville',
    label: 'Lalala à Gauche, Libreville',
    lat: 0.351,
    lng: 9.479,
  },
  {
    id: 'lbv-lalala-dakar',
    name: 'Lalala Dakar',
    commune: 'Libreville',
    label: 'Lalala Dakar, Libreville',
    lat: 0.347,
    lng: 9.473,
  },
  {
    id: 'lbv-awendje',
    name: 'Awendjé',
    commune: 'Libreville',
    label: 'Awendjé, Libreville',
    lat: 0.3675,
    lng: 9.4785,
    aliases: ['Awendje'],
  },
  {
    id: 'lbv-ozoungue',
    name: 'Ozoungué',
    commune: 'Libreville',
    label: 'Ozoungué, Libreville',
    lat: 0.361,
    lng: 9.4845,
    aliases: ['Ozoungue'],
  },
  {
    id: 'lbv-mont-bouet',
    name: 'Mont-Bouët',
    commune: 'Libreville',
    label: 'Mont-Bouët, Libreville',
    lat: 0.3965,
    lng: 9.4645,
    aliases: ['Mont Bouet'],
  },
  {
    id: 'lbv-nkembo',
    name: 'Nkembo',
    commune: 'Libreville',
    label: 'Nkembo, Libreville',
    lat: 0.399,
    lng: 9.4715,
  },
  {
    id: 'lbv-derriere-hopital',
    name: 'Derrière l’Hôpital',
    commune: 'Libreville',
    label: 'Derrière l’Hôpital, Libreville',
    lat: 0.3915,
    lng: 9.4625,
  },
  {
    id: 'lbv-atong-abe',
    name: 'Atong-Abè',
    commune: 'Libreville',
    label: 'Atong-Abè, Libreville',
    lat: 0.406,
    lng: 9.469,
    aliases: ['Atong Abe'],
  },
  {
    id: 'lbv-cocotiers',
    name: 'Cocotiers',
    commune: 'Libreville',
    label: 'Cocotiers, Libreville',
    lat: 0.3995,
    lng: 9.4595,
  },
  {
    id: 'lbv-rio',
    name: 'Rio',
    commune: 'Libreville',
    label: 'Rio, Libreville',
    lat: 0.4045,
    lng: 9.458,
  },
  {
    id: 'lbv-peyrie',
    name: 'Peyrie',
    commune: 'Libreville',
    label: 'Peyrie, Libreville',
    lat: 0.4015,
    lng: 9.4545,
  },
  {
    id: 'lbv-avea',
    name: 'Avéa',
    commune: 'Libreville',
    label: 'Avéa, Libreville',
    lat: 0.4035,
    lng: 9.464,
    aliases: ['Avea'],
  },
  {
    id: 'lbv-jeanne-ebori',
    name: 'Jeanne Ebori',
    commune: 'Libreville',
    label: 'Jeanne Ebori, Libreville',
    lat: 0.3885,
    lng: 9.4495,
  },
  {
    id: 'lbv-bellevue-1',
    name: 'Belle-Vue 1',
    commune: 'Libreville',
    label: 'Belle-Vue 1, Libreville',
    lat: 0.414,
    lng: 9.457,
  },
  {
    id: 'lbv-bellevue-2',
    name: 'Belle-Vue 2',
    commune: 'Libreville',
    label: 'Belle-Vue 2, Libreville',
    lat: 0.419,
    lng: 9.463,
  },
  {
    id: 'lbv-charbonnages',
    name: 'Charbonnages',
    commune: 'Libreville',
    label: 'Charbonnages, Libreville',
    lat: 0.4275,
    lng: 9.467,
  },
  {
    id: 'lbv-ondogho',
    name: 'Ondogho',
    commune: 'Libreville',
    label: 'Ondogho, Libreville',
    lat: 0.431,
    lng: 9.475,
  },
  {
    id: 'lbv-alibandeng',
    name: 'Alibandeng',
    commune: 'Libreville',
    label: 'Alibandeng, Libreville',
    lat: 0.435,
    lng: 9.445,
  },
  {
    id: 'lbv-ambowe',
    name: 'Ambowè',
    commune: 'Libreville',
    label: 'Ambowè, Libreville',
    lat: 0.437,
    lng: 9.4555,
    aliases: ['Ambowe'],
  },
  {
    id: 'lbv-beau-sejour',
    name: 'Beau-Séjour',
    commune: 'Libreville',
    label: 'Beau-Séjour, Libreville',
    lat: 0.409,
    lng: 9.475,
  },
  {
    id: 'lbv-dragages',
    name: 'Dragages',
    commune: 'Libreville',
    label: 'Dragages, Libreville',
    lat: 0.4125,
    lng: 9.484,
  },
  {
    id: 'lbv-nzeng-ayong',
    name: 'Nzeng-Ayong',
    commune: 'Libreville',
    label: 'Nzeng-Ayong, Libreville',
    lat: 0.3985,
    lng: 9.493,
    aliases: ['Nzeng Ayong'],
  },
  {
    id: 'lbv-nzeng-fin-goudron',
    name: 'Nzeng-Ayong Fin Goudron',
    commune: 'Libreville',
    label: 'Nzeng-Ayong Fin Goudron, Libreville',
    lat: 0.4045,
    lng: 9.4985,
  },
  {
    id: 'lbv-sotega',
    name: 'Sotega',
    commune: 'Libreville',
    label: 'Sotega, Libreville',
    lat: 0.3895,
    lng: 9.4785,
  },
  {
    id: 'lbv-cite-damas',
    name: 'Cité Damas',
    commune: 'Libreville',
    label: 'Cité Damas, Libreville',
    lat: 0.3755,
    lng: 9.4865,
    aliases: ['Damas'],
  },
  {
    id: 'lbv-cite-caisse',
    name: 'Cité de la Caisse',
    commune: 'Libreville',
    label: 'Cité de la Caisse, Libreville',
    lat: 0.3785,
    lng: 9.481,
  },
  {
    id: 'lbv-sibang',
    name: 'Sibang',
    commune: 'Libreville',
    label: 'Sibang, Libreville',
    lat: 0.3865,
    lng: 9.501,
  },
  {
    id: 'lbv-pk5',
    name: 'PK5',
    commune: 'Libreville',
    label: 'PK5, Libreville',
    lat: 0.3945,
    lng: 9.503,
  },
  {
    id: 'lbv-pk6',
    name: 'PK6',
    commune: 'Libreville',
    label: 'PK6, Libreville',
    lat: 0.392,
    lng: 9.512,
  },
  {
    id: 'lbv-pk7',
    name: 'PK7',
    commune: 'Libreville',
    label: 'PK7, Libreville',
    lat: 0.3895,
    lng: 9.521,
  },
  {
    id: 'lbv-pk8',
    name: 'PK8',
    commune: 'Libreville',
    label: 'PK8, Libreville',
    lat: 0.387,
    lng: 9.529,
  },
  {
    id: 'lbv-pk9',
    name: 'PK9',
    commune: 'Libreville',
    label: 'PK9, Libreville',
    lat: 0.3845,
    lng: 9.538,
  },
  {
    id: 'lbv-pk10',
    name: 'PK10',
    commune: 'Libreville',
    label: 'PK10, Libreville',
    lat: 0.3815,
    lng: 9.546,
  },
  {
    id: 'lbv-pk11',
    name: 'PK11',
    commune: 'Libreville',
    label: 'PK11, Libreville',
    lat: 0.3785,
    lng: 9.555,
  },
  {
    id: 'lbv-pk12',
    name: 'PK12',
    commune: 'Libreville',
    label: 'PK12, Libreville',
    lat: 0.375,
    lng: 9.564,
  },
  {
    id: 'lbv-mindoube-1',
    name: 'Mindoubé 1',
    commune: 'Libreville',
    label: 'Mindoubé 1, Libreville',
    lat: 0.364,
    lng: 9.515,
    aliases: ['Mindoube'],
  },
  {
    id: 'lbv-mindoube-2',
    name: 'Mindoubé 2',
    commune: 'Libreville',
    label: 'Mindoubé 2, Libreville',
    lat: 0.356,
    lng: 9.521,
  },
  {
    id: 'lbv-melen',
    name: 'Melen',
    commune: 'Libreville',
    label: 'Melen, Libreville',
    lat: 0.372,
    lng: 9.548,
  },

  // =========================================================================
  // COMMUNE D'OWENDO (Sud du Grand Libreville & Zone Portuaire)
  // =========================================================================
  {
    id: 'owendo-centre',
    name: 'Owendo Centre (Carrefour SNI)',
    commune: 'Owendo',
    label: 'Owendo Centre, Owendo',
    lat: 0.3185,
    lng: 9.5025,
    aliases: ['Owendo', 'Carrefour SNI'],
  },
  {
    id: 'owendo-sni',
    name: 'SNI Owendo',
    commune: 'Owendo',
    label: 'SNI Owendo, Owendo',
    lat: 0.3235,
    lng: 9.506,
  },
  {
    id: 'owendo-alenakiri',
    name: 'Alenakiri',
    commune: 'Owendo',
    label: 'Alenakiri, Owendo',
    lat: 0.3355,
    lng: 9.4945,
  },
  {
    id: 'owendo-barracuda',
    name: 'Barracuda',
    commune: 'Owendo',
    label: 'Barracuda, Owendo',
    lat: 0.339,
    lng: 9.4885,
  },
  {
    id: 'owendo-razel',
    name: 'Razel',
    commune: 'Owendo',
    label: 'Razel, Owendo',
    lat: 0.3315,
    lng: 9.498,
  },
  {
    id: 'owendo-soduco',
    name: 'Soduco',
    commune: 'Owendo',
    label: 'Soduco, Owendo',
    lat: 0.341,
    lng: 9.499,
  },
  {
    id: 'owendo-nomba',
    name: 'Nomba Domaine',
    commune: 'Owendo',
    label: 'Nomba Domaine, Owendo',
    lat: 0.311,
    lng: 9.514,
    aliases: ['Nomba'],
  },
  {
    id: 'owendo-port',
    name: 'Port d’Owendo (Setrag)',
    commune: 'Owendo',
    label: 'Port d’Owendo, Owendo',
    lat: 0.296,
    lng: 9.5085,
    aliases: ['Owendo Port', 'Setrag', 'OCTRA'],
  },
  {
    id: 'owendo-akournam-1',
    name: 'Akournam 1',
    commune: 'Owendo',
    label: 'Akournam 1, Owendo',
    lat: 0.3045,
    lng: 9.521,
  },
  {
    id: 'owendo-akournam-2',
    name: 'Akournam 2',
    commune: 'Owendo',
    label: 'Akournam 2, Owendo',
    lat: 0.2985,
    lng: 9.5295,
  },
  {
    id: 'owendo-awoungou',
    name: 'Awoungou',
    commune: 'Owendo',
    label: 'Awoungou, Owendo',
    lat: 0.328,
    lng: 9.513,
  },
  {
    id: 'owendo-igoumie',
    name: 'Igoumié',
    commune: 'Owendo',
    label: 'Igoumié, Owendo',
    lat: 0.342,
    lng: 9.526,
    aliases: ['Igoumie'],
  },
  {
    id: 'owendo-virie',
    name: 'Virié',
    commune: 'Owendo',
    label: 'Virié, Owendo',
    lat: 0.315,
    lng: 9.496,
    aliases: ['Virie'],
  },

  // =========================================================================
  // PÉRIPHÉRIE (Ntoum / Bikélé / Essassa)
  // =========================================================================
  {
    id: 'ntoum-bikele',
    name: 'Bikélé',
    commune: 'Ntoum',
    label: 'Bikélé, Grand Libreville',
    lat: 0.369,
    lng: 9.585,
    aliases: ['Bikele'],
  },
  {
    id: 'ntoum-essassa',
    name: 'Essassa',
    commune: 'Ntoum',
    label: 'Essassa, Ntoum',
    lat: 0.377,
    lng: 9.632,
  },
  {
    id: 'ntoum-nkoltang',
    name: 'Nkoltang',
    commune: 'Ntoum',
    label: 'Nkoltang, Ntoum',
    lat: 0.382,
    lng: 9.685,
  },
  {
    id: 'ntoum-centre',
    name: 'Ntoum Centre',
    commune: 'Ntoum',
    label: 'Ntoum Centre, Ntoum',
    lat: 0.388,
    lng: 9.761,
  },
];

export const QUARTIERS_BY_COMMUNE: Record<CommuneGrandLibreville, QuartierEntry[]> = {
  Akanda: QUARTIERS_GRAND_LIBREVILLE.filter((q) => q.commune === 'Akanda'),
  Libreville: QUARTIERS_GRAND_LIBREVILLE.filter((q) => q.commune === 'Libreville'),
  Owendo: QUARTIERS_GRAND_LIBREVILLE.filter((q) => q.commune === 'Owendo'),
  Ntoum: QUARTIERS_GRAND_LIBREVILLE.filter((q) => q.commune === 'Ntoum'),
};

/**
 * Calcule la distance réelle en kilomètres (formule de Haversine) entre deux points GPS.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isInsideGrandLibreville(lat: number, lng: number): boolean {
  return lat >= 0.22 && lat <= 0.68 && lng >= 9.28 && lng <= 9.88;
}

/**
 * Associe dynamiquement toute position GPS (lat, lng) au quartier exact le plus proche
 * dans la base locale d'Akanda, Libreville et Owendo.
 */
export function matchLocalQuartier(
  lat: number,
  lng: number
): { quartier: QuartierEntry; distanceKm: number; label: string } {
  let best = DEFAULT_QUARTIER;
  let bestDistKm = Number.POSITIVE_INFINITY;

  for (const q of QUARTIERS_GRAND_LIBREVILLE) {
    const dist = haversineDistanceKm(lat, lng, q.lat, q.lng);
    if (dist < bestDistKm) {
      bestDistKm = dist;
      best = q;
    }
  }

  return {
    quartier: best,
    distanceKm: bestDistKm,
    label: best.label,
  };
}

/**
 * Recherche un quartier connu par texte libre (nom ou alias).
 */
export function findQuartierByText(text?: string | null): QuartierEntry | null {
  if (!text) return null;
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  return (
    QUARTIERS_GRAND_LIBREVILLE.find((q) => {
      if (q.name.toLowerCase() === normalized || q.label.toLowerCase() === normalized) {
        return true;
      }
      if (normalized.includes(q.name.toLowerCase())) {
        return true;
      }
      return q.aliases?.some((alias) => normalized.includes(alias.toLowerCase())) ?? false;
    }) || null
  );
}
