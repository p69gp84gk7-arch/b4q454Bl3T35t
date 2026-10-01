'use strict';
/* Nivoculteur · vitrine — les modèles 3D un par un (index.html?modeles)
   Chargé par index.html avec une balise <script> classique (pas de module) : le jeu s'ouvre en double-cliquant. */

// ---------------------------------------------------------------------------------------
// Vitrine des modèles 3D (index.html?modeles) : chaque modèle seul, on tourne autour
// ---------------------------------------------------------------------------------------
function demarrerVitrine(){
  const { canvas, renderer, scene, camera } = preparerRendu(0.004);
  $('titre').textContent = 'Modèles 3D';
  $('lienModeles').hidden = true; $('lienTerrain').hidden = false;
  $('barreJeu').hidden = true; $('barreVitrine').hidden = false;

  const ciel = creerCiel(), etoiles = creerEtoiles(CONFIG.graphismes.etoiles), lune = creerLune();
  scene.add(ciel, etoiles, lune, creerLumieres(16, new THREE.Vector3(0, 1, 0)));
  // Lumière d'appoint qui suit la caméra, pour bien voir les modèles malgré la nuit
  const appoint = new THREE.DirectionalLight('#E4ECFF', 0.75);
  scene.add(appoint, appoint.target, new THREE.AmbientLight('#3A4C78', 0.35));
  // Sol enneigé (transparent quand il faut voir ce qui est enterré)
  const matSol = new THREE.MeshLambertMaterial({ color: COULEURS.neige, transparent: true, opacity: 1, depthWrite: true });
  const geoSol = new THREE.CircleGeometry(40, 48);
  geoSol.rotateX(-Math.PI / 2);
  const sol = new THREE.Mesh(geoSol, matSol);
  sol.receiveShadow = true;
  scene.add(sol);

  const etats = ['arret', 'production', 'faible', 'defaut'];
  const nomsEtats = { arret: 'Arrêt', production: 'Production', faible: 'Pression faible', defaut: 'Défaut' };
  const MODELES = [
    { nom: 'Ventilateurs', creer: () => creerEnneigeur(vc), sol: 0.45,
      cible: () => SUPPORTS[vc.support].pivot * 0.7 + 0.6, distance: () => 6 + SUPPORTS[vc.support].pivot * 0.9,
      options: o => {
        const c = o.userData.canon, r = o.userData.regard, cycle = (liste, v) => liste[(liste.indexOf(v) + 1) % liste.length];
        etatCanon(c, vc.etat); orienterCanon(c, vc.direction, vc.inclinaison);
        return [
          { libelle: () => `Modèle : ${CATALOGUE[vc.modele].nom}`, action: () => { vc.modele = cycle(['v8', 'v9', 'v10'], vc.modele); rebatir(); } },
          { libelle: () => `Support : ${SUPPORTS[vc.support].nom}`, action: () => { vc.support = cycle(Object.keys(SUPPORTS), vc.support); rebatir(true); } },
          { libelle: () => `État : ${nomsEtats[c.userData.etat]}`, action: () => { vc.etat = cycle(etats, vc.etat); etatCanon(c, vc.etat); } },
          { libelle: () => `Direction : ${c.userData.direction}°`, action: () => { vc.direction = (vc.direction + 45) % 360; orienterCanon(c, vc.direction, vc.inclinaison); } },
          { libelle: () => `Inclinaison : ${c.userData.inclinaison}°`, action: () => { vc.inclinaison = vc.inclinaison >= 30 ? 10 : vc.inclinaison + 10; orienterCanon(c, vc.direction, vc.inclinaison); } },
          { libelle: () => r.userData.ouvert ? 'Fermer la trappe' : 'Ouvrir la trappe', action: () => ouvrirRegard(r, !r.userData.ouvert) }
        ];
      } },
    { nom: 'Perches', creer: () => creerEnneigeur(vp), sol: 0.45,
      cible: () => PERCHE.support + CATALOGUE[vp.modele].longueur * 0.45, distance: () => CATALOGUE[vp.modele].longueur * 1.4 + 4,
      options: o => {
        const c = o.userData.canon, r = o.userData.regard, cycle = (liste, v) => liste[(liste.indexOf(v) + 1) % liste.length];
        etatCanon(c, vp.etat);
        return [
          { libelle: () => CATALOGUE[vp.modele].nom, action: () => { vp.modele = cycle(['p6', 'p10', 'p10n'], vp.modele); rebatir(true); } },
          { libelle: () => `État : ${nomsEtats[c.userData.etat]}`, action: () => { vp.etat = cycle(etats, vp.etat); etatCanon(c, vp.etat); } },
          { libelle: () => r.userData.ouvert ? 'Fermer la trappe' : 'Ouvrir la trappe', action: () => ouvrirRegard(r, !r.userData.ouvert) }
        ];
      } },
    { nom: 'Regard et vanne', creer: creerRegard, cible: -0.6, distance: 5, sol: 0.3,
      options: r => [{ libelle: () => r.userData.ouvert ? 'Fermer la trappe' : 'Ouvrir la trappe', action: () => ouvrirRegard(r, !r.userData.ouvert) }] },
    { nom: 'Salle de pompage', creer: () => creerSallePompage('Salle de pompage'), cible: 1.5, distance: 22, sol: 1,
      options: s => {
        let n = 0, alarme = false, ouverture = 0;
        const appliquer = () => etatSallePompage(s, {
          marche: [0, 1, 2].map(i => i < n), pressions: [0, 1, 2].map(i => i < n ? 44 + i * 1.5 : 0),
          pressionDepart: n ? 42 : 0, ouverture, alarme });
        return [
          { libelle: () => `Pompes en marche : ${n}`, action: () => { n = (n + 1) % 4; ouverture = n ? 1 : 0; appliquer(); } },
          { libelle: () => alarme ? 'Arrêter l\'alarme' : 'Déclencher l\'alarme', action: () => { alarme = !alarme; appliquer(); } }
        ];
      } },
    { nom: 'Armoire « Départ élec »', creer: () => creerArmoire('Départ élec'), cible: 1.2, distance: 6, sol: 1, options: () => [] }
  ];

  let objet = null, modele = null, auto = true, actuel = 0;
  const vc = { modele: 'v8', support: 'trepied', etat: 'arret', direction: 0, inclinaison: 20 }, vp = { modele: 'p6', etat: 'arret' };
  const valeur = v => typeof v === 'function' ? v() : v;
  const rebatir = (recadrer = false) => choisir(actuel, !recadrer);
  const cam = creerCommandes(canvas, camera, {
    depart: () => ({ x: 0, z: 0, distance: modele ? valeur(modele.distance) : 8, azimut: 0.6, inclinaison: 22 * Math.PI / 180 }),
    bornes: { x: 6, z: 6 }, distanceMin: 1.5, distanceMax: 60, margeSol: -10,
    hauteurCible: () => modele ? valeur(modele.cible) : 1, hauteurSol: () => 0,
    interaction: () => { auto = false; }
  });
  function choisir(i, garderVue = false){
    if(objet) scene.remove(objet);
    actuel = i;
    modele = MODELES[i];
    objet = modele.creer();
    if(modele.preparer) modele.preparer(objet);
    scene.add(objet);
    matSol.opacity = modele.sol;
    matSol.depthWrite = modele.sol >= 1;
    if(!garderVue){ cam.recentrer(); auto = true; }
    $('sousTitre').textContent = modele.nom;
    afficherVitrine(MODELES, i, choisir, modele.options(objet));
  }
  choisir(0);
  $('recentrer').onclick = () => { cam.recentrer(); auto = true; };

  let avant = performance.now();
  function boucle(maintenant){
    const dt = Math.min(0.05, (maintenant - avant) / 1000), temps = maintenant / 1000;
    avant = maintenant;
    if(auto) cam.voulu.azimut += dt * 0.25;                    // le modèle tourne doucement tant qu'on ne touche pas
    cam.maj(dt);
    ciel.position.copy(camera.position); etoiles.position.copy(camera.position); lune.position.copy(camera.position);
    appoint.position.copy(camera.position).add(new THREE.Vector3(0, 4, 0));
    appoint.target.position.set(0, valeur(modele.cible), 0);
    objet.traverse(o => {
      if(o.userData.helice) animerCanon(o, dt);
      if(o.userData.charniere) animerRegard(o, dt);
      if(o.userData.pompes){ animerSallePompage(o, dt, temps); voirAtravers(o, camera, dt); }
    });
    renderer.render(scene, camera);
    requestAnimationFrame(boucle);
  }
  requestAnimationFrame(boucle);
  message('Glissez pour tourner autour du modèle, pincez (ou molette) pour zoomer. Choisissez un modèle en bas et essayez ses boutons jaunes.', 'info', 7000);
  window.nivo = { scene, camera, renderer, cam, choisir };
}
