'use strict';
/* Nivoculteur · réglages — tous les chiffres réglables
   Chargé par index.html avec une balise <script> classique (pas de module) : le jeu s'ouvre en double-cliquant. */

/* =====================================================================================
   1. CONFIG — tous les chiffres réglables du jeu
   Les valeurs sont provisoires : à remplacer par celles d'une vraie installation.
   ===================================================================================== */
const CONFIG = {
  // --- Coûts de construction, en euros ---
  couts: {
    trancheeEau: 750,       // € par mètre de tranchée avec une conduite d'eau seule
    trancheeCable: 550,     // € par mètre de tranchée avec un câble électrique seul
    trancheeCommune: 900,   // € par mètre de tranchée commune eau + câble (on ne creuse qu'une fois)
    trancheeAir: 650,       // € par mètre de tranchée avec une conduite d'air comprimé seule
    // Dans une tranchée déjà creusée (pour un autre réseau), on ne paie que la pose du nouveau réseau, par mètre :
    ajout: { eau: 350, cable: 150, air: 200 },
    regard: 5000,           // € pour un regard (chambre béton, vanne) ; l'enneigeur se paie en plus (CATALOGUE)
    reprise: 0.5,           // quand on remplace un enneigeur, l'ancien est repris à cette part de son prix
    revente: 0.5,           // quand on démonte un regard (et son enneigeur) ou un départ électrique : part du prix rendue
    repriseTranchee: 0.25,  // quand on retire une conduite ou un câble : part de son prix rendue
    deplacement: 3000,      // € pour déplacer un regard (on paie en plus les mètres de tranchée gagnés)
    departElec: 25000       // € pour un nouveau départ électrique (armoire raccordée au réseau)
  },

  // --- Argent gagné ---
  gains: {
    parM3Piste: 20          // € par m³ de neige tombée SUR la piste (la neige hors piste ne rapporte rien)
  },

  // --- Pression d'eau au regard ---
  // P_regard = P_pompes − pertes dues à la longueur − pertes dues à la montée − pertes dues au débit demandé
  pression: {
    pompes: 52,             // bar fournis par les pompes en marche, à la sortie de la salle de pompage
                            // (52 bar : environ 51 bar en bas de la piste et 33 bar tout en haut)
    perteLongueur: 0.6,     // bar perdus par tranche de 100 m de conduite (perte de charge)
    perteDenivele: 1.2,     // bar perdus par tranche de 10 m de montée (dans la réalité, environ 1 bar pour 10 m)
    perteDebit: 0.05,       // bar perdus par m³/h d'eau demandé par l'ensemble des canons ouverts (tous les débits sont en m³/h)
    // Chaque enneigeur a sa pression minimale et sa pression de pleine production (voir CATALOGUE).
    // Pour tous : au-dessus de 50 bar, pression haute (à surveiller) ; au-dessus de 55 bar, surpression (le canon se met en sécurité).
    zones: { correcte: 50, surpression: 55 },
    cadranMax: 80           // bar : graduation maximale des manomètres
  },

  // --- Salle de pompage ---
  // Courbe d'une pompe : pression au débit nominal (CONFIG.pression.pompes), plus haute quand on débite moins
  // (vanne fermée = pressionVanneFermee), et qui chute quand on demande plus que le débit nominal.
  pompage: {
    pompes: 3,              // nombre de pompes
    debitNominal: 180,      // m³/h que fournit chaque pompe à sa pression nominale
    pressionVanneFermee: 62,// bar quand la pompe tourne sans débit
    zoneVerte: [38, 54],    // bar : pression de départ conseillée (affichée en vert au poste de travail)
    puissance: 160          // kW consommés par chaque pompe en marche
  },

  // --- Air comprimé (perches) : compresseur et réservoir à côté de la salle de pompage ---
  air: {
    pressionNominale: 8,    // bar dans le réservoir quand le compresseur suffit
    capacite: 600,          // Nm³/h d'air que fournit le compresseur
    montee: 0.45,           // vitesse de montée en pression au démarrage (par seconde de jeu)
    fuite: 0.2,             // vitesse de baisse quand le compresseur est arrêté
    perteLongueur: 0.3,     // bar perdus par 100 m de conduite d'air
    pressionMin: 4,         // bar d'air minimum à la perche pour faire de la neige
    pressionPleine: 6,      // bar d'air pour une production complète
    puissance: 75           // kW consommés par le compresseur en marche
  },

  // --- Électricité ---
  electricite: {
    prixKwh: 0.18           // € par kWh (pompes et compresseur), retiré du gain de la nuit
  },

  // --- Pannes (niveau 4) : tirées au sort chaque nuit, toujours les mêmes pour une même nuit ---
  // cout : prix de la réparation (€) · duree : temps de l'équipe la nuit (s de jeu ; le jour, c'est immédiat)
  pannes: {
    parNuit: [1, 3],        // nombre de pannes par nuit (au hasard entre les deux)
    frequences: { rare: [0, 1], normale: [1, 3], forte: [3, 5] },   // bac à sable : nombre de pannes par nuit au choix
    moment: [12, 135],      // s de jeu : quand elles arrivent pendant la nuit
    types: {
      fuite:       { nom: 'Fuite sur une conduite', cout: 6000, duree: 30, poids: 2,
                     debit: 30,      // m³/h d'eau perdus par la fuite (la retenue se vide plus vite)
                     perte: 10 },    // bar perdus par les regards en aval de la fuite
      moteur:      { nom: 'Moteur de ventilateur grillé', cout: 2500, duree: 20, poids: 2 },
      gel:         { nom: 'Buse gelée sur une perche', cout: 300, duree: 10, poids: 2, facteur: 0.4 },   // production × 0,4
      disjoncteur: { nom: 'Disjoncteur déclenché', cout: 0, duree: 4, poids: 1 },
      pompe:       { nom: 'Pompe en défaut thermique', cout: 4000, duree: 40, poids: 1 }
    }
  },

  // --- Coup de bélier : une manœuvre trop rapide envoie un pic de pression dans les conduites ---
  belier: {
    fenetre: 1,             // s : on regarde la manœuvre de la vanne sur cette durée
    variationMax: 0.3,      // ouvrir ou fermer la vanne de plus de 30 % en 1 s (avec de l'eau qui circule) = coup de bélier
    ouvertureDemarrage: 0.3,// démarrer la première pompe (ou arrêter la dernière) vanne ouverte à plus de 30 % = coup de bélier
    reparation: 5000        // € de réparation par coup de bélier (niveaux avec budget)
  },

  // --- Construction du réseau ---
  construction: {
    ecartRegards: 12,       // m : distance minimale entre deux regards
    profondeur: 1.5         // m : profondeur des conduites et des câbles (affichage en vue sous-sol)
  },

  // --- Nuit ---
  nuit: {
    duree: 180,             // durée d'une nuit, en secondes de jeu (3 minutes)
    echelle: 240,           // 1 seconde de jeu = 240 secondes réelles (180 s de jeu = une nuit de 12 h)
    accelere: 3,            // vitesse avec le bouton « Accélérer » (ancien réglage, voir vitesses)
    vitesses: [1, 3, 10]    // le bouton de vitesse passe de l'une à l'autre (nuit et journée)
  },

  // --- Vent (tiré au sort pour chaque nuit, annoncé la veille) ---
  vent: {
    forceMax: 35,           // km/h
    vitesseChute: 1.0,      // m/s : vitesse à laquelle les flocons tombent
    entrainement: 0.5       // part de la vitesse du vent prise par les flocons pendant leur chute
  },

  // --- Retenue d'eau ---
  retenue: {
    remplissageJour: 3000,  // m³ d'eau remis dans la retenue chaque jour (captage, ruisseau) : réglage de départ
    choix: [0, 1500, 3000, 4500],   // volumes qu'on peut commander au poste de travail (m³ par jour)
    prixM3: 0.5             // € par m³ d'eau prélevée et remontée dans la retenue
  },

  // --- Progression ---
  progression: {
    toutOuvert: true        // pendant la mise au point : tous les niveaux sont jouables sans avoir réussi le précédent
  },

  // --- Caméra ---
  camera: {
    distanceDepart: 390,    // m entre la caméra et le point regardé au lancement
    distanceMin: 20,        // zoom le plus proche (m)
    distanceMax: 750,       // zoom le plus lointain (m)
    inclinaisonDepart: 16,  // degrés au-dessus de l'horizon au lancement
    inclinaisonMin: 4,      // degrés
    inclinaisonMax: 84,     // degrés
    sensibiliteRotation: 0.006,
    sensibiliteDeplacement: 0.0017,
    douceur: 12             // plus c'est grand, plus la caméra suit vite le doigt
  },

  // --- Graphismes (baisser ces nombres si le téléphone rame) ---
  graphismes: {
    ombres: true,           // ombres des sapins sous la lune
    tailleOmbres: 2048,     // précision des ombres (1024 = plus rapide)
    sapins: 750,
    rochers: 80,
    etoiles: 900,
    pixelRatioMax: 2,       // limite la finesse d'affichage sur les écrans très denses
    flocons: 1600,          // nombre maximal de flocons affichés en même temps
    distanceEtiquettes: 170 // m : plus loin, les noms des bâtiments deviennent de petits carrés de couleur
  },

  // --- Bac à sable : tracer des pistes et poser des remontées ---
  bac: {
    prixPiste: 250,         // € par mètre de piste (seulement quand l'argent n'est pas illimité)
    prixRemontee: 2500,     // € par mètre de télésiège
    largeurs: [20, 30, 40], // m : largeurs de piste au choix
    pisteMin: 80,           // m : longueur minimale d'une piste
    remontee: [120, 600]    // m : longueur d'un télésiège (au moins, au plus)
  },

  // --- Dameuse (passe sur la piste quand l'objectif est atteint) ---
  dameuse: {
    vitesse: 30,            // m/s : vitesse de la dameuse pendant sa tournée du matin (accélérée pour le jeu)
    reprise: 0.25           // quand on change de dameuse, l'ancienne est reprise à cette part de son prix
  },

  // --- Remontées mécaniques (activées par le joueur ; les clients viendront plus tard) ---
  remontees: {
    kwParMetre: 0.35,       // kW consommés par mètre de télésiège quand il tourne
    heuresJour: 8,          // heures d'ouverture par jour
    vitesse: 5              // m/s : défilement des sièges en 3D
  },

  // --- Terrassement des pistes tracées : le dévers est corrigé (0 = rien, 1 = piste parfaitement à plat en travers) ---
  terrassement: { force: 0.75, talus: 10 },   // talus : m de raccord au terrain naturel de chaque côté

  // --- Couleur d'une piste selon sa pente la plus forte (sur 30 m), en % ---
  couleursPistes: { verte: 25, bleue: 42, rouge: 55 }   // au-delà de 55 % : noire
};

