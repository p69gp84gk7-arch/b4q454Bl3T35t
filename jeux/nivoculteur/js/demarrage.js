'use strict';
/* Nivoculteur · démarrage — lancé en dernier, choisit le mode
   Chargé par index.html avec une balise <script> classique (pas de module) : le jeu s'ouvre en double-cliquant. */

const params = new URLSearchParams(location.search);
const MODE_TEST = params.has('test');
const MODE_MODELES = params.has('modeles');
const niveau = LEVELS[1];

if(MODE_TEST) afficherTests(testsSimulation());

if(!window.THREE){
  afficherErreur('Three.js n\'a pas pu être chargé. Vérifiez que le fichier <b>three.min.js</b> est bien à côté de <b>index.html</b>, ou que l\'appareil est connecté à internet.');
} else if(MODE_MODELES){
  demarrerVitrine();
} else {
  demarrer();
}
