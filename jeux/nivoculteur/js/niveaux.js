'use strict';
/* Nivoculteur · niveaux — description des niveaux
   Chargé par index.html avec une balise <script> classique (pas de module) : le jeu s'ouvre en double-cliquant. */

/* =====================================================================================
   2. LEVELS — description des niveaux
   Coordonnées en mètres. x : de gauche à droite. z : du haut de la pente (négatif) vers le bas (positif).
   Pour ajouter un niveau : copier un bloc et changer les valeurs, sans toucher au reste du code.
   ===================================================================================== */

const PISTE_CLARINES = {
  nom: 'Les Clarines',
  couleur: 'bleue',         // verte, bleue, rouge ou noire (couleur des jalons)
  largeur: 40,              // m
  points: [[-10, -250], [25, -180], [40, -110], [5, -40], [-40, 30], [-35, 100], [0, 170], [10, 250]]
};

// Retenue d'eau (lac artificiel) : un plateau creusé d'une cuvette, entouré d'une digue
const RETENUE_COMBE = {
  nom: 'Retenue des Clarines',
  x: -112, z: 146,
  rayon: 39,                // m : plateau autour du lac (digue comprise)
  talus: 26,                // m : raccord en pente douce avec le terrain naturel
  cuvette: { rayon: 32, profondeur: 7, digue: 1.2 },   // rayon du lac plein, profondeur au centre, hauteur de la digue (m)
  niveau: 0.85              // remplissage au départ (0 = vide, 1 = pleine)
};

// Salle de pompage, posée sur un replat (terrain aplani)
const POMPAGE_COMBE = { nom: 'Salle de pompage', x: -98, z: 208, rayon: 17, talus: 14, rotation: 0,
  sortie: { x: -90, z: 206.5 } };     // là où la conduite de départ sort du bâtiment

// Compresseur d'air (niveau 3) : à côté de la salle de pompage, sur le même replat
const COMPRESSEUR_COMBE = { nom: 'Compresseur', x: -111, z: 214, sortie: { x: -109, z: 219 } };

// Deuxième piste (niveau 3), rouge, à gauche : étroite, idéale pour les perches
const PISTE_GENTIANES = {
  nom: 'Les Gentianes',
  couleur: 'rouge',
  largeur: 28,
  points: [[-100, -248], [-112, -185], [-100, -120], [-122, -55], [-118, 5], [-78, 70]]
};

// Départs électriques : près des bâtiments (salle de pompage, gares du télésiège)
const DEPARTS_COMBE = [
  { nom: 'Départ élec · pompage', x: -80, z: 214 },
  { nom: 'Départ élec · gare aval', x: 95, z: 232 },
  { nom: 'Départ élec · gare amont', x: 83, z: -236 }
];

// Remontée mécanique (décor : elle ne tourne pas la nuit)
const TELESIEGE_CLARINES = {
  nom: 'Télésiège des Clarines',
  aval: { x: 112, z: 220 },   // gare de départ, en bas
  amont: { x: 98, z: -226 },  // gare d'arrivée, en haut
  pylones: 8,
  hauteur: 10,                // m : hauteur des pylônes
  ecart: 5,                   // m entre le câble montant et le câble descendant
  espacementSieges: 22        // m entre deux sièges
};

// Terrain partagé par les premiers niveaux : une combe de 300 m × 500 m et 150 m de dénivelé
const TERRAIN_COMBE = {
  largeur: 300,             // m, zone de jeu de gauche à droite
  longueur: 500,            // m, zone de jeu du bas au haut de la pente (à plat)
  altBas: 1650,             // altitude du bas de la zone de jeu (m)
  denivele: 150,            // m entre le bas et le haut
  bords: 24,                // m : les côtés de la combe remontent (pente en cuvette)
  rugosite: 1.6,            // m : petites bosses de la neige
  bosses: [                 // grosses bosses (h positif) ou creux (h négatif), r = rayon (m)
    { x: -85, z: -120, r: 45, h: 10 },
    { x: 95,  z: 30,   r: 55, h: 12 },
    { x: -30, z: 120,  r: 40, h: -6 },
    { x: 100, z: -185, r: 60, h: 14 },
    { x: -110, z: 60,  r: 35, h: 7 }
  ],
  // Montagnes du décor autour de la zone de jeu (hors jeu)
  montagnes: { hauteur: 520, distance: 380, recul: 60 },
  // Replats : endroits aplanis pour les bâtiments et la retenue
  replats: [
    RETENUE_COMBE,
    POMPAGE_COMBE,
    { ...TELESIEGE_CLARINES.aval, rayon: 10, talus: 12 },
    { ...TELESIEGE_CLARINES.amont, rayon: 10, talus: 12 }
  ],
  graine: 7,                // change la forme des petites bosses et la place des sapins
  maille: 6,                // m : taille des facettes du terrain en 3D près de la zone de jeu
  marge: 60,                // m de terrain fin (petites facettes) autour de la zone de jeu
  etendue: 1600             // m : le décor s'étend jusque-là dans chaque direction
};

