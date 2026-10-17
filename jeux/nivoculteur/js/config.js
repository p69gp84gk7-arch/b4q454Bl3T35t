'use strict';
/* Nivoculteur 2D · réglages — tous les chiffres réglables
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
    trancheeAir: 650,       // € par mètre de tranchée avec une conduite d'air comprimé seule (étape 2)
    // Dans une tranchée déjà creusée (pour un autre réseau), on ne paie que la pose du nouveau réseau, par mètre :
    ajout: { eau: 350, cable: 150, air: 200 },
    regard: 5000,           // € pour un regard (chambre béton, vanne) ; l'enneigeur se paie en plus (CATALOGUE)
    reprise: 0.5,           // quand on remplace un enneigeur, l'ancien est repris à cette part de son prix
    revente: 0.5,           // quand on démonte un regard (et son enneigeur) : part du prix rendue
    repriseTranchee: 0.25   // quand on retire une conduite ou un câble : part de son prix rendue
  },

  // --- Argent gagné ---
  gains: {
    parM3Piste: 20          // € par m³ de neige tombée SUR une piste (la neige hors piste ne rapporte rien)
  },

  // --- Pression d'eau au regard ---
  // P_regard = P_pompes − pertes dues à la longueur − pertes dues à la montée − pertes dues au débit demandé
  pression: {
    perteLongueur: 0.6,     // bar perdus par tranche de 100 m de conduite (perte de charge)
    perteDenivele: 1.2,     // bar perdus par tranche de 10 m de montée (un regard plus bas que la salle en gagne)
    perteDebit: 0.05,       // bar perdus par m³/h d'eau demandé par l'ensemble des canons ouverts
    production: 0.35,       // part de la production à la pression minimale (100 % à la pression pleine)
    zones: { correcte: 50, surpression: 55 },   // au-dessus de 55 bar, le canon se met en sécurité
    cadranMax: 80           // bar : graduation maximale des jauges
  },

  // --- Salle des machines (salle de pompage) ---
  // Courbe d'une pompe : 62 bar sans débit, 52 bar au débit nominal, la pression chute au-delà.
  pompage: {
    pompes: 3,              // nombre de pompes
    debitNominal: 180,      // m³/h que fournit chaque pompe à sa pression nominale
    pressionNominale: 52,   // bar au débit nominal
    pressionVanneFermee: 62,// bar quand la pompe tourne sans débit
    zoneVerte: [38, 54],    // bar : pression de départ conseillée
    puissance: 160          // kW consommés par chaque pompe en marche
  },

  // --- Électricité et eau ---
  electricite: { prixKwh: 0.18 },          // € par kWh (pompes), retiré du gain de la nuit
  retenue: {
    remplissageJour: 3000,  // m³ remis dans la retenue chaque jour (captage, ruisseau)
    choix: [0, 1500, 3000, 4500],   // volumes qu'on peut commander à la salle des machines (m³ par jour)
    prixM3: 0.5             // € par m³ remonté dans la retenue
  },

  // --- Température humide : c'est elle qui décide si l'on peut faire de la neige ---
  temperature: {
    debut: -2,              // °C humide : en dessous, un ventilateur commence à produire
    moitie: -4,             // °C : production à moitié
    pleine: -7,             // °C : production complète à cette température et plus froid
    gradient: 0.6,          // °C perdus par 100 m de montée (plus haut = plus froid)
    // Nuits tirées au sort : température de 18 h, minimum (vers 4 h du matin), chance d'un redoux en cours de nuit
    soir: [-4, 0], minimum: [-13, -5], redoux: 0.2, forceRedoux: [3, 6]
  },

  // --- Vent (tiré au sort pour chaque nuit, annoncé la veille ; il tourne pendant la nuit) ---
  vent: {
    forceMax: 35,           // km/h
    changements: [1, 3],    // nombre de sautes de vent pendant la nuit
    rotationMax: 70,        // degrés : de combien il peut tourner à chaque saute
    vitesseChute: 1.0,      // m/s : vitesse à laquelle les flocons tombent
    entrainement: 0.5       // part de la vitesse du vent prise par les flocons pendant leur chute
  },

  // --- Nuit ---
  nuit: {
    duree: 180,             // durée d'une nuit, en secondes de jeu (3 minutes), affichée de 18 h à 6 h
    vitesses: [1, 3, 10]    // le bouton de vitesse passe de l'une à l'autre
  },

  // --- Construction du réseau ---
  construction: {
    ecartRegards: 12        // m : distance minimale entre deux regards
  },

  // --- Domaines tirés au sort ---
  // taille : [largeur, hauteur] du domaine (m) · denivele : m entre le bas et le haut · pistes : nombre
  // budget : € au départ · nuits : nombre de nuits pour atteindre l'objectif · objectif : m³ sur les pistes
  domaines: {
    petit: { nom: 'Petit domaine', taille: [340, 520], denivele: [110, 190], pistes: [1, 2], budget: 450000, nuits: 5, objectif: 7000, retenue: 10000 },
    moyen: { nom: 'Domaine moyen', taille: [440, 640], denivele: [150, 250], pistes: [2, 2], budget: 700000, nuits: 5, objectif: 12000, retenue: 13000 },
    grand: { nom: 'Grand domaine', taille: [540, 760], denivele: [190, 300], pistes: [2, 3], budget: 1000000, nuits: 6, objectif: 20000, retenue: 16000 }
  },
  etoiles: [1, 1.25, 1.5]   // part de l'objectif pour 1, 2 et 3 étoiles
};

/* -------------------------------------------------------------------------------------
   Catalogue des enneigeurs (noms inventés, inspirés des gammes du marché)
   prix : € · debit : m³ d'eau par heure · pressionMin : en dessous, pas de neige · pressionPleine : production complète
   neige : m³ de neige par heure à pleine production (une nuit = 12 h) · portee : m (distance où tombe la neige)
   debloque : m³ de neige déjà mis sur les pistes dans la partie
   ------------------------------------------------------------------------------------- */
const CATALOGUE = {
  v8:  { nom: 'Ventilateur V8', court: 'V8', type: 'ventilateur', prix: 10000, debit: 22, pressionMin: 8, pressionPleine: 20, neige: 35, portee: 22, debloque: 0 },
  v9:  { nom: 'Ventilateur V9', court: 'V9', type: 'ventilateur', prix: 18000, debit: 36, pressionMin: 8, pressionPleine: 22, neige: 55, portee: 27, debloque: 5000 },
  v10: { nom: 'Ventilateur V10', court: 'V10', type: 'ventilateur', prix: 28000, debit: 54, pressionMin: 8, pressionPleine: 24, neige: 80, portee: 32, debloque: 15000 }
};

// Supports des ventilateurs : plus haut = envoie plus loin, mais le vent déporte davantage la neige
const SUPPORTS = {
  trepied:   { nom: 'Trépied', prix: 0,    hauteur: 1.2, portee: 1 },
  tour:      { nom: 'Tour', prix: 4000,    hauteur: 3.2, portee: 1.12 },
  tourHaute: { nom: 'Tour haute (+3 m)', prix: 7000, hauteur: 6.2, portee: 1.25 }
};
