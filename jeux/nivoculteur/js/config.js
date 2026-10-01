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
    regard: 5000,           // € pour un regard (chambre béton, vanne) ; l'enneigeur se paie en plus (CATALOGUE)
    reprise: 0.5            // quand on remplace un enneigeur, l'ancien est repris à cette part de son prix
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
    perteDebit: 0.05,       // bar perdus par m³/h d'eau demandé par l'ensemble des canons ouverts
    // Chaque enneigeur a sa pression minimale et sa pression de pleine production (voir CATALOGUE).
    // Pour tous : au-dessus de 50 bar, pression haute (à surveiller) ; au-dessus de 55 bar, surpression (le canon se met en sécurité).
    zones: { correcte: 50, surpression: 55 },
    cadranMax: 80           // bar : graduation maximale des manomètres
  },

  // --- Construction du réseau ---
  construction: {
    ecartRegards: 12,       // m : distance minimale entre deux regards
    profondeur: 1.5         // m : profondeur des conduites et des câbles (affichage en vue sous-sol)
  },

  // --- Nuit ---
  nuit: {
    duree: 40,              // durée d'une nuit, en secondes de jeu
    echelle: 1080,          // 1 seconde de jeu = 1 080 secondes réelles (40 s de jeu = une nuit de 12 h)
    accelere: 3             // vitesse avec le bouton « Accélérer »
  },

  // --- Vent (tiré au sort pour chaque nuit, annoncé la veille) ---
  vent: {
    forceMax: 35,           // km/h
    vitesseChute: 1.0,      // m/s : vitesse à laquelle les flocons tombent
    entrainement: 0.5       // part de la vitesse du vent prise par les flocons pendant leur chute
  },

  // --- Retenue d'eau ---
  retenue: {
    remplissageJour: 3000   // m³ d'eau qui reviennent dans la retenue chaque jour (captage, ruisseau)
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
    flocons: 1600           // nombre maximal de flocons affichés en même temps
  }
};

/* -------------------------------------------------------------------------------------
   Catalogue des enneigeurs (noms inventés, inspirés des gammes du marché)
   prix : € · debit : litres d'eau par seconde · pressionMin : en dessous, pas de neige
   pressionPleine : à partir de là, production complète · neige : m³ de neige par seconde de jeu à pleine production
   portee : m (distance où tombe la neige) · debloque : niveau, et m³ de neige déjà faits sur les pistes
   ------------------------------------------------------------------------------------- */
const CATALOGUE = {
  v8:   { nom: 'Ventilateur V8', type: 'ventilateur', prix: 10000, debit: 6,   pressionMin: 8,  pressionPleine: 20, neige: 10,    portee: 22, taille: 0.85, debloque: { niveau: 2, m3: 0 } },
  v9:   { nom: 'Ventilateur V9', type: 'ventilateur', prix: 18000, debit: 10,  pressionMin: 8,  pressionPleine: 22, neige: 16.25, portee: 27, taille: 1.0,  debloque: { niveau: 2, m3: 5000 } },
  v10:  { nom: 'Ventilateur V10', type: 'ventilateur', prix: 28000, debit: 15, pressionMin: 8,  pressionPleine: 24, neige: 23.75, portee: 32, taille: 1.15, debloque: { niveau: 2, m3: 15000 } },
  p6:   { nom: 'Perche 6 m', type: 'perche', prix: 5000,  debit: 3,   pressionMin: 18, pressionPleine: 28, neige: 4.5, portee: 7, longueur: 6,  debloque: { niveau: 3, m3: 0 } },
  p10:  { nom: 'Perche 10 m', type: 'perche', prix: 7000,  debit: 3.5, pressionMin: 18, pressionPleine: 28, neige: 5.5, portee: 9, longueur: 10, debloque: { niveau: 3, m3: 0 } },
  p10n: { nom: 'Perche 10 m nouvelle génération', type: 'perche', prix: 10000, debit: 3.5, pressionMin: 14, pressionPleine: 22, neige: 5.5, portee: 9, longueur: 10, peuDAir: true, debloque: { niveau: 3, m3: 10000 } }
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