const LEVELS = [
  {
    id: 'pompage',
    numero: 1,
    nom: 'La salle de pompage',
    resume: 'Le réseau est déjà construit. Démarrez les pompes et manœuvrez la vanne principale pour garder la pression dans le vert, sans coup de bélier, pendant que le chef d\'équipe ouvre les canons.',
    terrain: TERRAIN_COMBE,
    pistes: [PISTE_CLARINES],
    pompage: POMPAGE_COMBE,
    retenue: RETENUE_COMBE,
    retenueDepart: 0.6,                       // la retenue n'est pas pleine au départ (hauteur d'eau, 0 à 1)
    remontees: [TELESIEGE_CLARINES],
    departsElec: DEPARTS_COMBE,
    construction: false,                      // pas d'outils de construction : tout se joue au poste de travail
    budget: 0,
    // Six ventilateurs V10 sur tour, déjà raccordés à l'eau et à l'électricité
    reseauFixe: { regards: [[-19, 219], [27, 172], [-38, 151], [-10, 92], [-69, 63], [-12, 31]].map(([x, z]) => ({ x, z, modele: 'v10', support: 'tour' })) },
    // Programme de la nuit : le chef d'équipe ouvre puis ferme des canons (t en secondes de jeu)
    programme: [
      { t: 0,  ouvrir: ['R1', 'R2'], texte: 'Le chef d\'équipe ouvre les regards 1 et 2.' },
      { t: 12, ouvrir: ['R3', 'R4'], texte: 'Il fait plus froid : ouverture des regards 3 et 4.' },
      { t: 24, ouvrir: ['R5', 'R6'], texte: 'Ouverture des regards 5 et 6 : tout le réseau produit.' },
      { t: 45, fermer: ['R5', 'R6'], texte: 'Le vent tourne : fermeture des regards 5 et 6.' }
    ],
    objectif: { type: 'production', m3: 6000, nuits: 3, coupsMax: 2 }
  },
  {
    id: 'reseau',
    numero: 2,
    nom: 'Construire le réseau',
    resume: 'Poser les regards et les canons, tracer l\'eau et l\'électricité, puis produire de la neige sur la piste.',
    terrain: TERRAIN_COMBE,
    pistes: [PISTE_CLARINES],
    pompage: POMPAGE_COMBE,
    retenue: RETENUE_COMBE,
    remontees: [TELESIEGE_CLARINES],
    departsElec: DEPARTS_COMBE,
    budget: 650000,
    objectif: { type: 'neigePiste', m3: 30000 }
  },
  {
    id: 'air',
    numero: 3,
    nom: 'Les perches et l\'air comprimé',
    resume: 'Enneigez aussi la piste rouge des Gentianes avec des perches. Elles demandent de l\'eau, de l\'électricité et de l\'air comprimé : tracez les conduites d\'air depuis le compresseur et démarrez-le au poste de travail.',
    terrain: TERRAIN_COMBE,
    pistes: [PISTE_CLARINES, PISTE_GENTIANES],
    pompage: POMPAGE_COMBE,
    retenue: RETENUE_COMBE,
    remontees: [TELESIEGE_CLARINES],
    departsElec: [...DEPARTS_COMBE, { nom: 'Départ élec · Gentianes', x: -72, z: -150 }],
    compresseur: COMPRESSEUR_COMBE,
    budget: 700000,
    objectif: { type: 'neigePiste', m3: 20000 }
  }
];
