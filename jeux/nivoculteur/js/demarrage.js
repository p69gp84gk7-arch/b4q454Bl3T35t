'use strict';
/* Nivoculteur · démarrage — lancé en dernier, choisit le mode
   Chargé par index.html avec une balise <script> classique (pas de module) : le jeu s'ouvre en double-cliquant. */

const params = new URLSearchParams(location.search);
const MODE_TEST = params.has('test');
const MODE_MODELES = params.has('modeles');
// Le niveau vient de l'adresse (index.html?niveau=reseau) ; sans niveau, on ouvre le menu devant le dernier niveau joué
const progressionSauvee = lireSauvegarde('nivo-progression') || {};
const OUVRIR_MENU = !params.get('niveau') && !MODE_MODELES;
const niveau = trouverNiveau(params.get('niveau')) || trouverNiveau(progressionSauvee.dernier) || LEVELS[0];

// Bac à sable : les pistes et télésièges du joueur font partie du terrain (à ajouter avant de le construire)
if((niveau.bac || niveau.carriere || niveau.exploitation) && !params.has('nouvelle')){
  const partie = lireSauvegarde(`nivo-partie-${niveau.id}`);
  if(partie && partie.reseau) amenager(niveau, partie.reseau);
}

if(MODE_TEST) afficherTests(testsSimulation());

if(!window.THREE){
  afficherErreur('Three.js n\'a pas pu être chargé. Vérifiez que le fichier <b>three.min.js</b> est bien à côté de <b>index.html</b>, ou que l\'appareil est connecté à internet.');
} else if(MODE_MODELES){
  demarrerVitrine();
} else {
  demarrer();
}
