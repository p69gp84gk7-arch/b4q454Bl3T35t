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

// Garage des dameuses : en bas du domaine, porte tournée vers le haut de la pente
const GARAGE_COMBE = { nom: 'Garage des dameuses', x: 64, z: 230, rayon: 13, talus: 10 };

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
    { ...TELESIEGE_CLARINES.amont, rayon: 10, talus: 12 },
    GARAGE_COMBE
  ],
  graine: 7,                // change la forme des petites bosses et la place des sapins
  maille: 6,                // m : taille des facettes du terrain en 3D près de la zone de jeu
  marge: 60,                // m de terrain fin (petites facettes) autour de la zone de jeu
  etendue: 1600             // m : le décor s'étend jusque-là dans chaque direction
};

// Grand domaine (carrière et bac à sable) : la combe deux fois plus large, avec un versant doux à gauche
// (pistes vertes et bleues) et un versant raide à droite (pistes rouges et noires). Le milieu ne change presque pas.
const TERRAIN_DOMAINE = {
  ...TERRAIN_COMBE,
  largeur: 620,
  bords: 36,
  versants: { debut: 140, transition: 110, gauche: 0.5, droite: 1.65 },   // la pente est multipliée par ce nombre
  bosses: [
    ...TERRAIN_COMBE.bosses,
    { x: -230, z: -60, r: 60, h: 8 }, { x: -260, z: 150, r: 50, h: -5 }, { x: -200, z: 60, r: 40, h: 6 },
    { x: 230, z: -140, r: 55, h: 12 }, { x: 260, z: 90, r: 45, h: -8 }, { x: 210, z: 10, r: 35, h: 9 }
  ],
  montagnes: { hauteur: 560, distance: 420, recul: 60 }
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
    garage: GARAGE_COMBE,
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
    garage: GARAGE_COMBE,
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
    garage: GARAGE_COMBE,
    retenue: RETENUE_COMBE,
    remontees: [TELESIEGE_CLARINES],
    departsElec: [...DEPARTS_COMBE, { nom: 'Départ élec · Gentianes', x: -72, z: -150 }],
    compresseur: COMPRESSEUR_COMBE,
    budget: 700000,
    objectif: { type: 'neigePiste', m3: 20000 }
  },
  {
    id: 'pannes',
    numero: 4,
    nom: 'Les pannes et les réparations',
    resume: 'Les deux pistes sont équipées. Chaque nuit, des pannes arrivent : fuites, moteurs grillés, buses gelées, disjoncteurs, pompes. Repérez-les au poste de travail et envoyez l\'équipe réparer, avant la date d\'ouverture.',
    terrain: TERRAIN_COMBE,
    pistes: [PISTE_CLARINES, PISTE_GENTIANES],
    pompage: POMPAGE_COMBE,
    garage: GARAGE_COMBE,
    retenue: RETENUE_COMBE,
    remontees: [TELESIEGE_CLARINES],
    departsElec: [...DEPARTS_COMBE, { nom: 'Départ élec · Gentianes', x: -72, z: -150 }],
    compresseur: COMPRESSEUR_COMBE,
    budget: 120000,                           // pour les réparations (et quelques canons de plus)
    pannes: true,
    // Réseau déjà construit : 6 V10 sur tour aux Clarines (R1 à R6), 4 perches de 10 m aux Gentianes (R7 à R10)
    reseauFixe: {
      regards: [
        ...[[-19, 219], [27, 172], [-38, 151], [-10, 92], [-69, 63], [-12, 31]].map(([x, z]) => ({ x, z, modele: 'v10', support: 'tour' })),
        ...[[-79, 40], [-101, 0], [-104, -40], [-97, -80]].map(([x, z]) => ({ x, z, modele: 'p10' }))
      ],
      liaisons: {
        eau: [['pompage', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6'], ['R5', 'R7', 'R8', 'R9', 'R10']],
        cable: [['elec1', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6'], ['elec4', 'R10', 'R9', 'R8', 'R7']],
        air: [['compresseur', 'R3', 'R5', 'R7', 'R8', 'R9', 'R10']]
      }
    },
    objectif: { type: 'neigePiste', m3: 18000, nuits: 6 }
  },
  {
    id: 'bac',
    numero: '∞',
    bac: true,                                // bac à sable : tout débloqué, budget illimité, pas d'objectif
    nom: 'Bac à sable',
    resume: 'Tout est débloqué, le budget est illimité et il n\'y a pas d\'objectif. Construisez ce que vous voulez ; au poste de travail, choisissez le vent, activez les pannes, remplissez la retenue.',
    terrain: TERRAIN_DOMAINE,
    pistes: [PISTE_CLARINES, PISTE_GENTIANES],
    pompage: POMPAGE_COMBE,
    garage: GARAGE_COMBE,
    retenue: RETENUE_COMBE,
    remontees: [TELESIEGE_CLARINES],
    departsElec: [...DEPARTS_COMBE, { nom: 'Départ élec · Gentianes', x: -72, z: -150 }],
    compresseur: COMPRESSEUR_COMBE,
    budget: 1e9,
    objectif: { type: 'libre' }
  },
  {
    id: 'exploitation',
    numero: '❄',
    exploitation: true,                       // station de ski : canons, damage, remontées, clients, administration
    nom: 'Exploitation de la station',
    resume: 'Faites tourner toute la station, saison après saison : la neige la nuit, le damage le matin, les skieurs la journée. Gérez le personnel, le prix du forfait et le gazole des dameuses. But : la meilleure satisfaction des clients.',
    terrain: TERRAIN_DOMAINE,
    pistes: [PISTE_CLARINES, PISTE_GENTIANES],
    pompage: POMPAGE_COMBE,
    garage: GARAGE_COMBE,
    retenue: RETENUE_COMBE,
    remontees: [TELESIEGE_CLARINES],
    departsElec: [...DEPARTS_COMBE, { nom: 'Départ élec · Gentianes', x: -72, z: -150 }],
    compresseur: COMPRESSEUR_COMBE,
    budget: 1500000,
    pannes: true, frequencePannes: 'rare',     // la nuit, quelques pannes (canons, conduites, pompes) ; le jour, celles des télésièges
    objectif: { type: 'exploitation' }
  }
];

/* -------------------------------------------------------------------------------------
   CARRIÈRE : une seule station qui grandit, étape par étape. Le réseau et l'argent sont gardés
   d'une étape à l'autre. Chaque étape demande des m³ sur les pistes ET des recettes nettes
   (neige vendue moins électricité et eau) en un nombre de nuits ; réussie, elle débloque du matériel.
   Pour régler la difficulté : changer les chiffres ci-dessous, sans toucher au reste du code.
   debloque : pompes (nombre installé), enneigeurs, supports, departs (nombre de départs électriques),
              pistes, compresseur, remplissageMax (m³ par jour)
   Au début d'une étape : prime (€ offerts), pannes (types possibles), frequencePannes, ventFort,
              retenueDebut (hauteur d'eau 0 à 1), prixEau (€/m³)
   ------------------------------------------------------------------------------------- */
const PISTES_CARRIERE = { clarines: PISTE_CLARINES, gentianes: PISTE_GENTIANES };
const DEPARTS_CARRIERE = [...DEPARTS_COMBE, { nom: 'Départ élec · Gentianes', x: -72, z: -150 }];
const TOUTES_PANNES = ['disjoncteur', 'gel', 'moteur', 'fuite', 'pompe'];
const CARRIERE = {
  budgetDepart: 150000,
  materielDepart: { pompes: 1, enneigeurs: ['v8'], supports: ['trepied'], departs: 1, pistes: ['clarines'], compresseur: false, remplissageMax: 3000 },
  etapes: [
    // Saison 1 : la piste bleue des Clarines
    { nom: 'Le premier enneigeur', resume: 'Une pompe, des ventilateurs V8 sur trépied et le départ électrique de la salle de pompage : enneigez le bas de la piste bleue.',
      objectif: { m3: 1500, recette: 15000, nuits: 4 }, debloque: { supports: ['tour'] } },
    { nom: 'Monter sur la tour', resume: 'Sur une tour, le canon envoie plus loin : de quoi couvrir la largeur de la piste.',
      objectif: { m3: 3000, recette: 30000, nuits: 4 }, debloque: { pompes: 2, departs: 2 } },
    { nom: 'Plus de débit', resume: 'Une deuxième pompe et le départ électrique de la gare aval : allongez le réseau.',
      objectif: { m3: 4500, recette: 45000, nuits: 4 }, debloque: { enneigeurs: ['v9'] } },
    { nom: 'Le haut de la piste', resume: 'Le ventilateur V9 souffle plus de neige. Montez vers le haut de la piste.',
      objectif: { m3: 6000, recette: 65000, nuits: 5 }, debloque: { departs: 3, supports: ['tourHaute'] } },
    { nom: 'Le vent', resume: 'La tour haute porte loin mais le vent déporte davantage : orientez bien vos canons.',
      objectif: { m3: 8000, recette: 90000, nuits: 5 }, debloque: { pompes: 3 } },
    { nom: 'Pleine pression', resume: 'Trois pompes : de quoi alimenter beaucoup de canons sans perdre de pression.',
      objectif: { m3: 10000, recette: 120000, nuits: 5 }, debloque: { enneigeurs: ['v10'] } },
    { nom: 'L\'eau se paie', resume: 'La retenue démarre à moitié et l\'eau coûte deux fois plus cher : ne gaspillez pas.',
      retenueDebut: 0.5, prixEau: 1,
      objectif: { m3: 10000, recette: 130000, nuits: 5 },
      debloque: { remplissageMax: 4500, pistes: ['gentianes'], departs: 4, compresseur: true, enneigeurs: ['p6'] } },
    // Saison 2 : la piste rouge des Gentianes et l'air comprimé
    { nom: 'La piste rouge', resume: 'La piste rouge des Gentianes ouvre. Une prime de 200 000 € pour l\'équiper : perches, eau, électricité et air comprimé.',
      prime: 200000, objectif: { m3: 12000, recette: 160000, nuits: 5 }, debloque: { enneigeurs: ['p10'] } },
    { nom: 'Les perches de 10 m', resume: 'Plus hautes, elles portent plus loin sur la piste étroite.',
      objectif: { m3: 13000, recette: 180000, nuits: 5 }, debloque: { enneigeurs: ['p10n'] } },
    { nom: 'Économiser l\'air', resume: 'La perche nouvelle génération consomme deux fois moins d\'air : le compresseur suit mieux.',
      objectif: { m3: 14000, recette: 200000, nuits: 5 }, debloque: {} },
    // Saison 3 : les pannes, une à une
    { nom: 'Le disjoncteur', resume: 'Premières pannes : un départ électrique peut disjoncter. Réarmez-le vite (en haut à droite).',
      pannes: ['disjoncteur'], objectif: { m3: 14000, recette: 200000, nuits: 5 }, debloque: {} },
    { nom: 'Les buses gelées', resume: 'Une perche peut geler : elle fait moins de neige tant qu\'on ne l\'a pas dégivrée.',
      pannes: ['disjoncteur', 'gel'], objectif: { m3: 14500, recette: 205000, nuits: 5 }, debloque: {} },
    { nom: 'Les moteurs', resume: 'Un moteur de ventilateur peut griller : le canon s\'arrête jusqu\'à la réparation.',
      pannes: ['disjoncteur', 'gel', 'moteur'], objectif: { m3: 15000, recette: 210000, nuits: 5 }, debloque: {} },
    { nom: 'Les fuites', resume: 'Une conduite peut fuir : la pression chute en aval et la retenue se vide plus vite.',
      pannes: ['disjoncteur', 'gel', 'moteur', 'fuite'], objectif: { m3: 15000, recette: 210000, nuits: 5 }, debloque: {} },
    { nom: 'Les pompes', resume: 'Toutes les pannes, même celles des pompes. Gardez une pompe de réserve.',
      pannes: TOUTES_PANNES, objectif: { m3: 16000, recette: 225000, nuits: 5 }, debloque: {} },
    // Saison 4 : le grand jeu
    { nom: 'Ouverture anticipée', resume: 'La station ouvre plus tôt : moins de nuits pour enneiger.',
      pannes: TOUTES_PANNES, objectif: { m3: 13500, recette: 190000, nuits: 4 }, debloque: {} },
    { nom: 'Vents forts', resume: 'Une semaine de vent fort : orientez les canons pour que la neige tombe quand même sur les pistes.',
      pannes: TOUTES_PANNES, ventFort: true, objectif: { m3: 14000, recette: 195000, nuits: 5 }, debloque: {} },
    { nom: 'Sécheresse', resume: 'La retenue est presque vide et l\'eau est très chère.',
      pannes: TOUTES_PANNES, retenueDebut: 0.3, prixEau: 1.5, objectif: { m3: 14500, recette: 195000, nuits: 5 }, debloque: {} },
    { nom: 'La mauvaise série', resume: 'Tout casse en même temps : beaucoup de pannes chaque nuit.',
      pannes: TOUTES_PANNES, frequencePannes: 'forte', objectif: { m3: 14500, recette: 200000, nuits: 5 }, debloque: {} },
    { nom: 'La saison complète', resume: 'Le grand final : une longue série de nuits, toutes les pannes, des pistes à préparer pour l\'ouverture.',
      pannes: TOUTES_PANNES, objectif: { m3: 27000, recette: 380000, nuits: 8 }, debloque: {} }
  ]
};
// Matériel disponible au début de l'étape n° etape (0 = la première) : celui du départ plus tout ce qui a été débloqué avant
function materielCarriere(etape){
  const m = JSON.parse(JSON.stringify(CARRIERE.materielDepart));
  for(const e of CARRIERE.etapes.slice(0, etape)){
    const d = e.debloque || {};
    for(const k of ['enneigeurs', 'supports', 'pistes']) if(d[k]) m[k] = [...new Set([...m[k], ...d[k]])];
    for(const k of ['pompes', 'departs', 'remplissageMax']) if(d[k]) m[k] = Math.max(m[k], d[k]);
    if(d.compresseur) m.compresseur = true;
  }
  return m;
}
// Ce que débloque une étape, en mots
function nomsDeblocages(d = {}){
  const noms = [];
  if(d.pompes) noms.push(`${d.pompes}e pompe`);
  for(const k of d.enneigeurs || []) noms.push(CATALOGUE[k].nom);
  for(const k of d.supports || []) noms.push(`Ventilateurs sur ${SUPPORTS[k].nom.toLowerCase()}`);
  if(d.departs) noms.push(DEPARTS_CARRIERE[d.departs - 1].nom);
  for(const k of d.pistes || []) noms.push(`Piste ${PISTES_CARRIERE[k].couleur} « ${PISTES_CARRIERE[k].nom} »`);
  if(d.compresseur) noms.push('Compresseur d\'air');
  if(d.remplissageMax) noms.push(`Remplissage jusqu'à ${d.remplissageMax.toLocaleString('fr-FR')} m³ par jour`);
  return noms;
}
// Le « niveau » d'une étape de carrière : même forme que les niveaux de LEVELS
function niveauCarriere(etape){
  etape = Math.max(0, Math.min(CARRIERE.etapes.length - 1, etape || 0));
  const e = CARRIERE.etapes[etape], m = materielCarriere(etape);
  return {
    id: 'carriere', carriere: true, etape, numero: etape + 1, nom: e.nom, resume: e.resume,
    terrain: TERRAIN_DOMAINE,
    pistes: m.pistes.map(k => PISTES_CARRIERE[k]),
    pompage: POMPAGE_COMBE,
    garage: GARAGE_COMBE,
    retenue: RETENUE_COMBE,
    remontees: [TELESIEGE_CLARINES],
    departsElec: DEPARTS_CARRIERE.slice(0, m.departs),
    compresseur: m.compresseur ? COMPRESSEUR_COMBE : null,
    pompes: m.pompes, enneigeurs: m.enneigeurs, supports: m.supports, remplissageMax: m.remplissageMax,
    budget: CARRIERE.budgetDepart,
    pannes: e.pannes || null, frequencePannes: e.frequencePannes || null,
    ventFort: !!e.ventFort, prixEau: e.prixEau ?? null, retenueDebut: e.retenueDebut ?? null, prime: e.prime || 0,
    objectif: { type: 'carriere', ...e.objectif },
    debloque: e.debloque || {},
    derniere: etape === CARRIERE.etapes.length - 1
  };
}
// Carrière et bac à sable : ajoute au niveau les pistes tracées et les télésièges posés par le joueur (avant de construire la 3D)
function amenager(niveau, reseau){
  const base = niveau._base || (niveau._base = { pistes: niveau.pistes, remontees: niveau.remontees, terrain: niveau.terrain });   // jamais deux fois
  const pistes = reseau.pistesBac || [], remontees = reseau.remonteesBac || [];
  niveau.pistes = [...base.pistes, ...pistes];
  niveau.remontees = [...base.remontees, ...remontees];
  niveau.terrain = { ...base.terrain, replats: [...base.terrain.replats,
    ...remontees.flatMap(ts => [{ ...ts.aval, rayon: 10, talus: 12 }, { ...ts.amont, rayon: 10, talus: 12 }])] };
  return niveau;
}
const amenagerBac = amenager;
// Trouver un niveau par son identifiant (la carrière reprend à l'étape sauvegardée)
function trouverNiveau(id){
  if(id === 'carriere'){
    let etape = 0;
    try{ const p = JSON.parse(localStorage.getItem('nivo-partie-carriere')); etape = p && p.reseau && p.reseau.carriere ? p.reseau.carriere.etape : 0; }catch(e){}
    return niveauCarriere(etape);
  }
  return LEVELS.find(l => l.id === id) || null;
}