/* -------------------------------------------------------------------------------------
   Dameuses (noms inventés, inspirées des grandes dameuses à lame avant et fraise arrière)
   capacite : m³ de neige des tas étalés sur la piste par jour · prix : € · largeur : m de la fraise
   On part toujours avec une DM 400 rangée au garage ; la DM 600 étale deux fois plus, mais coûte très cher.
   ------------------------------------------------------------------------------------- */
const DAMEUSES = {
  dm400: { nom: 'Dameuse DM 400', capacite: 3500, prix: 300000, largeur: 5.6, echelle: 1, surface: 60000, conso: 180 },
  dm600: { nom: 'Dameuse DM 600', capacite: 7000, prix: 480000, largeur: 6.6, echelle: 1.16, surface: 120000, conso: 260 }
};
// surface : m² de pistes damés par jour (mode Exploitation) · conso : litres de gazole pour une journée de travail complète

/* -------------------------------------------------------------------------------------
   Mode EXPLOITATION : une station de ski qui tourne, saison après saison.
   La nuit on fait la neige, le matin la dameuse étale et dame, la journée les clients skient.
   But : la meilleure satisfaction des clients. L'argent vient des forfaits et des dépenses des skieurs.
   ------------------------------------------------------------------------------------- */
CONFIG.exploitation = {
  budgetDepart: 1500000,
  joursSaison: 20,
  enneigementDepart: 20,      // cm de neige naturelle sur les pistes au début de la saison
  ouverture: 30,              // cm : en dessous, la piste reste fermée
  ideal: 60,                  // cm : enneigement parfait pour les clients (+5 cm chaque saison)
  usure: 1.5,                 // cm perdus par jour d'ouverture
  usureClients: 1,            // cm perdus en plus pour 1 000 skieurs sur une piste
  neigeNaturelle: { chance: 0.25, min: 8, max: 20 },   // chute de neige pendant la nuit (au hasard)
  clientsBase: 1200,          // clients d'une journée moyenne avec deux bonnes pistes
  croissance: 1.12,           // chaque saison, la clientèle grandit (et elle est plus exigeante)
  calendrier: [0.5, 0.6, 0.7, 1.2, 1.3, 0.7, 0.8, 1.0, 1.5, 1.6, 1.6, 1.5, 1.4, 0.8, 0.9, 1.2, 1.4, 1.0, 0.9, 1.3],   // affluence selon le jour (vacances, week-ends)
  prixReference: 45, prixMin: 20, prixMax: 80, prixDepart: 42,   // € le forfait journée
  depensesClient: 14,         // € dépensés en plus par skieur (restaurant, location, boutique)
  tours: 8,                   // montées en remontée par skieur et par jour
  heuresOuverture: 8,
  debitTelesiege: 1800,       // personnes par heure pour un télésiège 4 places
  agentsParRemontee: 2,
  desserte: 230,              // m : une piste est desservie si son départ est à moins de 230 m de l'arrivée d'une remontée
  dureeJour: 300,             // s de jeu pour une journée de ski (5 minutes)
  panneRemontee: 0.12,        // chance qu'une remontée en marche tombe en panne pendant une journée
  carburant: { prix: 1.6, cuve: 6000, depart: 3000 },   // € par litre de gazole, litres que contient la cuve du garage
  reputationDepart: 0.8,
  nivoculteurCanons: 12,      // canons qu'un nivoculteur fait tourner la nuit
  clientsParCaissier: 500,
  // Secours sur piste : les débutants des pistes faciles se blessent plus souvent, mais un secours y est facturé moins cher
  secours: {
    part:   { verte: 1.5, bleue: 1.2, rouge: 0.8, noire: 0.5 },   // fréquentation relative d'une piste selon sa couleur
    taux:   { verte: 8,   bleue: 5,   rouge: 3,   noire: 2.5 },   // blessés pour 1 000 skieurs sur la piste
    prix:   { verte: 220, bleue: 320, rouge: 480, noire: 650 },   // € facturés par secours (payés par l'assurance du blessé)
    duree:  { verte: 20,  bleue: 25,  rouge: 30,  noire: 35 },    // s de jeu pour un secours (un pisteur occupé)
    attenteMax: 30            // s de jeu : un blessé secouru plus tard attend trop (la sécurité baisse)
  }
};
CONFIG.pannes.types.remontee = { nom: 'Panne de télésiège', cout: 3500, duree: 40, poids: 0 };   // en journée seulement
// Personnel : effectif de départ, salaire par jour (€) et rôle
const METIERS = {
  nivoculteur: { nom: 'Nivoculteurs', salaire: 160, depart: 2, role: `font tourner les canons la nuit (${CONFIG.exploitation.nivoculteurCanons} canons chacun)` },
  conducteur: { nom: 'Conducteurs de dameuse', salaire: 170, depart: 1, role: 'sans conducteur, la dameuse ne sort pas ; un 2e double le travail (+60 %)' },
  agent: { nom: 'Agents des remontées', salaire: 130, depart: 2, role: `${CONFIG.exploitation.agentsParRemontee} par remontée ouverte` },
  pisteur: { nom: 'Pisteurs-secouristes', salaire: 150, depart: 2, role: 'surveillent les pistes et secourent les blessés (un secours à la fois chacun)' },
  technicien: { nom: 'Techniciens de maintenance', salaire: 170, depart: 1, role: 'réparent les pannes plus vite' },
  caissier: { nom: 'Caissiers', salaire: 120, depart: 2, role: `1 pour ${CONFIG.exploitation.clientsParCaissier} clients par jour` }
};

/* -------------------------------------------------------------------------------------
   Catalogue des enneigeurs (noms inventés, inspirés des gammes du marché)
   prix : € · debit : m³ d'eau par heure · air : Nm³/h d'air comprimé (perches) · pressionMin : en dessous, pas de neige
   pressionPleine : à partir de là, production complète · neige : m³ de neige par heure à pleine production (une nuit = 12 h)
   portee : m (distance où tombe la neige) · debloque : niveau, et m³ de neige déjà faits sur les pistes
   ------------------------------------------------------------------------------------- */
const CATALOGUE = {
  v8:   { nom: 'Ventilateur V8', type: 'ventilateur', prix: 10000, debit: 22,  pressionMin: 8,  pressionPleine: 20, neige: 35, portee: 22, taille: 0.85, debloque: { niveau: 2, m3: 0 } },
  v9:   { nom: 'Ventilateur V9', type: 'ventilateur', prix: 18000, debit: 36,  pressionMin: 8,  pressionPleine: 22, neige: 55, portee: 27, taille: 1.0,  debloque: { niveau: 2, m3: 5000 } },
  v10:  { nom: 'Ventilateur V10', type: 'ventilateur', prix: 28000, debit: 54, pressionMin: 8,  pressionPleine: 24, neige: 80, portee: 32, taille: 1.15, debloque: { niveau: 2, m3: 15000 } },
  p6:   { nom: 'Perche 6 m', type: 'perche', prix: 5000,  debit: 11,  air: 60, pressionMin: 18, pressionPleine: 28, neige: 15, portee: 7, longueur: 6,  debloque: { niveau: 3, m3: 0 } },
  p10:  { nom: 'Perche 10 m', type: 'perche', prix: 7000,  debit: 13,  air: 70, pressionMin: 18, pressionPleine: 28, neige: 18, portee: 9, longueur: 10, debloque: { niveau: 3, m3: 0 } },
  p10n: { nom: 'Perche 10 m nouvelle génération', type: 'perche', prix: 10000, debit: 13,  air: 30, pressionMin: 14, pressionPleine: 22, neige: 18, portee: 9, longueur: 10, peuDAir: true, debloque: { niveau: 3, m3: 10000 } }
};

// Perches : posées sur un petit support vertical, inclinées, la tête projette vers l'avant (pas tout autour)
const PERCHE = {
  support: 1.5,             // m : hauteur du support vertical
  penche: 30,               // degrés : inclinaison de la perche depuis la verticale
  eventail: 30              // degrés : ouverture maximale du jet de la tête de buses
};

// Supports des ventilateurs : plus haut = envoie plus loin, mais le vent déporte davantage la neige
const SUPPORTS = {
  trepied:   { nom: 'Trépied', prix: 0,    pivot: 1.15, portee: 1 },
  tour:      { nom: 'Tour', prix: 4000,    pivot: 3.2,  portee: 1.12 },
  tourHaute: { nom: 'Tour haute (+3 m)', prix: 7000, pivot: 6.2, portee: 1.25 }
};
