'use strict';
/* Nivoculteur · jeu — rendu, caméra, terrain de jeu
   Chargé par index.html avec une balise <script> classique (pas de module) : le jeu s'ouvre en double-cliquant. */

/* =====================================================================================
   7. JEU — scène, boucle principale, caméra, commandes tactiles et souris
   ===================================================================================== */

// Rendu, scène et caméra communs au jeu et à la vitrine
function preparerRendu(brouillard){
  const canvas = $('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.graphismes.pixelRatioMax));
  renderer.shadowMap.enabled = CONFIG.graphismes.ombres;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COULEUR_HORIZON);
  scene.fog = new THREE.FogExp2(COULEUR_HORIZON, brouillard);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 8000);
  function redimensionner(){
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 62 : 48;                     // téléphone en portrait : champ de vision plus large
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', redimensionner);
  window.addEventListener('orientationchange', () => setTimeout(redimensionner, 200));
  redimensionner();
  return { canvas, renderer, scene, camera };
}

// Caméra en orbite autour d'un point.
// Au doigt (jeu) : un doigt = se déplacer ; deux doigts = pincer pour zoomer, tourner pour pivoter, glisser vers le haut
// ou le bas pour incliner la vue. (Avec o.unDoigt = 'tourner', comme dans la vitrine, un doigt fait tourner.)
// À la souris : glisser = tourner, molette = zoom, clic droit (ou Maj) = déplacer.
function creerCommandes(canvas, camera, o){
  const C = CONFIG.camera, rad = Math.PI / 180;
  const voulu = o.depart(), actuel = o.depart();
  const caler = () => {
    if(o.bornes){ voulu.x = borne(voulu.x, -o.bornes.x, o.bornes.x); voulu.z = borne(voulu.z, -o.bornes.z, o.bornes.z); }
    voulu.distance = borne(voulu.distance, o.distanceMin, o.distanceMax);
    voulu.inclinaison = borne(voulu.inclinaison, C.inclinaisonMin * rad, C.inclinaisonMax * rad);
  };
  const tourner = (dx, dy) => { voulu.azimut -= dx * C.sensibiliteRotation; voulu.inclinaison += dy * C.sensibiliteRotation * 0.8; caler(); };
  const deplacer = (dx, dy) => {
    const k = actuel.distance * C.sensibiliteDeplacement, s = Math.sin(actuel.azimut), c = Math.cos(actuel.azimut);
    voulu.x += (-dx * c - dy * s) * k;
    voulu.z += (dx * s - dy * c) * k;
    caler();
  };
  const zoomer = f => { voulu.distance *= f; caler(); };
  const cible = new THREE.Vector3();
  function maj(dt){
    const a = Math.min(1, dt * C.douceur);
    for(const cle of ['x', 'z', 'distance', 'azimut', 'inclinaison']) actuel[cle] += (voulu[cle] - actuel[cle]) * a;
    cible.set(actuel.x, o.hauteurCible(actuel.x, actuel.z), actuel.z);
    // Si une montagne est entre la caméra et le point regardé, la caméra monte (elle regarde plus d'en haut)
    let incl = actuel.inclinaison;
    for(let k = 0; k < 40; k++){
      const ci = Math.cos(incl);
      camera.position.set(
        cible.x + actuel.distance * Math.sin(actuel.azimut) * ci,
        cible.y + actuel.distance * Math.sin(incl),
        cible.z + actuel.distance * Math.cos(actuel.azimut) * ci);
      if(camera.position.y >= o.hauteurSol(camera.position.x, camera.position.z) + o.margeSol || incl > 1.5) break;
      incl += 0.04;
    }
    camera.lookAt(cible);
  }

  const pointeurs = new Map();
  let appui = null, ecart = 0, centre = null;
  const interaction = () => o.interaction && o.interaction();
  const deuxDoigts = () => {
    const [p, q] = [...pointeurs.values()];
    return { d: Math.hypot(p.x - q.x, p.y - q.y), a: Math.atan2(q.y - p.y, q.x - p.x), x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  };
  canvas.addEventListener('pointerdown', e => {
    try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
    pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY, doigt: e.pointerType === 'touch' });
    if(pointeurs.size === 1) appui = { x: e.clientX, y: e.clientY, t: performance.now(), bouge: false, bouton: e.button };
    else { appui = null; const g = deuxDoigts(); ecart = g.d; centre = g; }
  });
  canvas.addEventListener('pointermove', e => {
    const p = pointeurs.get(e.pointerId);
    if(!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if(pointeurs.size === 1){
      if(appui && Math.hypot(e.clientX - appui.x, e.clientY - appui.y) > 8) appui.bouge = true;
      if(appui && !appui.bouge) return;
      if(p.doigt ? o.unDoigt === 'deplacer' : (appui && (appui.bouton === 2 || e.shiftKey))) deplacer(dx, dy); else tourner(dx, dy);
      interaction();
    } else if(pointeurs.size === 2){
      const g = deuxDoigts();
      if(ecart > 0) zoomer(ecart / Math.max(g.d, 1));
      if(centre){
        if(o.unDoigt === 'deplacer'){
          // Deux doigts : la rotation des doigts fait pivoter la vue, leur glissement vertical l'incline
          let da = g.a - centre.a;
          if(da > Math.PI) da -= Math.PI * 2; else if(da < -Math.PI) da += Math.PI * 2;
          voulu.azimut += da;
          tourner(0, (g.y - centre.y) * 1.4);
        } else deplacer(g.x - centre.x, g.y - centre.y);
      }
      ecart = g.d; centre = g;
      interaction();
    }
  });
  const relacher = e => {
    if(!pointeurs.has(e.pointerId)) return;
    pointeurs.delete(e.pointerId);
    if(appui && !appui.bouge && e.type === 'pointerup' && performance.now() - appui.t < 450 && o.toucher) o.toucher(e.clientX, e.clientY);
    appui = null;
    if(pointeurs.size === 1){                       // il reste un doigt : il reprend la rotation sans à-coup
      const [p] = pointeurs.values();
      appui = { x: p.x, y: p.y, t: 0, bouge: true, bouton: 0 };
    }
    if(pointeurs.size < 2){ ecart = 0; centre = null; }
  };
  canvas.addEventListener('pointerup', relacher);
  canvas.addEventListener('pointercancel', relacher);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoomer(Math.exp(e.deltaY * 0.0012)); interaction(); }, { passive: false });

  return { voulu, actuel, maj, recentrer: () => Object.assign(voulu, o.depart()), aller: v => { Object.assign(voulu, v); caler(); } };
}

// ---------------------------------------------------------------------------------------
// Le terrain de jeu
// ---------------------------------------------------------------------------------------
function demarrer(){
  const t = niveau.terrain;
  const hauteur = (x, z) => altitude(t, x, z, niveau.pistes) - t.altBas;
  const { canvas, renderer, scene, camera } = preparerRendu(0.0009);

  // Décor
  const ciel = creerCiel(), etoiles = creerEtoiles(CONFIG.graphismes.etoiles), lune = creerLune();
  const terrain = creerTerrain(niveau), poser = terrain.userData.poser;
  const decor = [creerSapins(niveau, Math.round(CONFIG.graphismes.sapins * (t.largeur + 520) / 820), poser), creerRochers(niveau, CONFIG.graphismes.rochers, poser), creerJalons(niveau, poser)];
  // Portes de départ en haut de chaque piste, de la couleur de la piste (sa difficulté la plus haute)
  const placerPorte = (porte, piste) => {
    const c = courbePiste(piste), e = extremitesPiste(t, piste), i0 = e.inverse ? c.length - 1 : 0, i1 = e.inverse ? Math.max(0, c.length - 3) : Math.min(c.length - 1, 2);
    const dx = c[i1][0] - c[i0][0], dz = c[i1][1] - c[i0][1], L = Math.hypot(dx, dz) || 1, x = c[i0][0] + dx / L * 6, z = c[i0][1] + dz / L * 6;
    porte.position.set(x, poser(x, z), z);
    porte.rotation.y = Math.atan2(dx, dz);
    return porte;
  };
  for(const p of niveau.pistes) decor.push(placerPorte(creerPortePiste(p.nom, p.couleur, p.largeur), p));
  const lumieres = creerLumieres(Math.max(t.largeur, t.longueur) / 2 + t.marge, new THREE.Vector3(0, t.denivele / 2, 0));
  scene.add(ciel, etoiles, lune, terrain, ...decor, lumieres);

  // Installations : retenue, salle de pompage, départs électriques, remontées
  const retenue = creerRetenue(niveau, poser);
  const salle = creerSallePompage(niveau.pompage.nom);
  salle.position.set(niveau.pompage.x, coteReplat(t, niveau.pompage) - t.altBas + 0.08, niveau.pompage.z);
  salle.rotation.y = niveau.pompage.rotation || 0;
  scene.add(retenue, salle);
  for(const d of niveau.departsElec){
    const arm = creerArmoire(d.nom);
    arm.position.set(d.x, poser(d.x, d.z), d.z);
    arm.rotation.y = Math.atan2(-d.x, t.longueur / 2 - d.z);     // porte tournée vers le bas de la pente
    scene.add(arm);
  }
  const remontees3D = (niveau.remontees || []).map(ts => { const o = creerTelesiege(ts, poser); scene.add(o); return { ts, o }; });
  // Compresseur d'air (niveau 3), sur le replat de la salle de pompage
  const K = niveau.compresseur, compresseur = K ? creerCompresseur(K.nom, { dx: K.sortie.x - K.x, dz: K.sortie.z - K.z }) : null;
  if(compresseur){ compresseur.position.set(K.x, poser(K.x, K.z), K.z); scene.add(compresseur); }
  const repere = creerRepere();
  scene.add(repere);

  // Caméra
  const C = CONFIG.camera, rad = Math.PI / 180;
  const cam = creerCommandes(canvas, camera, {
    depart: () => ({ x: 0, z: 10, distance: C.distanceDepart, azimut: 0, inclinaison: C.inclinaisonDepart * rad }),
    bornes: { x: t.largeur / 2, z: t.longueur / 2 },
    distanceMin: C.distanceMin, distanceMax: C.distanceMax, margeSol: 4, unDoigt: 'deplacer',
    hauteurCible: hauteur, hauteurSol: poser,
    toucher
  });
  $('recentrer').onclick = cam.recentrer;

  // ----- Construction du réseau -----
  // Partie sauvegardée dans le navigateur (une par niveau) et progression (niveaux réussis)
  const clePartie = `nivo-partie-${niveau.id}`, VERSION_PARTIE = 1;
  const progression = lireSauvegarde('nivo-progression') || { niveaux: {}, dernier: null };
  progression.niveaux = progression.niveaux || {};
  function chargerPartie(){
    if(params.has('nouvelle')){
      effacerSauvegarde(clePartie);
      try{ history.replaceState(null, '', `index.html?niveau=${niveau.id}`); }catch(e){}
      return null;
    }
    const p = lireSauvegarde(clePartie);
    return p && p.version === VERSION_PARTIE && p.reseau && Array.isArray(p.reseau.noeuds) ? p.reseau : null;
  }
  const nouvellePartie = () => niveau.carriere ? commencerEtape(niveau, creerReseau(niveau), niveau.etape)
                                              : construireReseauFixe(niveau, creerReseau(niveau));
  let reseau = chargerPartie() || nouvellePartie(), outil = null, depart = null, proposition = null, sousSol = false;
  let traceePiste = [], gareAval = null, gareAmont = null;            // bac à sable : piste ou télésiège en cours de tracé
  let deplaceId = null;
  let infosCanons = lireSauvegarde('nivo-infos-canons') !== false;     // bulles et points d'état au-dessus des canons                                                // regard en cours de déplacement
  if(niveau.bac) reseau.options = { ...optionsBac(), ...(reseau.options || {}) };
  if(niveau.carriere) etendreReseau(niveau, reseau);
  reseau.dameuse = reseau.dameuse || { modele: 'dm400' };                           // parties enregistrées avant le garage
  reseau.remonteesEnMarche = reseau.remonteesEnMarche || [];
  if(reseau.exploitation && reseau.exploitation.phase === 'jour') reseau.exploitation.phase = 'matin';   // partie quittée en pleine journée                                  // départs ou compresseur débloqués    // anciennes parties : options manquantes
  const repris = reseau.nuit > 1 || reseau.noeuds.some(n => n.type === 'regard' && !niveau.reseauFixe);
  function sauver(force = false){
    if(nuit || (!force && reseau.nuit === 1 && !reseau.lot)) return;   // rien à garder tant que le joueur n'a rien fait
    ecrireSauvegarde(clePartie, { version: VERSION_PARTIE, reseau, date: Date.now() });
    progression.dernier = niveau.id;
    ecrireSauvegarde('nivo-progression', progression);
  }
  let minuteurSauvegarde = null;
  const planifierSauvegarde = () => { clearTimeout(minuteurSauvegarde); minuteurSauvegarde = setTimeout(sauver, 600); };
  if(niveau.construction === false) $('barreJeu').classList.add('sans-construction');
  document.querySelector('[data-outil="air"]').hidden = !niveau.compresseur;
  for(const o of ['piste', 'remontee']) document.querySelector(`[data-outil="${o}"]`).hidden = !niveau.bac && !niveau.carriere && !niveau.exploitation;   // tracés : grand domaine
  let choix = { modele: niveau.compresseur ? 'p10' : 'v8', support: 'trepied' };   // enneigeur posé avec un nouveau regard
  let fiche = null, nuit = null;                              // fiche : regard affiché ; nuit : { regime, temps, vitesse }
  let reussi = !!(progression.niveaux[niveau.id] || {}).reussi, alarmeJusqua = 0;
  const groupeReseau = new THREE.Group(), groupeSousSol = new THREE.Group(), apercu = new THREE.Group();
  groupeSousSol.visible = false;
  const surbrillance = creerSurbrillance(), anneauChute = creerSurbrillance();
  const jets = creerJets(CONFIG.graphismes.flocons), manche = creerMancheAir();
  manche.position.set(niveau.pompage.x + 26, poser(niveau.pompage.x + 26, niveau.pompage.z - 12), niveau.pompage.z - 12);
  scene.add(groupeReseau, groupeSousSol, apercu, surbrillance, anneauChute, jets.groupe, manche);
  const regards3D = new Map(), tas3D = new Map(), departs3D = new Map();
  let tranchees3D = [];
  const COUL_OUTIL = { eau: COULEURS.reseauEau, cable: COULEURS.reseauElec, air: COULEURS.reseauAir };
  const NOMS_ZONES = { arret: 'pas assez de pression : pas de neige', faible: 'production réduite', correcte: 'bonne pression', haute: 'pression haute, à surveiller', surpression: 'surpression : le canon se met en sécurité' };
  const liberer = o => o.traverse(m => { if(m.geometry && m.geometry !== _geoTas) m.geometry.dispose(); });
  const ventActuel = () => nuit ? nuit.regime.vent : ventPrevu(niveau, reseau);
  // Voyant du canon et point de couleur au-dessus : vert en marche, rouge à l'arrêt, jaune en défaut
  const marquer = (o, etat) => { etatCanon(o.userData.canon, etat); o.userData.point.material.color.set(COULEURS.voyants[etat]); };
  const attendAir = c => !c.arrete && c.pressionAir !== null && facteurAir(c.pressionAir) === 0;   // perche sans assez d'air

  // Met la 3D à jour d'après le réseau (regards et enneigeurs, icônes, tranchées, tas de neige)
  function synchroniser(){
    const vus = new Set();
    for(const n of reseau.noeuds){
      if(n.type !== 'regard') continue;
      vus.add(n.id);
      const cle = `${n.modele}|${n.support}`;
      let o = regards3D.get(n.id);
      if(o && o.userData.cle !== cle){ groupeReseau.remove(o); liberer(o); o = null; }
      if(!o){
        o = creerEnneigeur({ modele: n.modele, support: n.support });
        o.position.set(n.x, poser(n.x, n.z), n.z);
        o.userData.cle = cle;
        const m = CATALOGUE[n.modele];
        o.userData.icone = creerIconeEtat(m.type === 'perche');       // bulle juste sous l'enneigeur (au pied)
        o.userData.icone.position.y = 0.2;
        o.userData.icone.center.set(0.5, 1.15);
        o.userData.point = creerPointEtat();                           // point vert / rouge / jaune au-dessus
        o.userData.point.position.y = m.type === 'perche' ? PERCHE.support + m.longueur * 0.87 + 1.2 : SUPPORTS[n.support].pivot + 2.2;
        o.add(o.userData.icone, o.userData.point);
        groupeReseau.add(o);
        regards3D.set(n.id, o);
      }
      o.position.set(n.x, poser(n.x, n.z), n.z);                     // un regard peut avoir été déplacé
      orienterCanon(o.userData.canon, n.direction, n.inclinaison);
      o.userData.icone.visible = o.userData.point.visible = infosCanons;
      const e = etatRegard(niveau, reseau, n.id);
      o.userData.icone.material.map = textureIcone(e.eau, e.elec, e.besoinAir ? e.air : null);
    }
    for(const [id, o] of regards3D) if(!vus.has(id)){ groupeReseau.remove(o); liberer(o); regards3D.delete(id); }
    // Départs électriques ajoutés par le joueur
    const departsVus = new Set();
    for(const n of reseau.noeuds.filter(q => q.type === 'elec' && q.ajoute)){
      departsVus.add(n.id);
      if(!departs3D.has(n.id)){
        const arm = creerArmoire(n.nom);
        arm.position.set(n.x, poser(n.x, n.z), n.z);
        arm.rotation.y = Math.atan2(-n.x, t.longueur / 2 - n.z);
        groupeReseau.add(arm); departs3D.set(n.id, arm);
      }
    }
    for(const [id, o] of departs3D) if(!departsVus.has(id)){ groupeReseau.remove(o); departs3D.delete(id); }
    for(const o of tranchees3D){ groupeReseau.remove(o.surface); groupeSousSol.remove(o.dessous); liberer(o.surface); liberer(o.dessous); }
    tranchees3D = reseau.tranchees.map(tr => {
      const o = creerTranchee3D(noeudReseau(reseau, tr.a), noeudReseau(reseau, tr.b), tr, poser);
      o.surface.visible = !sousSol;
      groupeReseau.add(o.surface); groupeSousSol.add(o.dessous);
      return o;
    });
    majTasMeshes();
    majPannes3D();
    majInfos();
    manche.userData.orienter(ventActuel());
    planifierSauvegarde();
    $('annuler').disabled = !reseau.historique.length;
  }
  function majTasMeshes(){
    for(const [q, mesh] of tas3D) if(!reseau.tas.includes(q)){ scene.remove(mesh); tas3D.delete(q); }
    for(const q of reseau.tas){
      let mesh = tas3D.get(q);
      if(!mesh){ mesh = creerTas(); mesh.position.set(q.x, poser(q.x, q.z) - 0.3, q.z); scene.add(mesh); tas3D.set(q, mesh); }
      if(q.attente) continue;                                        // la dameuse n'est pas encore passée
      majTas(mesh, q.volume);
      if(q.dame) damer(mesh);
    }
  }
  // Ce qui compte pour l'objectif : toute la neige produite (niveau 1) ou la neige tombée sur la piste
  const neigeObjectif = () => niveau.objectif.type === 'production' ? reseau.neigeTotale
    : niveau.carriere ? avancementEtape(reseau).neige : reseau.neigePiste;
  // Numéro de la nuit à afficher (carrière : nuit de l'étape sur le nombre de nuits)
  const libelleNuit = () => niveau.carriere ? `${avancementEtape(reseau).nuits + 1}/${niveau.objectif.nuits}` : `${reseau.nuit}`;
  // ----- Garage et dameuse : la dameuse sort le matin, étale les tas sur les pistes, puis rentre au garage -----
  const G = niveau.garage, placeGarage = new THREE.Vector3(), sortieGarage = new THREE.Vector3();
  let garage = null, dameuse3D = null, tournee = null;
  if(G){
    garage = creerGarage(G.nom);
    garage.position.set(G.x, coteReplat(t, G) - t.altBas + 0.05, G.z);
    garage.rotation.y = Math.PI;                                      // portes tournées vers le haut de la pente
    scene.add(garage);
    garage.updateMatrixWorld(true);
    garage.localToWorld(placeGarage.copy(garage.userData.places[0]));
    garage.localToWorld(sortieGarage.set(garage.userData.places[0].x, 0, garage.userData.profondeur / 2 + 9));
  }
  function trajetDameuse(piste){
    const c = courbePiste(piste), w = piste.largeur;
    const passe = decal => c.map((p, i) => {
      const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [p[0] - (b[1] - a[1]) / L * decal, p[1] + (b[0] - a[0]) / L * decal];
    });
    return [...passe(-w / 4), ...passe(w / 4).reverse()];
  }
  function majDameuse3D(){
    if(!G) return;
    if(dameuse3D && dameuse3D.userData.modele === reseau.dameuse.modele) return;
    if(dameuse3D){ scene.remove(dameuse3D); liberer(dameuse3D); }
    dameuse3D = creerDameuse(reseau.dameuse.modele);
    dameuse3D.rotation.order = 'YXZ';
    scene.add(dameuse3D);
    garer();
  }
  // La dameuse au garage, phares éteints, porte fermée
  function garer(){
    if(!dameuse3D) return;
    dameuse3D.position.copy(placeGarage);
    dameuse3D.rotation.set(0, Math.PI, 0);
    phareDameuse(dameuse3D, false);
    if(tournee){ for(const q of tournee.attente) delete q.attente; tournee = null; majTasMeshes(); }
    ouvrirGarage(garage, false);
  }
  // Tournée du matin : garage → pistes où il y a des tas → garage (les tas s'étalent à son passage)
  function commencerTournee(tasDames){
    if(!dameuse3D || !tasDames.length) return;
    const attente = new Set(reseau.tas.filter(q => tasDames.some(d => d.x === q.x && d.z === q.z)));
    for(const q of attente) q.attente = true;
    let restantes = niveau.pistes.filter(p => tasDames.some(q => distancePiste(p, q.x, q.z) < p.largeur / 2 + 25));
    const pts = [[placeGarage.x, placeGarage.z], [sortieGarage.x, sortieGarage.z]];
    while(restantes.length){
      const [x0, z0] = pts[pts.length - 1];
      const boucles = restantes.map(p => {
        const b = trajetDameuse(p);
        let k = 0, dMin = Infinity;
        b.forEach(([x, z], i) => { const d = Math.hypot(x - x0, z - z0); if(d < dMin){ dMin = d; k = i; } });
        return { p, b: [...b.slice(k), ...b.slice(0, k), b[k]], dMin };
      }).sort((a, b) => a.dMin - b.dMin);
      pts.push(...boucles[0].b);
      restantes = restantes.filter(p => p !== boucles[0].p);
    }
    pts.push([sortieGarage.x, sortieGarage.z], [placeGarage.x, placeGarage.z]);
    const cumul = [0];
    for(let i = 1; i < pts.length; i++) cumul.push(cumul[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    tournee = { pts, cumul, longueur: cumul[cumul.length - 1], s: 0, i: 1, attente };
    phareDameuse(dameuse3D, true);
    majTasMeshes();
  }
  const _pente = [0, 0];
  function avancerTournee(dt, temps){
    if(!dameuse3D || !tournee) return;
    const tr = tournee;
    tr.s += dt * CONFIG.dameuse.vitesse;
    if(tr.s >= tr.longueur) return garer();
    while(tr.i < tr.cumul.length - 1 && tr.cumul[tr.i] < tr.s) tr.i++;
    const a = tr.pts[tr.i - 1], b = tr.pts[tr.i], f = (tr.s - tr.cumul[tr.i - 1]) / Math.max(1e-6, tr.cumul[tr.i] - tr.cumul[tr.i - 1]);
    const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f, L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const recul = tr.i === tr.pts.length - 1, sens = recul ? -1 : 1;              // elle rentre au garage en marche arrière
    const ux = (b[0] - a[0]) / L * sens, uz = (b[1] - a[1]) / L * sens, auGarage = Math.hypot(x - placeGarage.x, z - placeGarage.z);
    _pente[0] = poser(x + ux * 2.5, z + uz * 2.5); _pente[1] = poser(x - ux * 2.5, z - uz * 2.5);
    dameuse3D.position.set(x, auGarage < 12 ? placeGarage.y : poser(x, z), z);
    dameuse3D.rotation.set(auGarage < 12 ? 0 : -Math.atan2(_pente[0] - _pente[1], 5), Math.atan2(ux, uz), 0);
    animerDameuse(dameuse3D, temps);
    ouvrirGarage(garage, auGarage < 30);
    for(const q of [...tr.attente]) if(Math.hypot(q.x - x, q.z - z) < 14){
      tr.attente.delete(q); delete q.attente;
      const mesh = tas3D.get(q);
      if(mesh){ majTas(mesh, q.volume); if(q.dame) damer(mesh); }
    }
  }
  // Remontées : elles tournent quand on les active
  function majRemontees3D(){ for(const r of remontees3D) r.o.userData.enMarche = remonteeEnMarche(reseau, r.ts) && !enPanne(reseau, r.ts.nom); }
  function damer(mesh){ mesh.scale.x *= 1.6; mesh.scale.z *= 1.6; mesh.scale.y *= 0.3; }

  // Heure de la nuit affichée : 18 h → 6 h (une nuit de jeu = 12 h)
  function heureNuit(){
    const m = Math.round((18 + Math.min(1, nuit.temps / CONFIG.nuit.duree) * 12) * 60) % (24 * 60);
    return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
  }
  function majInfos(){
    const R = niveau.retenue;
    majHud({ budget: niveau.bac && !reseau.options.budget ? 'Illimité' : reseau.budget, nuit: nuit ? `${libelleNuit()} · ${heureNuit()}` : `n° ${libelleNuit()}`,
      neige: Math.round(neigeObjectif()), objectif: niveau.objectif.m3, vent: ventActuel(),
      retenue: reseau.retenue ? reseau.retenue.volume / volumeRetenue(R) : null });
    if(reseau.retenue) retenue.userData.remplir(hauteurRetenue(R, reseau.retenue.volume));
    if(EXPL){
      const ex = reseau.exploitation, sat = satisfactionSaison(reseau);
      $('hudNuit').textContent = `S${ex.saison} · J${ex.jour}/${E.joursSaison}${nuit ? ` · ${heureNuit()}` : journee ? ` · ${heureJournee(journee.temps)}` : ''}`;
      $('hudNeige').textContent = sat === null ? '—' : `${Math.round(sat * 100)} %`;
      $('lancerNuit').textContent = ex.phase === 'matin' ? 'Ouvrir la station' : 'Lancer la nuit';
    }
    majDameuse3D();
    majRemontees3D();
    majCoinPannes();
    majObjectifs();
  }

  function consigne(){
    if(nuit) return;
    const suite = depart && `Départ : ${depart.nom}. Touchez le regard à raccorder, ou un endroit libre pour poser un nouveau regard. Touchez à nouveau le départ pour en changer.`;
    afficherConsigne({
      regard: 'Touchez le terrain pour poser un regard et son enneigeur (choisi ci-dessous). Touchez un regard pour le régler.',
      eau: suite || 'Eau : touchez la salle de pompage, ou un regard déjà alimenté en eau.',
      cable: suite || 'Électricité : touchez un départ électrique (près des bâtiments), ou un regard déjà alimenté.',
      air: suite || 'Air comprimé : touchez le compresseur (à côté de la salle de pompage), ou un regard déjà alimenté en air. Seules les perches ont besoin d\'air.',
      piste: 'Nouvelle piste : touchez des points du haut vers le bas, puis « Terminer la piste ». Sa couleur dépend de la pente.',
      depart: `Nouveau départ électrique : touchez l'endroit où poser l'armoire (${euros(CONFIG.couts.departElec)}).`,
      demonter: 'Démonter : touchez un regard (ou un départ électrique ajouté), ou une tranchée pour en retirer la conduite ou le câble.',
      deplacer: deplaceId && noeudReseau(reseau, deplaceId) ? `Déplacer ${noeudReseau(reseau, deplaceId).nom} : touchez le nouvel emplacement.` : null,
      remontee: gareAval ? 'Touchez maintenant l\'emplacement de la gare d\'arrivée, en haut.' : 'Nouveau télésiège : touchez l\'emplacement de la gare de départ, en bas de la pente.'
    }[outil] || null);
    const trace = outil === 'piste' || outil === 'remontee';
    $('choixEnneigeur').hidden = !outil || trace || ['depart', 'demonter', 'deplacer'].includes(outil);
    $('choixTrace').hidden = !trace;
    if(outil && !trace && !$('choixEnneigeur').hidden) majChoix();
    if(trace) majPanneauTrace();
  }
  function majChoix(){
    if(!supportDisponible(niveau, choix.support).ok) choix = { ...choix, support: 'trepied' };
    if(!disponible(niveau, reseau, choix.modele).ok) choix = { modele: 'v8', support: choix.support || 'trepied' };
    remplirChoixEnneigeur(niveau, reseau, choix, nouveau => { choix = nouveau; majChoix(); });
  }
  function montrerDepart(){
    surbrillance.visible = !!depart;
    if(!depart) return;
    surbrillance.material.color.set(COUL_OUTIL[outil] || '#FFFFFF');
    surbrillance.position.set(depart.x, poser(depart.x, depart.z) + 0.6, depart.z);
  }
  function fermerDevis(){
    proposition = null;
    fiche = null;
    anneauChute.visible = false;
    $('devis').classList.remove('fiche');
    fermerPanneauDevis();
    apercu.children.slice().forEach(o => { apercu.remove(o); liberer(o); });
  }
  function choisirOutil(o){
    outil = outil === o ? null : o;
    depart = null; traceePiste = []; gareAval = null; gareAmont = null; deplaceId = null;
    fermerDevis();
    document.querySelectorAll('[data-outil]').forEach(b => b.classList.toggle('actif', b.dataset.outil === outil));
    montrerDepart();
    consigne();
    majPuceOutil();
  }
  document.querySelectorAll('[data-outil]').forEach(b => { b.onclick = () => choisirOutil(b.dataset.outil); });

  // --- Menus de la barre du bas : Construire, Gestion, Affichage (un tiroir à la fois) ---
  let tiroir = null;
  function ouvrirTiroir(nom){
    tiroir = tiroir === nom ? null : nom;
    $('tiroir').hidden = !tiroir;
    document.querySelectorAll('.groupe-tiroir').forEach(g => { g.hidden = g.dataset.groupe !== tiroir; });
    document.querySelectorAll('[data-tiroir]').forEach(b => { b.classList.toggle('actif', b.dataset.tiroir === tiroir); b.setAttribute('aria-expanded', String(b.dataset.tiroir === tiroir)); });
    // Titre « Pistes et remontées » seulement s'il y a des outils de tracé
    const domaine = [...$('rangDomaine').children].some(b => !b.hidden);
    $('titreDomaine').hidden = $('rangDomaine').hidden = !domaine;
  }
  function fermerTiroir(){ if(tiroir) ouvrirTiroir(tiroir); }
  document.querySelectorAll('[data-tiroir]').forEach(b => { b.onclick = () => ouvrirTiroir(b.dataset.tiroir); });
  $('tiroir').addEventListener('click', e => { if(e.target.closest('button')) fermerTiroir(); });   // un choix referme le tiroir
  // L'outil en main, rappelé au-dessus de la barre (✕ pour le ranger)
  function majPuceOutil(){
    const b = outil && document.querySelector(`[data-outil="${outil}"]`);
    const nom = outil === 'deplacer' ? 'Déplacer le regard' : b ? b.textContent.trim() : '';
    $('rangOutilActif').hidden = !nom;
    $('outilActifNom').textContent = nom ? `Outil : ${nom}` : '';
  }
  $('quitterOutil').onclick = () => { if(outil === 'deplacer'){ outil = null; deplaceId = null; surbrillance.visible = false; consigne(); majPuceOutil(); } else if(outil) choisirOutil(outil); };

  // Le nœud du réseau le plus proche du point touché (tolérance selon le zoom)
  function noeudProche(x, z){
    const tol = Math.max(5, cam.actuel.distance * 0.035);
    let best = null, dMin = Infinity;
    for(const n of reseau.noeuds){
      let d = Math.hypot(x - n.x, z - n.z);
      if(n.type === 'pompage') d = Math.min(d, Math.hypot(x - niveau.pompage.x, z - niveau.pompage.z) - 6);   // tout le bâtiment
      if(n.type === 'compresseur') d = Math.min(d, Math.hypot(x - K.x, z - K.z) - 3);
      if(d < (n.type === 'regard' ? tol : Math.max(tol, 10)) && d < dMin){ dMin = d; best = n; }
    }
    return best;
  }
  function infoNoeud(n){
    if(n.type === 'pompage') return ouvrirPoste();
    if(n.type === 'elec') return message(`${n.nom} : d'ici partent les câbles électriques.`, 'info');
    if(n.type === 'compresseur'){
      message(`${n.nom} : d'ici part l'air comprimé des perches. Il se pilote au poste de travail.`, 'info', 4000);
      return ouvrirPoste();
    }
    ouvrirFiche(n.id);
  }

  // ----- Fiche d'un canon : état, orientation, remplacement -----
  // La fiche se range à gauche (écran large) ou monte du bas (téléphone) ; la vue se centre sur le canon et l'endroit
  // où tombe sa neige, dans la partie de l'écran que la fiche laisse libre (décalage de la vue).
  const ecranLarge = window.matchMedia('(min-width:700px) and (orientation:landscape)');
  function ouvrirFiche(id){
    fermerDevis();
    fiche = id;
    $('devis').classList.add('fiche');
    dessinerFiche();
    const n = noeudReseau(reseau, id), ch = pointChute(n, ventActuel());
    cam.aller({ x: (n.x + ch.x) / 2, z: (n.z + ch.z) / 2, distance: Math.max(40, Math.hypot(ch.x - n.x, ch.z - n.z) * 1.9 + 24) });
  }
  const decalage = { x: 0, y: 0 };
  function decalerVue(){
    let vx = 0, vy = 0;
    const d = $('devis');
    if(fiche && !d.hidden){
      const r = d.getBoundingClientRect();
      if(ecranLarge.matches) vx = r.right / 2; else vy = Math.max(0, window.innerHeight - r.top) / 2;
    }
    const k = 0.18;
    decalage.x += (vx - decalage.x) * k; decalage.y += (vy - decalage.y) * k;
    if(Math.abs(decalage.x) < 0.5 && Math.abs(decalage.y) < 0.5 && !vx && !vy){
      if(camera.view && camera.view.enabled){ camera.clearViewOffset(); }
      return;
    }
    const w = window.innerWidth, h = window.innerHeight;
    camera.setViewOffset(w, h, -decalage.x, decalage.y, w, h);
  }
  // Téléphone : glisser la fiche vers le bas la ferme
  (() => {
    let y0 = null;
    $('devis').addEventListener('pointerdown', e => {
      y0 = fiche && !ecranLarge.matches && !e.target.closest('input, select, button') && $('devis').scrollTop <= 0 ? e.clientY : null;
    });
    $('devis').addEventListener('pointerup', e => { if(y0 !== null && e.clientY - y0 > 60) fermerDevis(); y0 = null; });
  })();
  function dessinerFiche(){
    const n = fiche && noeudReseau(reseau, fiche);
    if(!n){ fermerDevis(); return; }
    const m = CATALOGUE[n.modele], e = etatRegard(niveau, reseau, n.id), vent = ventActuel();
    const chute = pointChute(n, vent), part = partSurPiste(niveau.pistes, chute.x, chute.z, chute.rayon);
    let etat;
    const c = nuit && nuit.regime.canons.find(q => q.id === n.id);
    if(c) etat = c.production ? `En production : ${nombreFr(c.production)} m³/h de neige, ${Math.round(c.pression)} bar (${NOMS_ZONES[c.zone]})`
                 : attendAir(c) ? `En attente d'air : ${Math.round(c.pression)} bar d'eau`
                 : `Arrêté : ${Math.round(c.pression)} bar, il en faut au moins ${m.pressionMin}${nuit.regime.sec ? ' (retenue vide)' : ''}`;
    else if(e.pret) etat = `Prêt : ${Math.round(e.pression)} bar quand tous les canons sont fermés (${NOMS_ZONES[e.zone]})`;
    else etat = `Pas prêt : il manque ${e.manque}`;
    if(c && c.pressionAir !== null) etat += ` · air ${nombreFr(c.pressionAir, 1)} bar${c.pressionAir < CONFIG.air.pressionMin ? ' (il en faut ' + CONFIG.air.pressionMin + ')' : c.pressionAir < CONFIG.air.pressionPleine ? ' (un peu juste)' : ''}`;
    const pannesFiche = (reseau.pannes || []).filter(p => p.cible === n.id);
    const ventilo = m.type === 'ventilateur', pressionFiche = c ? c.pression : e.eau ? e.pression : null;
    const options = Object.entries(CATALOGUE).map(([k, q]) => {
      const d = disponible(niveau, reseau, k);
      return `<option value="${k}"${d.ok ? '' : ' disabled'}${k === n.modele ? ' selected' : ''}>${echapper(q.nom)}${d.ok ? '' : ` · ${echapper(d.raison)}`}</option>`;
    }).join('');
    const supports = Object.entries(SUPPORTS).map(([k, s]) => `<option value="${k}"${k === (n.support || 'trepied') ? ' selected' : ''}${supportDisponible(niveau, k).ok ? '' : ' disabled'}>${echapper(s.nom)}${supportDisponible(niveau, k).ok ? '' : ' · plus tard'}</option>`).join('');
    const d = afficherPanneau(`<div class="tete"><span>${echapper(n.nom)} · ${echapper(nomEnneigeur(n.modele, n.support))}</span><button class="fermer" type="button" id="ficheFermer" aria-label="Fermer">×</button></div>
      ${pressionFiche !== null ? `<div class="ligne">Pression ${jaugePression(pressionFiche, n.modele)}<b>${Math.round(pressionFiche)} bar</b></div>` : ''}
      ${pannesFiche.map(p => `<div class="ligne panne"><span>⚠ ${echapper(CONFIG.pannes.types[p.type].nom)}${p.etat === 'reparation' ? ' · équipe sur place' : ''}</span>
        ${p.etat === 'active' ? `<button class="bouton petit" type="button" data-reparer="${p.id}">Réparer · ${euros(CONFIG.pannes.types[p.type].cout)}</button>` : ''}</div>`).join('')}
      <ul><li>${echapper(etat)}</li>
      <li>Neige sur la piste ${nuit ? 'cette nuit' : 'avec le vent prévu'} (${vent.force ? vent.force + ' km/h' : 'pas de vent'}) : <b>${Math.round(part * 100)} %</b></li>
      <li>${m.debit} m³/h d'eau${m.air ? ` · ${m.air} Nm³/h d'air` : ''} · ${m.pressionMin} bar minimum · jusqu'à ${nombreFr(m.neige * CONFIG.nuit.duree * CONFIG.nuit.echelle / 3600)} m³ de neige par nuit (${m.neige} m³/h)</li></ul>
      <div class="ligne reglage-fiche">Direction <input type="range" id="ficheDir" min="-180" max="180" step="5" value="${n.direction}" aria-label="Direction du canon"><b>${n.direction}°</b></div>
      ${ventilo ? `<div class="ligne reglage-fiche">Inclinaison <input type="range" id="ficheInc" min="0" max="35" step="1" value="${n.inclinaison}" aria-label="Inclinaison du canon"><b>${n.inclinaison}°</b></div>` : ''}
      ${nuit || niveau.construction === false ? '' : `<div class="ligne"><button class="bouton petit" type="button" id="ficheDeplacer">Déplacer</button><button class="bouton petit" type="button" id="ficheDemonter">Démonter · +${euros(devisDemontage(niveau, reseau, n.id).rembourse)}</button></div>`}
      ${nuit || niveau.construction === false ? '' : `<div class="ligne choix">Remplacer par <select id="ficheModele">${options}</select><select id="ficheSupport">${supports}</select><button class="bouton petit" type="button" id="ficheRemplacer"></button></div>`}`);
    d.querySelector('#ficheFermer').onclick = fermerDevis;
    const bDep = d.querySelector('#ficheDeplacer'), bDem = d.querySelector('#ficheDemonter');
    if(bDep) bDep.onclick = () => commencerDeplacement(n.id);
    if(bDem) bDem.onclick = () => proposerDemontage(n.id);
    d.querySelectorAll('[data-reparer]').forEach(b => { b.onclick = () => reparer(b.dataset.reparer); });
    // Curseurs : direction et inclinaison, le canon tourne en direct
    const curDir = d.querySelector('#ficheDir'), curInc = d.querySelector('#ficheInc');
    const regler = () => {
      orienterRegard(reseau, n.id, +curDir.value, curInc ? +curInc.value : n.inclinaison);
      const o = regards3D.get(n.id);
      if(o) orienterCanon(o.userData.canon, n.direction, n.inclinaison);
      if(nuit){ nuit.regime = regimeNuit(niveau, reseau, nuit.regime.vent); appliquerRegime(); }
      planifierSauvegarde();
      dessinerFiche();
    };
    curDir.oninput = regler;
    if(curInc) curInc.oninput = regler;
    if(!nuit && niveau.construction !== false){
      const sel = d.querySelector('#ficheModele'), sup = d.querySelector('#ficheSupport'), btn = d.querySelector('#ficheRemplacer');
      const majBouton = () => {
        sup.hidden = CATALOGUE[sel.value].type !== 'ventilateur';
        const dv = devisEnneigeur(niveau, reseau, n.id, sel.value, sup.value);
        btn.disabled = !dv.ok;
        btn.textContent = dv.raison === 'C\'est déjà cet enneigeur.' ? 'Installé' : `Remplacer · ${euros(dv.cout)}`;
        btn.title = dv.reprise ? `Reprise de l'ancien : ${euros(dv.reprise)}` : '';
      };
      sel.onchange = majBouton; sup.onchange = majBouton; majBouton();
      btn.onclick = () => {
        const r = changerEnneigeur(niveau, reseau, n.id, sel.value, sup.value);
        if(!r.ok) return message(r.raison, 'attention');
        synchroniser(); dessinerFiche();
        message(`${n.nom} : ${nomEnneigeur(n.modele, n.support)} installé (${euros(r.cout)}, ancien repris ${euros(r.reprise)}).`, 'ok');
      };
    }
    // Où tombera la neige : anneau vert sur la piste, orange à côté
    anneauChute.visible = true;
    anneauChute.material.color.set(part >= 0.5 ? '#38D66B' : '#FF9A2E');
    anneauChute.position.set(chute.x, poser(chute.x, chute.z) + 0.8, chute.z);
    anneauChute.scale.setScalar(chute.rayon);
  }

  // ----- Modifier l'installation : départ électrique, démontage, retrait d'un réseau, déplacement -----
  const NOMS_QUOI = { eau: 'la conduite d\'eau', cable: 'le câble électrique', air: 'la conduite d\'air' };
  const texteCoupes = coupes => {
    const parRegard = new Map();
    for(const c of coupes) parRegard.set(c.id, [...(parRegard.get(c.id) || []), { eau: 'l\'eau', cable: 'le courant', air: 'l\'air' }[c.quoi]]);
    return [...parRegard].map(([id, q]) => `${noeudReseau(reseau, id).nom} perdra ${q.join(' et ')}`);
  };
  function marqueur(x, z, couleur){
    apercu.add(creerApercu({ x, z }, { x: x + 0.01, z }, poser, couleur, Math.max(1, cam.actuel.distance * 0.012)));
  }
  function outilDepart(x, z){
    const d = devisDepart(niveau, reseau, x, z);
    if(!d.ok && d.raison !== 'Budget insuffisant.') return message(d.raison, 'attention', 3500);
    fermerDevis();
    marqueur(x, z, COULEURS.reseauElec);
    proposition = { faire: () => {
      const r = ajouterDepartElec(niveau, reseau, x, z);
      if(!r.ok) return message(r.raison, 'attention');
      synchroniser();
      message(`${noeudReseau(reseau, r.id).nom} posé (${euros(r.cout)}). Tirez les câbles depuis lui avec l'outil Électricité.`, 'ok', 5000);
    } };
    afficherDevis({ titre: 'Nouveau départ électrique', lignes: ['Armoire raccordée au réseau électrique, comme celles près des bâtiments', 'Les câbles des regards pourront partir d\'ici'],
      total: d.cout, budgetApres: reseau.budget - d.cout, possible: d.ok }, valider, fermerDevis);
  }
  function proposerDemontage(id){
    const n = noeudReseau(reseau, id), d = devisDemontage(niveau, reseau, id);
    if(!d.ok) return message(d.raison, 'attention', 3500);
    fermerDevis();
    marqueur(n.x, n.z, '#D7263D');
    const lignes = [n.type === 'regard' ? `${nomEnneigeur(n.modele, n.support)} et regard repris : ${euros(d.materiel)}` : `Armoire reprise : ${euros(d.materiel)}`];
    if(d.nbTranchees) lignes.push(`${d.nbTranchees} tranchée${d.nbTranchees > 1 ? 's' : ''} retirée${d.nbTranchees > 1 ? 's' : ''} : ${euros(d.tranchees)} récupérés`);
    lignes.push(...texteCoupes(d.coupes));
    proposition = { faire: () => {
      const r = demonter(niveau, reseau, id);
      if(!r.ok) return message(r.raison, 'attention');
      synchroniser();
      message(`${n.nom} démonté : ${euros(r.rembourse)} récupérés. « Annuler » le remet en place.`, 'ok', 5000);
    } };
    afficherDevis({ titre: `Démonter ${n.nom}`, lignes, total: d.rembourse, budgetApres: reseau.budget + d.rembourse, possible: true, rendu: true, libelleOk: 'Démonter' }, valider, fermerDevis);
  }
  function outilDemonter(x, z, n){
    if(n && (n.type === 'regard' || n.ajoute)) return proposerDemontage(n.id);
    if(n) return message(`${n.nom} fait partie de la station : on ne peut pas le démonter.`, 'attention', 3500);
    // Sinon, la tranchée la plus proche
    const tol = Math.max(4, cam.actuel.distance * 0.02);
    let tr = null, dMin = tol;
    for(const q of reseau.tranchees){
      const A = noeudReseau(reseau, q.a), B = noeudReseau(reseau, q.b), d = distanceSegment(x, z, [A.x, A.z], [B.x, B.z]);
      if(d < dMin){ dMin = d; tr = q; }
    }
    if(!tr) return message('Touchez un regard ou une tranchée.', 'info', 2500);
    proposerRetrait(cleTranchee(tr.a, tr.b));
  }
  function proposerRetrait(cle){
    const tr = trancheeParCle(reseau, cle);
    fermerDevis();
    if(!tr) return;
    const A = noeudReseau(reseau, tr.a), B = noeudReseau(reseau, tr.b);
    apercu.add(creerApercu(A, B, poser, '#D7263D', Math.max(0.35, cam.actuel.distance * 0.0035)));
    const choix = ['eau', 'cable', 'air'].filter(q => tr[q]).map(q => ({ q, d: devisRetrait(niveau, reseau, cle, q) }));
    const d = afficherPanneau(`<div class="tete"><span>Tranchée ${echapper(A.nom)} – ${echapper(B.nom)}</span><span>${nombreFr(tr.longueur)} m</span></div>
      <ul><li>Retirer un réseau rend ${Math.round(CONFIG.couts.repriseTranchee * 100)} % de son prix ; une tranchée vide disparaît.</li>
      ${choix.flatMap(c => texteCoupes(c.d.coupes).map(t => `<li>Sans ${NOMS_QUOI[c.q]} : ${echapper(t)}</li>`)).join('')}</ul>
      <div class="choix-retrait">${choix.map(c => `<button class="bouton petit" type="button" data-retirer="${c.q}">Retirer ${NOMS_QUOI[c.q]} · +${euros(c.d.rembourse)}</button>`).join('')}</div>
      <div class="actions"><button class="bouton" type="button" id="retraitFermer">Fermer</button></div>`);
    d.querySelectorAll('[data-retirer]').forEach(b => { b.onclick = () => {
      const r = retirerReseau(niveau, reseau, cle, b.dataset.retirer);
      if(!r.ok) return message(r.raison, 'attention');
      synchroniser();
      message(`${NOMS_QUOI[b.dataset.retirer][0].toUpperCase()}${NOMS_QUOI[b.dataset.retirer].slice(1)} retiré${b.dataset.retirer === 'eau' || b.dataset.retirer === 'air' ? 'e' : ''} : +${euros(r.rembourse)}.`, 'ok', 3500);
      proposerRetrait(cle);
    }; });
    d.querySelector('#retraitFermer').onclick = fermerDevis;
  }
  function commencerDeplacement(id){
    fermerDevis();
    outil = 'deplacer'; deplaceId = id;
    document.querySelectorAll('[data-outil]').forEach(b => b.classList.remove('actif'));
    majPuceOutil();
    const n = noeudReseau(reseau, id);
    surbrillance.visible = true; surbrillance.material.color.set('#E58A1F'); surbrillance.position.set(n.x, poser(n.x, n.z) + 0.6, n.z);
    consigne();
  }
  function outilDeplacer(x, z){
    const n = noeudReseau(reseau, deplaceId);
    if(!n) return choisirOutil(null);
    const d = devisDeplacement(niveau, reseau, deplaceId, x, z);
    if(!d.ok && d.raison !== 'Budget insuffisant.') return message(d.raison, 'attention', 3500);
    fermerDevis();
    for(const tr of reseau.tranchees.filter(q => q.a === n.id || q.b === n.id)){
      const autre = noeudReseau(reseau, tr.a === n.id ? tr.b : tr.a);
      apercu.add(creerApercu(autre, { x, z }, poser, '#E58A1F', Math.max(0.35, cam.actuel.distance * 0.0035)));
    }
    marqueur(x, z, '#E58A1F');
    const id = deplaceId;
    proposition = { faire: () => {
      const r = deplacerRegard(niveau, reseau, id, x, z);
      if(!r.ok) return message(r.raison, 'attention');
      choisirOutil(null);
      synchroniser();
      message(`${n.nom} déplacé de ${nombreFr(r.distance)} m (${euros(r.cout)}).`, 'ok', 4000);
      ouvrirFiche(id);
    } };
    afficherDevis({ titre: `Déplacer ${n.nom}`, total: d.cout, budgetApres: reseau.budget - d.cout, possible: d.ok, libelleOk: 'Déplacer',
      lignes: [`Déplacement du regard et de l'enneigeur (${nombreFr(d.distance)} m) : ${euros(CONFIG.couts.deplacement)}`,
        d.rallonge > 0 ? `Tranchées rallongées de ${nombreFr(d.rallonge)} m : ${euros(d.cout - CONFIG.couts.deplacement)}` : 'Les tranchées raccourcissent : rien à payer en plus',
        'Les conduites et les câbles suivent le regard.'] }, valider, () => { fermerDevis(); });
  }

  // ----- Fiches du garage et des remontées -----
  function ouvrirGarageFiche(){
    fermerDevis();
    const m = DAMEUSES[reseau.dameuse.modele], aDamer = neigeADamer(reseau);
    const autres = Object.entries(DAMEUSES).filter(([k]) => k !== reseau.dameuse.modele);
    const d = afficherPanneau(`<div class="tete"><span>${echapper(G.nom)}</span><button class="fermer" type="button" id="garageFermer" aria-label="Fermer">×</button></div>
      <ul><li><b>${echapper(m.nom)}</b> : lame avant, fraise de ${nombreFr(m.largeur, 1)} m à l'arrière ; elle étale jusqu'à ${nombreFr(m.capacite)} m³ de neige par jour.</li>
      <li>Chaque matin, elle sort étaler les tas tombés sur les pistes. Seule la neige damée compte et se vend (${euros(CONFIG.gains.parM3Piste)} par m³).</li>
      <li>Neige qui attend la dameuse : <b>${nombreFr(Math.round(aDamer))} m³</b>${aDamer > m.capacite ? ' (plus que ce qu\'elle étale en un jour)' : ''}</li></ul>
      ${autres.map(([k, a]) => { const dv = devisDameuse(reseau, k);
        return `<div class="ligne"><span>${echapper(a.nom)} : ${nombreFr(a.capacite)} m³ par jour</span><button class="bouton petit" type="button" data-dameuse="${k}"${dv.ok && !nuit ? '' : ' disabled'}>Changer · ${euros(dv.cout)}</button></div>`; }).join('')}
      <p class="aide">L'ancienne dameuse est reprise ${Math.round(CONFIG.dameuse.reprise * 100)} % de son prix.</p>`);
    d.querySelector('#garageFermer').onclick = fermerDevis;
    d.querySelectorAll('[data-dameuse]').forEach(b => { b.onclick = () => {
      const r = changerDameuse(reseau, b.dataset.dameuse);
      if(!r.ok) return message(r.raison, 'attention');
      majDameuse3D(); majInfos(); planifierSauvegarde();
      message(`${DAMEUSES[b.dataset.dameuse].nom} livrée au garage (${euros(r.cout)}, ancienne reprise ${euros(r.reprise)}).`, 'ok', 5000);
      ouvrirGarageFiche();
    }; });
  }
  function ficheRemontee(ts){
    fermerDevis();
    const marche = remonteeEnMarche(reseau, ts), kw = puissanceRemontee(ts), parJour = Math.round(kw * CONFIG.remontees.heuresJour * CONFIG.electricite.prixKwh);
    const d = afficherPanneau(`<div class="tete"><span>${echapper(ts.nom)}</span><button class="fermer" type="button" id="tsFermer" aria-label="Fermer">×</button></div>
      <ul><li>${nombreFr(longueurRemontee(ts))} m, ${ts.pylones} pylônes · ${marche ? 'en marche' : 'à l\'arrêt'}</li>
      <li>En marche : ${nombreFr(kw)} kW pendant ${CONFIG.remontees.heuresJour} h d'ouverture par jour, environ ${euros(parJour)} d'électricité.</li>
      <li>Les skieurs viendront plus tard : pour l'instant, elle ne rapporte rien.</li></ul>
      <div class="actions"><button class="bouton" type="button" id="tsBasculer">${marche ? 'Arrêter' : 'Mettre en marche'}</button></div>`);
    d.querySelector('#tsFermer').onclick = fermerDevis;
    d.querySelector('#tsBasculer').onclick = () => {
      basculerRemontee(reseau, ts.nom, !marche); majRemontees3D(); planifierSauvegarde();
      message(`${ts.nom} ${marche ? 'arrêté' : 'en marche'}.`, 'info', 2500);
      ficheRemontee(ts);
    };
  }

  // ----- Bac à sable : tracer une piste, poser un télésiège -----
  const reglageTrace = { largeur: 30 };
  function dessinerTrace(){
    apercu.children.slice().forEach(o => { apercu.remove(o); liberer(o); });
    const ep = Math.max(0.35, cam.actuel.distance * 0.0035);
    if(outil === 'piste'){
      const coul = COULEURS.jalons[couleurPente(traceePiste.length >= 2 ? penteMaxi(t, traceePiste) : 0)];
      traceePiste.forEach(([x, z], i) => {
        const A = { x, z }, B = i ? { x: traceePiste[i - 1][0], z: traceePiste[i - 1][1] } : { x: x + 0.01, z };
        apercu.add(creerApercu(B, A, poser, coul, ep * (i ? 1 : 3)));
        if(i) for(const s of [-1, 1]){
          const L = Math.hypot(A.x - B.x, A.z - B.z) || 1, nx = -(A.z - B.z) / L * s * reglageTrace.largeur / 2, nz = (A.x - B.x) / L * s * reglageTrace.largeur / 2;
          apercu.add(creerApercu({ x: B.x + nx, z: B.z + nz }, { x: A.x + nx, z: A.z + nz }, poser, coul, ep * 0.5));
        }
      });
      if(traceePiste.length >= 2){
        const p = { nom: `Piste ${(reseau.pistesBac || []).length + 1}`, largeur: reglageTrace.largeur, points: traceePiste };
        apercu.add(placerPorte(creerPortePiste(p.nom, couleurPente(penteMaxi(t, traceePiste)), p.largeur), p));
      }
    }
    if(outil === 'remontee' && gareAval){
      apercu.add(creerApercu(gareAval, { x: gareAval.x + 0.01, z: gareAval.z }, poser, '#C08A5A', ep * 4));
      if(gareAmont) apercu.add(creerApercu(gareAval, gareAmont, poser, '#C08A5A', ep));
    }
  }
  function majPanneauTrace(){
    const el = $('choixTrace');
    if(outil === 'piste'){
      const v = traceePiste.length >= 2 ? validerPiste(niveau, traceePiste, reglageTrace.largeur) : null;
      const pente = traceePiste.length >= 2 ? penteMaxi(t, traceePiste) : null;
      el.innerHTML = `${pente === null ? '' : `<span class="pastille-couleur ${couleurPente(pente)}">Piste ${couleurPente(pente)} · pente ${Math.round(pente)} %</span>`}
        <label>Largeur <select id="traceLargeur">${CONFIG.bac.largeurs.map(l => `<option value="${l}"${l === reglageTrace.largeur ? ' selected' : ''}>${l} m</option>`).join('')}</select></label>
        <span>${traceePiste.length} point${traceePiste.length > 1 ? 's' : ''}${traceePiste.length >= 2 ? ` · ${nombreFr(longueurPolyligne(traceePiste))} m${(!niveau.bac || reseau.options.budget) && v && v.ok ? ` · ${euros(v.cout)}` : ''}` : ''}</span>
        <button class="bouton petit" type="button" id="traceRetour"${traceePiste.length ? '' : ' disabled'}>Point précédent</button>
        <button class="bouton petit vert" type="button" id="traceFin"${traceePiste.length >= 2 ? '' : ' disabled'}>Terminer la piste</button>`;
      el.querySelector('#traceLargeur').onchange = e => { reglageTrace.largeur = +e.target.value; dessinerTrace(); majPanneauTrace(); };
      el.querySelector('#traceRetour').onclick = () => { traceePiste.pop(); dessinerTrace(); majPanneauTrace(); };
      el.querySelector('#traceFin').onclick = terminerPiste;
    } else if(outil === 'remontee'){
      const v = gareAval && gareAmont ? validerRemontee(niveau, gareAval, gareAmont) : null;
      el.innerHTML = `<span>${!gareAval ? 'Gare de départ : touchez le bas' : !gareAmont ? 'Gare d\'arrivée : touchez le haut' : `${nombreFr(v.longueur)} m${!niveau.bac || reseau.options.budget ? ` · ${euros(v.cout)}` : ''}`}</span>
        <button class="bouton petit" type="button" id="traceRetour"${gareAval ? '' : ' disabled'}>Recommencer</button>
        <button class="bouton petit vert" type="button" id="traceFin"${v && v.ok ? '' : ' disabled'}>Construire le télésiège</button>`;
      el.querySelector('#traceRetour').onclick = () => { gareAval = gareAmont = null; dessinerTrace(); majPanneauTrace(); consigne(); };
      el.querySelector('#traceFin').onclick = terminerRemontee;
    }
  }
  function outilPiste(x, z){
    if(!dansZoneJeu(t, x, z)) return message('La piste doit rester dans le domaine skiable.', 'attention', 3000);
    traceePiste.push([x, z]);
    dessinerTrace(); majPanneauTrace();
  }
  function outilRemontee(x, z){
    if(!dansZoneJeu(t, x, z)) return message('Les gares doivent être dans le domaine skiable.', 'attention', 3000);
    if(!gareAval || gareAmont){ gareAval = { x, z }; gareAmont = null; }
    else {
      gareAmont = { x, z };
      const v = validerRemontee(niveau, gareAval, gareAmont);
      if(!v.ok){ message(v.raison, 'attention', 4500); gareAmont = null; }
    }
    dessinerTrace(); majPanneauTrace(); consigne();
  }
  // Une piste ou un télésiège change le terrain (neige damée, gares aplanies, sapins) : on enregistre et on recharge
  function rechargerBac(texte){
    reseau.messageApres = texte;
    sauver(true);
    location.href = `index.html?niveau=${niveau.id}`;
  }
  function terminerPiste(){
    const r = ajouterPisteBac(niveau, reseau, traceePiste, reglageTrace.largeur);
    if(!r.ok) return message(r.raison, 'attention', 4500);
    rechargerBac(`${r.nom} (${r.couleur}, pente ${Math.round(r.pente)} %) ouverte : ${nombreFr(r.longueur)} m. La neige qui tombe dessus compte maintenant.`);
  }
  function terminerRemontee(){
    const r = ajouterRemonteeBac(niveau, reseau, gareAval, gareAmont);
    if(!r.ok) return message(r.raison, 'attention', 4500);
    rechargerBac(`${r.nom} posé : ${nombreFr(r.longueur)} m.`);
  }

  function outilRegard(x, z, n){
    if(n && n.type === 'regard') return ouvrirFiche(n.id);
    const r = poserRegard(niveau, reseau, x, z, choix);
    if(!r.ok) return message(r.raison, 'attention', 3500);
    synchroniser();
    message(`${noeudReseau(reseau, r.id).nom} posé avec un ${nomEnneigeur(choix.modele, choix.support)} (${euros(r.cout)}). Raccordez-le à l'eau et à l'électricité${CATALOGUE[choix.modele].type === 'perche' ? ', puis à l\'air comprimé' : ''}.`, 'ok');
  }

  function outilTranchee(x, z, n){
    const quoi = outil, nomQuoi = { eau: 'eau', cable: 'électricité', air: 'air' }[quoi];
    // 1er toucher : le point de départ (la source de ce réseau, ou un regard déjà alimenté)
    if(!depart){
      if(!n || (n.type === 'regard' ? !alimentes(reseau, quoi).has(n.id) : n.type !== SOURCES[quoi])){
        const texte = n && n.type === 'regard' ? `${n.nom} n'est pas encore alimenté en ${nomQuoi}.` : '';
        const ou = { eau: 'L\'eau part de la salle de pompage', cable: 'Le câble part d\'un départ électrique', air: 'L\'air part du compresseur' }[quoi];
        return message(`${texte} ${ou} ou d'un regard déjà alimenté.`.trim(), 'attention', 4000);
      }
      depart = n;
      montrerDepart(); consigne();
      return;
    }
    if(n && n.id === depart.id){ depart = null; fermerDevis(); montrerDepart(); consigne(); return; }
    // 2e toucher : l'arrivée. On essaie sur une copie du réseau pour connaître le prix et la pression.
    const copie = JSON.parse(JSON.stringify(reseau));
    copie.budget = Infinity;
    let cible = n, nouveau = false, coutRegard = 0;
    if(!cible){
      const r = poserRegard(niveau, copie, x, z, choix);
      if(!r.ok) return message(r.raison, 'attention', 3500);
      cible = noeudReseau(copie, r.id); nouveau = true; coutRegard = r.cout;
    }
    const d = ajouterTranchee(niveau, copie, depart.id, cible.id, quoi);
    if(!d.ok) return message(d.raison, 'attention', 4000);
    const e = etatRegard(niveau, copie, cible.id), total = d.cout + coutRegard;
    const lignes = [`${nombreFr(d.longueur)} m de tranchée à ${euros(d.parMetre)}/m${d.commune ? ' : tranchée commune, on ne paie que la différence' : ''}`];
    if(nouveau) lignes.push(`Nouveau regard (${euros(CONFIG.couts.regard)}) et ${nomEnneigeur(choix.modele, choix.support)} (${euros(prixEnneigeur(choix.modele, choix.support))})`);
    if(e.eau) lignes.push(`Pression prévue au regard, canons fermés : ${Math.round(e.pression)} bar (${NOMS_ZONES[e.zone]})`);
    lignes.push(e.pret ? (CATALOGUE[cible.modele].type === 'perche' ? 'La perche sera prête : tout est raccordé.' : 'Le canon sera prêt : tout est raccordé.') : `Il manquera encore ${e.manque}.`);
    fermerDevis();
    proposition = { quoi, departId: depart.id, cibleId: nouveau ? null : cible.id, x, z };
    apercu.add(creerApercu(depart, cible, poser, COUL_OUTIL[quoi], Math.max(0.35, cam.actuel.distance * 0.0035)));
    afficherDevis({ titre: `${{ eau: 'Conduite d\'eau', cable: 'Câble électrique', air: 'Conduite d\'air' }[quoi]} : ${depart.nom} → ${cible.nom}`,
      lignes, total, budgetApres: reseau.budget - total, possible: reseau.budget >= total }, valider, fermerDevis);
  }
  function valider(){
    const p = proposition;
    if(!p) return;
    if(p.faire){ fermerDevis(); return p.faire(); }      // démontage, déplacement, départ électrique
    const lot = ++reseau.lot;
    let cibleId = p.cibleId;
    if(!cibleId){
      const r = poserRegard(niveau, reseau, p.x, p.z, choix, lot);
      if(!r.ok) return message(r.raison, 'attention');
      cibleId = r.id;
    }
    const d = ajouterTranchee(niveau, reseau, p.departId, cibleId, p.quoi, lot);
    if(!d.ok){ if(!p.cibleId) annulerAction(reseau); return message(d.raison, 'attention'); }
    fermerDevis();
    depart = noeudReseau(reseau, cibleId);          // on continue depuis le regard qu'on vient de raccorder
    synchroniser(); montrerDepart(); consigne();
    const e = etatRegard(niveau, reseau, cibleId);
    message(e.pret ? `${depart.nom} est prêt : tout est raccordé.` : `${depart.nom} raccordé. Il manque encore ${e.manque}.`, e.pret ? 'ok' : 'info');
  }

  $('annuler').onclick = () => {
    const r = annulerAction(reseau);
    if(!r.ok) return;
    fermerDevis();
    if(depart && (!noeudReseau(reseau, depart.id) || !alimentes(reseau, outil || 'eau').has(depart.id))) depart = null;
    synchroniser(); montrerDepart(); consigne();
    message(`Annulé : ${euros(r.rembourse)} remboursés.`, 'info', 3000);
  };
  $('effacer').onclick = () => {
    if(niveau.carriere){
      // Carrière : on revient au début de l'étape (le réseau construit avant l'étape reste)
      if(!confirm('Recommencer l\'étape ? Ce qui a été construit et gagné depuis son début est effacé.')) return;
      reseau = recommencerEtape(reseau); depart = null;
      sauver(true);
      location.href = 'index.html?niveau=carriere';
      return;
    }
    const commence = reseau.nuit > 1;
    if(!reseau.historique.length && !commence) return message('Rien à effacer.', 'info', 2500);
    if(!confirm(commence ? 'Recommencer le niveau ? Le réseau, la neige et l\'argent gagné sont effacés.'
                         : 'Tout effacer ? Les regards, les conduites et les câbles sont retirés et le budget est entièrement remboursé.')) return;
    reseau = nouvellePartie(); depart = null;
    effacerSauvegarde(clePartie);
    fermerDevis(); synchroniser(); montrerDepart(); consigne();
    message(commence ? 'Niveau recommencé.' : 'Réseau effacé, budget remboursé.', 'info', 3000);
  };
  // Vue sous-sol : le terrain devient transparent, on voit les conduites (bleu) et les câbles (jaune)
  $('sousSol').onclick = () => {
    sousSol = !sousSol;
    $('sousSol').classList.toggle('actif', sousSol);
    const m = terrain.material;
    m.transparent = sousSol; m.opacity = sousSol ? 0.3 : 1; m.depthWrite = !sousSol; m.needsUpdate = true;
    for(const o of decor) o.visible = !sousSol;
    for(const o of tranchees3D) o.surface.visible = !sousSol;
    for(const o of tas3D.values()) o.visible = !sousSol;
    groupeSousSol.visible = sousSol;
    message(sousSol ? `Vue sous-sol : conduites d'eau en bleu, câbles électriques en jaune${K ? ', air comprimé en blanc' : ''}.` : 'Vue normale : le réseau est enterré, seule la trace des tranchées se voit.', 'info', 3500);
  };

  // ----- Les nuits -----
  function lancerNuit(){
    if(nuit || journee) return;
    if(EXPL && reseau.exploitation.phase === 'matin') return lancerJournee();     // le matin, on ouvre la station
    const prets = reseau.noeuds.filter(n => n.type === 'regard' && etatRegard(niveau, reseau, n.id).pret).length;
    if(!prets && !EXPL) return message(`Aucun canon n'est prêt : raccordez au moins un regard à l'eau et à l'électricité${K ? ' (et à l\'air pour une perche)' : ''}.`, 'attention', 4500);
    if(sousSol) $('sousSol').onclick();
    choisirOutil(null); fermerTiroir();
    garer();                                               // la nuit, la dameuse reste au garage
    nuit = { regime: debutNuit(niveau, reseau), temps: 0, vitesse: 1 };
    const evDepart = evenementsProgramme(niveau, reseau, -1, 0);
    if(evDepart.length) nuit.regime = regimeNuit(niveau, reseau, nuit.regime.vent);
    $('barreJeu').classList.add('en-nuit');
    $('accelerer').hidden = false; majBoutonVitesse(1);
    $('choixEnneigeur').hidden = true;
    appliquerRegime();
    const v = nuit.regime.vent, actifs = nuit.regime.canons.filter(c => c.production).length;
    message(`Nuit ${reseau.nuit} : vent ${v.force ? v.force + ' km/h' : 'nul'}. ${actifs} canon${actifs > 1 ? 's' : ''} en production.`, 'info', 5000);
    if(nuit.regime.pompes) for(const c of nuit.regime.canons.filter(q => !q.production && !q.arrete && !attendAir(q)))
      message(`${noeudReseau(reseau, c.id).nom} arrêté : ${Math.round(c.pression)} bar, il en faut ${CATALOGUE[c.modele].pressionMin}.`, 'attention', 6000);
    for(const t of new Set(evDepart.map(e => e.texte))) if(t) message(t, 'info', 5000);
    if(nuit.regime.canons.some(attendAir)) message(nuit.regime.air.marche
      ? 'Le compresseur démarre : les perches produiront dès que la pression d\'air sera suffisante.'
      : 'Compresseur arrêté : démarrez-le au poste de travail pour que les perches produisent.', nuit.regime.air.marche ? 'info' : 'attention', 6000);
    if(niveau.programme){
      ouvrirPoste();
      message('Démarrez une pompe vanne fermée, puis ouvrez la vanne doucement. Gardez le départ dans le vert.', 'attention', 8000);
    }
    if(nuit.regime.sec) message('Retenue vide : les pompes sont à sec !', 'alarme', 6000);
    if(avecPannes() && reseau.pannes.length) message(`${reseau.pannes.length} panne(s) pas encore réparée(s) : voyez en haut à droite.`, 'attention', 6000);
    majInfos();
  }
  // Applique le régime de la nuit : voyants des canons, jets de neige, salle de pompage
  const _v = new THREE.Vector3();
  let sources = [];
  function appliquerRegime(){
    const g = nuit.regime;
    sources = [];
    for(const [id, o] of regards3D){
      const c = g.canons.find(q => q.id === id);
      marquer(o, !c || c.arrete ? 'arret' : !c.production || c.panne ? 'defaut' : c.facteur >= 0.999 ? 'production' : 'faible');
      if(c && c.production) sources.push({
        depart: positionBuse(o.userData.canon, new THREE.Vector3()),
        arrivee: new THREE.Vector3(c.chute.x, poser(c.chute.x, c.chute.z) + 0.4, c.chute.z),
        rayon: c.chute.rayon, hauteur: CATALOGUE[c.modele].type === 'perche' ? 1 : Math.max(1.5, c.chute.hauteurJet * 0.5), force: c.facteur });
    }
    etatSalleDepuis(g);
    if(compresseur) etatCompresseur(compresseur, { marche: !!(g.air && g.air.marche), pression: reseau.compresseur.pression });
    rafraichirPoste();
  }
  // La salle de pompage montre les pompes en marche, la pression de départ, l'ouverture de la vanne, l'alarme
  function etatSalleDepuis(g){
    const cmd = reseau.pompage;
    const marche = marchePompes(g), defaut = [0, 1, 2].map(i => !!g && g.pompesEnPanne.includes(i));
    etatSallePompage(salle, { marche, defaut, pressions: marche.map(m => m ? g.pressionDepart : 0), pressionDepart: g ? g.pressionDepart : 0,
      ouverture: cmd.ouverture, alarme: (!!g && (g.sec || g.surcharge)) || performance.now() < alarmeJusqua });
  }
  // Pompes en marche (en automatique, les premières pompes qui ne sont pas en panne)
  const installees = niveau.pompes || CONFIG.pompage.pompes;     // carrière : pompes déjà installées
  // Fin de nuit en carrière : l'étape continue, est réussie (on passe à la suivante) ou ratée (on la recommence)
  function bilanCarriere(bilan, casse){
    const o = niveau.objectif, a = avancementEtape(reseau), R = niveau.retenue;
    if(bilan.reussi && niveau.derniere){
      progression.niveaux.carriere = { ...(progression.niveaux.carriere || {}), fini: true };
      ecrireSauvegarde('nivo-progression', progression);
    }
    sauver();
    const lignes = [
      `Neige tombée sur les pistes cette nuit : ${nombreFr(bilan.piste)} m³ (${nombreFr(bilan.neige)} m³ produits)`,
      `Damage du matin : ${nombreFr(bilan.dame)} m³ étalés sur les pistes (${DAMEUSES[reseau.dameuse.modele].nom}, ${nombreFr(bilan.capacite)} m³ par jour au plus)${bilan.aDamer >= 1 ? ` · encore ${nombreFr(bilan.aDamer)} m³ à damer demain` : ''}`,
      `Étape : ${nombreFr(Math.round(a.neige))} / ${nombreFr(o.m3)} m³ sur les pistes · recettes ${euros(Math.round(a.recette))} / ${euros(o.recette)} · nuit ${a.nuits} sur ${o.nuits}`,
      bilan.kwh ? `Électricité : ${nombreFr(bilan.kwh)} kWh${bilan.kwhRemontees ? ` (dont ${nombreFr(bilan.kwhRemontees)} pour les remontées)` : ''}, soit ${euros(bilan.electricite)}` : null,
      reseau.retenue ? `Eau de la journée : ${nombreFr(bilan.remplissage.m3)} m³ (${euros(bilan.remplissage.cout)}) · retenue à ${Math.round(reseau.retenue.volume / volumeRetenue(R) * 100)} %` : null,
      avecPannes() ? `Pannes : ${bilan.pannes} cette nuit, réparations ${euros(bilan.reparations)}${reseau.pannes.length ? ` · encore ${reseau.pannes.length} à réparer (en haut à droite)` : ''}` : null,
      bilan.coups ? `Coups de bélier : ${bilan.coups} (réparations : ${euros(bilan.coups * CONFIG.belier.reparation)})` : null
    ].filter(Boolean);
    let titre = `Fin de la nuit · étape ${niveau.numero}`, boutons = '<button class="bouton" type="button" id="bilanOk">Continuer</button>', extra = '';
    if(bilan.reussi){
      titre = niveau.derniere ? 'Carrière terminée !' : `Étape ${niveau.numero} réussie !`;
      const debloque = nomsDeblocages(niveau.debloque);
      extra = niveau.derniere ? '<li><b>Bravo : la station de la Combe est prête pour toute la saison.</b></li>'
        : debloque.length ? `<li><b>Débloqué : ${debloque.map(echapper).join(', ')}.</b></li>` : '';
      const suite = !niveau.derniere && niveauCarriere(niveau.etape + 1);
      if(suite) extra += `<li>Étape suivante : ${echapper(suite.nom)} · ${nombreFr(suite.objectif.m3)} m³ et ${euros(suite.objectif.recette)} en ${suite.objectif.nuits} nuits.</li>`;
      boutons = `${suite ? '<button class="bouton" type="button" id="bilanSuivant">Étape suivante</button>' : ''}<button class="bouton" type="button" id="bilanOk">Continuer ici</button>`;
    } else if(bilan.rate){
      titre = `Étape ${niveau.numero} ratée`;
      lignes.push(bilan.rate);
      boutons = '<button class="bouton" type="button" id="bilanRecommencer">Recommencer l\'étape</button><button class="bouton" type="button" id="bilanOk">Fermer</button>';
    }
    fermerDevis();
    const d = afficherPanneau(`<div class="tete"><span>${echapper(titre)}</span><span>${bilan.net >= 0 ? '+' : '−'}${euros(Math.abs(bilan.net))}</span></div>
      <ul>${lignes.map(l => `<li>${echapper(l)}</li>`).join('')}${extra}</ul>
      <div class="actions">${boutons}</div>`);
    d.querySelector('#bilanOk').onclick = fermerDevis;
    const sv = d.querySelector('#bilanSuivant');
    if(sv) sv.onclick = () => {
      const suite = niveauCarriere(niveau.etape + 1);
      commencerEtape(suite, reseau, suite.etape);
      sauver(true);
      location.href = 'index.html?niveau=carriere';
    };
    const rec = d.querySelector('#bilanRecommencer');
    if(rec) rec.onclick = () => { reseau = recommencerEtape(reseau); sauver(true); location.href = 'index.html?niveau=carriere'; };
    if(bilan.reussi) message(titre, 'ok', 7000);
    if(bilan.rate) message(bilan.rate, 'alarme', 8000);
  }
  function marchePompes(g){
    const cmd = reseau.pompage, hs = g ? g.pompesEnPanne : (reseau.pannes || []).filter(p => p.type === 'pompe').map(p => +p.cible);
    if(cmd.mode !== 'auto') return [0, 1, 2].map(i => !!g && i < installees && cmd.marche[i] && !hs.includes(i));
    const dispo = [0, 1, 2].filter(i => i < installees && !hs.includes(i)).slice(0, g ? g.pompes : 0);
    return [0, 1, 2].map(i => dispo.includes(i));
  }

  // ----- Pannes (niveau 4) : repères en 3D, réparations -----
  const alertes3D = new Map();
  function majPannes3D(){
    const vues = new Set();
    for(const p of reseau.pannes || []){
      const pos = positionPanne(reseau, p);
      if(!pos) continue;
      vues.add(p.id);
      let a = alertes3D.get(p.id);
      if(!a){
        a = { alerte: creerAlerte(), fuite: p.type === 'fuite' ? creerFuite() : null };
        let h = 5;
        if(p.type === 'pompe') h = 9;
        else if(p.type === 'remontee') h = 14;
        else if(p.type === 'fuite') h = 3;
        else if(regards3D.has(p.cible)) h = regards3D.get(p.cible).userData.point.position.y + 1.6;
        a.alerte.position.set(pos.x, poser(pos.x, pos.z) + h, pos.z);
        if(p.type === 'pompe') a.alerte.position.set(niveau.pompage.x, coteReplat(t, niveau.pompage) - t.altBas + h, niveau.pompage.z);
        scene.add(a.alerte);
        if(a.fuite){ a.fuite.position.set(pos.x, poser(pos.x, pos.z), pos.z); scene.add(a.fuite); }
        alertes3D.set(p.id, a);
      }
      etatAlerte(a.alerte, p.etat === 'reparation');
      if(a.fuite) a.fuite.userData.active = p.etat === 'active';
    }
    for(const [id, a] of alertes3D) if(!vues.has(id)){
      scene.remove(a.alerte); if(a.fuite){ scene.remove(a.fuite); liberer(a.fuite); }
      alertes3D.delete(id);
    }
  }
  function animerPannes(dt, temps){
    for(const a of alertes3D.values()){
      a.alerte.material.opacity = a.alerte.userData.reparation ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(temps * 3));
      if(a.fuite) animerFuite(a.fuite, dt, temps);
    }
  }
  const avecPannes = () => !!niveau.pannes || !!(reseau.options && reseau.options.pannes) || !!(reseau.pannes || []).length;
  const nomPanne = p => `${CONFIG.pannes.types[p.type].nom} · ${libellePanne(reseau, p)}`;
  function reparer(id){
    const p = (reseau.pannes || []).find(q => q.id === id);
    if(!p) return;
    const r = reparerPanne(niveau, reseau, id, !!(nuit || journee), nuit ? nuit.temps : journee ? journee.temps : 0);
    if(!r.ok) return message(r.raison, 'attention', 4000);
    const verbe = p.type === 'disjoncteur' ? 'Réarmement' : 'Réparation';
    message(r.finie ? `${verbe} faite : ${libellePanne(reseau, p)}${r.cout ? ` (${euros(r.cout)})` : ''}.`
                    : `L'équipe part : ${libellePanne(reseau, p)}, environ ${r.duree} s${p.type === 'fuite' ? ' (conduite isolée pendant les travaux)' : ''}.`, 'info', 4500);
    apresPannes();
  }
  // Coin en haut à gauche : les objectifs du niveau (étapes de construction, production, argent)
  // Objectifs repliés d'office (un badge « 🎯 Objectifs 2 / 5 ») ; le choix du joueur est gardé
  let objectifsReplie = lireSauvegarde('nivo-objectifs-ouverts') !== true;
  function listeObjectifs(){
    const o = niveau.objectif, L = [];
    if(niveau.bac) return L;
    if(EXPL) return objectifsExploitation();
    const regards = reseau.noeuds.filter(n => n.type === 'regard'), prets = regards.filter(n => etatRegard(niveau, reseau, n.id).pret);
    if(niveau.construction !== false){
      L.push({ texte: 'Poser un regard et son enneigeur', fait: regards.length > 0 });
      L.push({ texte: 'Raccorder un canon à l\'eau et à l\'électricité', fait: prets.length > 0 });
      if(niveau.compresseur) L.push({ texte: 'Raccorder une perche à l\'air comprimé', fait: prets.some(n => CATALOGUE[n.modele].type === 'perche') });
    } else L.push({ texte: 'Démarrer une pompe vanne fermée, puis ouvrir doucement', fait: reseau.nuit > 1 || (!!nuit && reseau.pompage.ouverture > 0) });
    const nuitsFaites = niveau.carriere ? avancementEtape(reseau).nuits : reseau.nuit - 1;
    L.push({ texte: 'Lancer une nuit', fait: nuitsFaites > 0 || !!nuit });
    if(o.m3){
      const f = neigeObjectif();
      L.push({ texte: o.type === 'production' ? 'Objectif de production' : 'Objectif de neige sur les pistes', fait: f >= o.m3, progres: f / o.m3,
        detail: `${nombreFr(Math.round(f))} / ${nombreFr(o.m3)} m³${o.nuits ? ` · nuit ${Math.min(nuitsFaites + 1, o.nuits)} sur ${o.nuits}` : ''}` });
    }
    if(o.recette){
      const a = avancementEtape(reseau).recette;
      L.push({ texte: 'Objectif financier', fait: a >= o.recette, progres: a / o.recette, detail: `${euros(Math.round(a))} / ${euros(o.recette)} de recettes (neige vendue − électricité − eau)` });
    }
    if(o.coupsMax !== undefined) L.push({ texte: `Pas plus de ${o.coupsMax} coups de bélier`, fait: (reseau.coups || 0) <= o.coupsMax, detail: `${reseau.coups || 0} pour l'instant` });
    return L;
  }
  function majObjectifs(){
    afficherObjectifs(listeObjectifs(), objectifsReplie, action => { if(action === 'replier'){ objectifsReplie = !objectifsReplie; ecrireSauvegarde('nivo-objectifs-ouverts', !objectifsReplie); majObjectifs(); } });
  }
  // Coin en haut à droite : la liste des pannes en cours (replié d'office sur un petit écran)
  let coinReplie = window.innerWidth < 1100;
  function majCoinPannes(){
    afficherPannesCoin((reseau.pannes || []).map(p => ({ id: p.id, nom: CONFIG.pannes.types[p.type].nom, ou: libellePanne(reseau, p),
      reparation: p.etat === 'reparation', reste: p.etat === 'reparation' && (nuit || journee) ? Math.max(0, Math.ceil(p.fin - (nuit || journee).temps)) : null,
      cout: CONFIG.pannes.types[p.type].cout, rearmer: p.type === 'disjoncteur' })), coinReplie, (action, valeur) => {
      if(action === 'replier'){ coinReplie = !coinReplie; return majCoinPannes(); }
      if(action === 'reparer') return reparer(valeur);
      if(action === 'voirPanne') return agirPoste('voirPanne', valeur);
    });
  }
  // Une panne arrive ou se termine : on recalcule la nuit et la 3D
  function apresPannes(){
    if(nuit){ nuit.regime = regimeNuit(niveau, reseau, nuit.regime.vent); appliquerRegime(); }
    else etatSalleDepuis(null);
    majPannes3D(); majInfos(); planifierSauvegarde();
    if(fiche) dessinerFiche();
    rafraichirPoste();
  }

  function finirNuit(casse = false){
    const bilan = finNuit(niveau, reseau);
    fermerLePoste();                                  // le bilan ne doit pas rester caché derrière le poste
    nuit = null; sources = [];
    jets.vider();
    for(const o of regards3D.values()) marquer(o, 'arret');
    etatSalleDepuis(null);
    if(compresseur) etatCompresseur(compresseur, { marche: false, pression: 0 });
    rafraichirPoste();
    $('barreJeu').classList.remove('en-nuit');
    $('accelerer').hidden = true;
    afficherConsigne(null);
    synchroniser();
    majPannes3D();
    if(bilan.dame > 0){
      commencerTournee(bilan.tasDames);
      message(`Le matin, la dameuse sort du garage et étale ${nombreFr(bilan.dame)} m³ sur les pistes.`, 'info', 6000);
    }
    if(niveau.carriere) return bilanCarriere(bilan, casse);
    if(EXPL) return bilanNuitExploitation(bilan);
    const premiereReussite = bilan.reussi && !reussi;
    if(premiereReussite){
      reussi = true;
      progression.niveaux[niveau.id] = { ...(progression.niveaux[niveau.id] || {}), reussi: true, nuits: bilan.nuit };
      ecrireSauvegarde('nivo-progression', progression);
    }
    sauver();
    const R = niveau.retenue, o = niveau.objectif, suivant = LEVELS.slice(LEVELS.indexOf(niveau) + 1).find(l => !l.bac);
    const lignes = [
      `Neige produite : ${nombreFr(bilan.neige)} m³, dont ${nombreFr(bilan.piste)} m³ tombés sur la piste`,
      `Damage du matin : ${nombreFr(bilan.dame)} m³ étalés sur les pistes (${DAMEUSES[reseau.dameuse.modele].nom}, ${nombreFr(bilan.capacite)} m³ par jour au plus)${bilan.aDamer >= 1 ? ` · encore ${nombreFr(bilan.aDamer)} m³ à damer demain` : ''}`,
      bilan.kwh ? `Électricité : ${nombreFr(bilan.kwh)} kWh${bilan.kwhRemontees ? ` (dont ${nombreFr(bilan.kwhRemontees)} pour les remontées)` : ''}, soit ${euros(bilan.electricite)} retirés du gain` : null,
      bilan.rendement !== null ? `Rendement : ${Math.round(bilan.rendement * 100)} % de ce que les canons ouverts pouvaient produire` : null,
      `${o.type === 'production' ? 'Neige produite' : 'Sur la piste'} depuis le début : ${nombreFr(neigeObjectif())}${o.m3 ? ` / ${nombreFr(o.m3)}` : ''} m³${o.nuits ? ` (nuit ${bilan.nuit} sur ${o.nuits})` : ''}`,
      o.coupsMax !== undefined ? `Coups de bélier : ${bilan.coups} cette nuit, ${reseau.coups} au total (${o.coupsMax} au plus)` : (bilan.coups ? `Coups de bélier : ${bilan.coups} (réparations : ${euros(bilan.coups * CONFIG.belier.reparation)})` : null),
      avecPannes() ? `Pannes : ${bilan.pannes} cette nuit, réparations ${euros(bilan.reparations)}${reseau.pannes.length ? ` · encore ${reseau.pannes.length} à réparer (en haut à droite)` : ''}` : null,
      reseau.retenue ? `Retenue : ${Math.round(reseau.retenue.volume / volumeRetenue(R) * 100)} % après le remplissage de la journée (${nombreFr(bilan.remplissage.m3)} m³ d'eau, ${euros(bilan.remplissage.cout)})` : null
    ].filter(Boolean);
    let titre = `Fin de la nuit ${bilan.nuit}`, boutons = '<button class="bouton" type="button" id="bilanOk">Continuer</button>';
    if(casse) titre = 'Casse !';
    if(bilan.rate){
      titre = casse ? 'Casse de la conduite : niveau raté' : 'Niveau raté';
      lignes.push(bilan.rate);
      boutons = '<button class="bouton" type="button" id="bilanRecommencer">Recommencer le niveau</button><button class="bouton" type="button" id="bilanOk">Fermer</button>';
    } else if(premiereReussite){
      titre = 'Niveau réussi !';
      lignes.push(niveau.programme ? 'Bravo : la salle de pompage a tourné sans casse.' : 'Bravo : la piste est prête pour l\'ouverture.');
      boutons = `${suivant ? `<button class="bouton" type="button" id="bilanSuivant">Niveau suivant</button>` : ''}<button class="bouton" type="button" id="bilanOk">Continuer ici</button>`;
    }
    fermerDevis();
    const net = bilan.gain - bilan.electricite - bilan.remplissage.cout;
    const d = afficherPanneau(`<div class="tete"><span>${echapper(titre)}</span><span>${net >= 0 ? '+' : '−'}${euros(Math.abs(net))}</span></div>
      <ul>${lignes.map(l => `<li>${echapper(l)}</li>`).join('')}
      ${bilan.nouveaux.map(k => `<li><b>Nouveau : ${echapper(CATALOGUE[k].nom)} disponible !</b></li>`).join('')}</ul>
      <div class="actions">${boutons}</div>`);
    d.querySelector('#bilanOk').onclick = fermerDevis;
    const rec = d.querySelector('#bilanRecommencer');
    if(rec) rec.onclick = () => { effacerSauvegarde(clePartie); location.href = `index.html?niveau=${niveau.id}&nouvelle`; };
    const sv = d.querySelector('#bilanSuivant');
    if(sv) sv.onclick = () => { location.href = `index.html?niveau=${suivant.id}`; };
    if(premiereReussite) message('Niveau réussi !', 'ok', 7000);
    if(bilan.rate) message(bilan.rate, 'alarme', 8000);
  }
  $('lancerNuit').onclick = lancerNuit;

  // ----- Poste de travail -----
  let posteOuvert = false;
  function donneesPoste(){
    const cmd = reseau.pompage, g = nuit && nuit.regime, R = niveau.retenue;
    const alarmes = [];
    if(g && g.sec) alarmes.push({ niveau: 'rouge', texte: 'Retenue vide : pompes à sec.' });
    if(g && g.surcharge) alarmes.push({ niveau: 'rouge', texte: `Pompes en surcharge : ${nombreFr(g.debit)} m³/h demandés pour ${nombreFr(g.capacite)} m³/h. Démarrez une pompe ou arrêtez des canons.` });
    if(g && g.pompes && (g.pressionDepart < CONFIG.pompage.zoneVerte[0] || g.pressionDepart > CONFIG.pompage.zoneVerte[1]))
      alarmes.push({ niveau: g.pressionDepart > CONFIG.pression.zones.surpression ? 'rouge' : '', texte: `Pression au départ hors du vert : ${Math.round(g.pressionDepart)} bar (${CONFIG.pompage.zoneVerte[0]} à ${CONFIG.pompage.zoneVerte[1]} conseillés).` });
    if(performance.now() < alarmeJusqua) alarmes.push({ niveau: 'rouge', texte: 'Coup de bélier ! Manœuvrez plus doucement.' });
    if(g && g.pompes && cmd.ouverture <= 0) alarmes.push({ niveau: '', texte: 'Pompe en marche, vanne principale fermée : ouvrez-la doucement.' });
    for(const p of reseau.pannes || []) if(p.etat === 'active') alarmes.push({ niveau: 'rouge', texte: `Panne : ${nomPanne(p)}.` });
    if(g && g.fuite) alarmes.push({ niveau: 'rouge', texte: `Fuite : ${nombreFr(g.fuite)} m³/h perdus, la pression chute en aval.` });
    if(cmd.mode === 'manuel' && !cmd.marche.some(Boolean)) alarmes.push({ niveau: 'rouge', texte: 'Mode manuel : aucune pompe démarrée.' });
    if(g && g.air){
      const perches = g.canons.filter(c => c.pressionAir !== null && !c.arrete);
      if(perches.length && !g.air.marche) alarmes.push({ niveau: 'rouge', texte: 'Compresseur arrêté : les perches n\'ont pas d\'air.' });
      else if(g.air.demande > g.air.capacite) alarmes.push({ niveau: '', texte: `Compresseur surchargé : ${nombreFr(g.air.demande)} Nm³/h demandés pour ${nombreFr(g.air.capacite)}. La pression d'air baisse.` });
      if(perches.some(c => c.pressionAir < CONFIG.air.pressionMin) && g.air.marche) alarmes.push({ niveau: '', texte: `Pression d'air trop basse pour certaines perches (${CONFIG.air.pressionMin} bar minimum).` });
    }
    const canons = reseau.noeuds.filter(n => n.type === 'regard').map(n => {
      const e = etatRegard(niveau, reseau, n.id), c = g && g.canons.find(q => q.id === n.id), m = CATALOGUE[n.modele];
      let led, etat, pression = null, production = null, part = null;
      const pn = (reseau.pannes || []).find(p => p.cible === n.id);
      if(!e.pret){ led = 'manque'; etat = `Il manque ${e.manque}`; }
      else if(pn && pn.type === 'moteur'){ led = 'defaut'; etat = pn.etat === 'reparation' ? 'En réparation' : 'Moteur en panne'; }
      else if(n.arret){ led = 'arret'; etat = niveau.programme ? 'En attente du chef d\'équipe' : 'Arrêté au poste'; }
      else if(c){
        pression = c.pression; production = c.production; part = c.part;
        led = !c.production ? (attendAir(c) && c.zone !== 'surpression' ? 'faible' : 'defaut') : c.facteur >= 0.999 ? 'production' : 'faible';
        etat = !c.production ? (c.zone === 'surpression' ? 'Surpression' : attendAir(c) ? 'Pas assez d\'air' : 'Pression insuffisante') : c.panne === 'gel' ? 'Buse gelée' : c.facteur >= 0.999 ? 'Production' : 'Production réduite';
        if(c.panne === 'gel') led = 'defaut';
        if(!c.production && c.zone !== 'surpression' && !attendAir(c)) alarmes.push({ niveau: '', texte: `${n.nom} : ${Math.round(c.pression)} bar, il en faut ${m.pressionMin}.` });
        if(c.zone === 'surpression') alarmes.push({ niveau: 'rouge', texte: `${n.nom} : surpression (${Math.round(c.pression)} bar), canon en sécurité.` });
      } else { led = 'pret'; etat = 'Prêt'; pression = e.pression; }
      return { id: n.id, nom: n.nom, modele: nomEnneigeur(n.modele, n.support), led, etat, pression, production, part, arrete: !!n.arret,
        pressionAir: c ? c.pressionAir : null, cle: n.modele,
        pilotable: e.pret && !niveau.programme };                    // au niveau 1, c'est le chef d'équipe qui ouvre les canons
    });
    return {
      numero: reseau.nuit, vent: ventActuel(), accelere: !!nuit && nuit.vitesse > 1, vitesse: nuit ? nuit.vitesse : 1, total: neigeObjectif(), objectif: niveau.objectif.m3 || null,
      remplissage: reseau.retenue ? { m3: reseau.retenue.remplissage ?? CONFIG.retenue.remplissageJour,
        choix: CONFIG.retenue.choix.filter(m => m <= (niveau.remplissageMax || Infinity)), prix: niveau.prixEau ?? CONFIG.retenue.prixM3 } : null,
      recette: niveau.carriere ? { fait: Math.round(avancementEtape(reseau).recette), objectif: niveau.objectif.recette } : null,
      coups: reseau.coups || 0, coupsMax: niveau.objectif.coupsMax ?? null,
      retenue: reseau.retenue ? reseau.retenue.volume / volumeRetenue(R) : null,
      nuit: nuit && { numero: reseau.nuit, restant: Math.max(0, Math.ceil(CONFIG.nuit.duree - nuit.temps)), neige: reseau.pisteNuit },
      damage: G ? { nom: DAMEUSES[reseau.dameuse.modele].nom, capacite: DAMEUSES[reseau.dameuse.modele].capacite, aDamer: Math.round(neigeADamer(reseau)) } : null,
      remontees: (niveau.remontees || []).map((ts, i) => ({ i, nom: ts.nom, enMarche: remonteeEnMarche(reseau, ts), kw: puissanceRemontee(ts) })),
      pompage: { mode: cmd.mode, ouverture: cmd.ouverture,
        marche: cmd.mode === 'auto' ? marchePompes(g) : cmd.marche.slice(),
        defaut: [0, 1, 2].map(i => (reseau.pannes || []).some(p => p.type === 'pompe' && +p.cible === i)), installees,
        pression: g ? g.pressionDepart : 0, debit: g ? g.debit : 0, capacite: g ? g.capacite : 0, modeImpose: !!niveau.programme,
        dansLeVert: !!g && g.pressionDepart >= CONFIG.pompage.zoneVerte[0] && g.pressionDepart <= CONFIG.pompage.zoneVerte[1] },
      air: reseau.compresseur && {
        marche: g ? !!g.air.marche : (cmd.mode === 'manuel' && reseau.compresseur.marche),
        commande: !!reseau.compresseur.marche, pilotable: cmd.mode === 'manuel',
        pression: reseau.compresseur.pression, demande: g ? g.air.demande : 0, capacite: CONFIG.air.capacite },
      electricite: nuit ? { kwh: Math.round(reseau.kwhNuit || 0), euros: Math.round((reseau.kwhNuit || 0) * CONFIG.electricite.prixKwh) } : null,
      alarmes, canons
    };
  }
  function rafraichirPoste(){ if(posteOuvert) afficherPoste(donneesPoste(), agirPoste); }
  function ouvrirPoste(){
    fermerDevis();
    posteOuvert = true;
    rafraichirPoste();
  }
  function fermerLePoste(){ posteOuvert = false; fermerPoste(); }
  // Une commande du poste change le fonctionnement : on recalcule tout de suite la nuit en cours
  function agirPoste(action, valeur){
    const cmd = reseau.pompage;
    if(action === 'fermer') return fermerLePoste();
    if(action === 'lancerNuit'){ lancerNuit(); return rafraichirPoste(); }
    if(action === 'reparer') return reparer(valeur);
    if(action === 'remontee'){ const ts = niveau.remontees[+valeur]; basculerRemontee(reseau, ts.nom, !remonteeEnMarche(reseau, ts)); majRemontees3D(); planifierSauvegarde(); return rafraichirPoste(); }
    if(action === 'garage'){ fermerLePoste(); return ouvrirGarageFiche(); }
    if(action === 'remplissage'){ reseau.retenue.remplissage = Math.min(+valeur, niveau.remplissageMax || Infinity); planifierSauvegarde(); return rafraichirPoste(); }
    if(action === 'voirPanne'){
      const p = (reseau.pannes || []).find(q => q.id === valeur), pos = p && positionPanne(reseau, p);
      if(!pos) return;
      fermerLePoste();
      if(p.type !== 'fuite' && p.type !== 'pompe' && p.type !== 'disjoncteur') return agirPoste('voir', p.cible);
      cam.aller({ x: pos.x, z: pos.z, distance: 50 });
      return;
    }
    if(action === 'accelerer'){ $('accelerer').onclick(); return rafraichirPoste(); }
    if(action === 'voir'){
      const n = noeudReseau(reseau, valeur);
      fermerLePoste();
      cam.aller({ x: n.x, z: n.z, distance: 60 });
      return ouvrirFiche(valeur);
    }
    const circule = !!nuit && (cmd.mode === 'auto' || cmd.marche.some(Boolean)), maintenant = performance.now() / 1000;
    let r = null;
    if(action === 'mode' && !niveau.programme) commanderPompes(reseau, valeur);
    if(action === 'pompe' && cmd.mode === 'manuel') r = commanderPompe(niveau, reseau, +valeur, !cmd.marche[+valeur], !!nuit);
    if(action === 'vanne') r = commanderVanne(reseau, cmd.ouverture + Number(valeur), maintenant, niveau, circule);
    if(action === 'vanne-curseur') r = commanderVanne(reseau, Number(valeur), maintenant, niveau, circule);
    if(r && r.coup){
      // Coup de bélier : alarme, gyrophares ; au-delà du maximum du niveau, la conduite casse
      alarmeJusqua = performance.now() + 4000;
      const max = niveau.objectif.coupsMax;
      message(`Coup de bélier (${r.raison}) !${max !== undefined ? ` ${reseau.coups} / ${max}` : ` Réparation : ${euros(CONFIG.belier.reparation)}.`}`, 'alarme', 6000);
      if(nuit && resultatNiveau(niveau, reseau).rate){ finirNuit(true); return; }
    }
    if(action === 'canon'){ const n = noeudReseau(reseau, valeur); commanderCanon(reseau, valeur, !!n.arret); }
    if(action === 'compresseur' && cmd.mode === 'manuel') commanderCompresseur(reseau, !reseau.compresseur.marche);
    if(nuit){ nuit.regime = regimeNuit(niveau, reseau, nuit.regime.vent); appliquerRegime(); }
    else etatSalleDepuis(null);
    rafraichirPoste();
  }
  $('ouvrirPoste').onclick = () => posteOuvert ? fermerLePoste() : ouvrirPoste();

  // ----- Menu des niveaux -----
  function carteNiveau(l, i){
    const pr = progression.niveaux[l.id] || {}, partie = lireSauvegarde(`nivo-partie-${l.id}`);
    const ouvert = CONFIG.progression.toutOuvert || i === 0 || !!l.bac || !!(progression.niveaux[LEVELS[i - 1].id] || {}).reussi;
    let etat = l.bac ? 'Pour s\'entraîner et essayer' : pr.reussi ? 'Réussi ✓' : 'Pas encore réussi';
    if(partie && partie.reseau){
      const fait = l.objectif.type === 'production' ? partie.reseau.neigeTotale : partie.reseau.neigePiste;
      etat = `${pr.reussi ? 'Réussi ✓ · ' : ''}Partie en cours : prochaine nuit n° ${partie.reseau.nuit}, ${nombreFr(Math.round(fait))}${l.objectif.m3 ? ` / ${nombreFr(l.objectif.m3)}` : ''} m³`;
    }
    if(!ouvert) etat = 'Réussissez le niveau précédent pour l\'ouvrir.';
    return { id: l.id, numero: l.numero, nom: l.nom, resume: l.resume, etat, ouvert, partie: !!(partie && partie.reseau) };
  }
  function carteCarriere(){
    const partie = lireSauvegarde('nivo-partie-carriere'), r = partie && partie.reseau, total = CARRIERE.etapes.length;
    const fini = !!(progression.niveaux.carriere || {}).fini;
    let etat = `${total} étapes, de la première pompe à la saison complète.`;
    if(r && r.carriere){
      const n = niveauCarriere(r.carriere.etape), a = avancementEtape(r);
      etat = `${fini ? 'Carrière terminée ✓ · ' : ''}Étape ${n.numero} / ${total} · ${n.nom} : ${nombreFr(Math.round(a.neige))} / ${nombreFr(n.objectif.m3)} m³, nuit ${a.nuits + 1} sur ${n.objectif.nuits}`;
    }
    return { id: 'carriere', numero: '★', nom: 'La station de la Combe', resume: 'Une seule station qui grandit : votre réseau et votre argent restent d\'une étape à l\'autre. Chaque étape réussie débloque du matériel : pompes, canons, tours, compresseur, perches… puis viennent les pannes.',
      etat, ouvert: true, partie: !!r, libelleRecommencer: 'Recommencer la carrière' };
  }
  function groupesMenu(){
    const tutos = LEVELS.filter(l => !l.bac && !l.exploitation), bac = LEVELS.filter(l => l.bac), expl = LEVELS.filter(l => l.exploitation);
    return [
      { titre: 'Carrière', cartes: [carteCarriere()] },
      { titre: 'Exploitation', cartes: expl.map(l => carteNiveau(l, LEVELS.indexOf(l))) },
      { titre: 'Tutoriels', intro: 'Pour apprendre chaque partie du métier, une à une.', cartes: tutos.map(l => carteNiveau(l, LEVELS.indexOf(l))) },
      { titre: 'Bac à sable', cartes: bac.map(l => carteNiveau(l, LEVELS.indexOf(l))) }
    ];
  }
  function ouvrirMenu(){
    sauver();
    fermerLePoste();
    afficherMenu(groupesMenu(), (action, id) => {
      if(action === 'fermer') return fermerMenu();
      if(action === 'jouer'){ if(id === niveau.id) return fermerMenu(); location.href = `index.html?niveau=${id}`; }
      if(action === 'recommencer'){
        if(!confirm(id === 'carriere' ? 'Recommencer toute la carrière depuis la première étape ? La station actuelle sera effacée.'
                                      : 'Recommencer ce niveau depuis le début ? La partie en cours sera effacée.')) return;
        effacerSauvegarde(`nivo-partie-${id}`);
        location.href = `index.html?niveau=${id}&nouvelle`;
      }
    }, true);
  }
  $('ouvrirMenu').onclick = ouvrirMenu;
  const boutonInfos = () => { $('infosCanons').classList.toggle('actif', infosCanons); $('infosCanons').textContent = infosCanons ? 'Masquer infos canons' : 'Infos canons'; };
  $('infosCanons').onclick = () => { infosCanons = !infosCanons; ecrireSauvegarde('nivo-infos-canons', infosCanons); boutonInfos(); synchroniser(); };
  boutonInfos();

  // ----- Options du bac à sable -----
  let optionsOuvertes = false;
  const amenagements = () => ({ pistes: (reseau.pistesBac || []).map(p => ({ nom: p.nom, detail: `${p.couleur}, ${p.largeur} m, ${nombreFr(longueurPolyligne(p.points))} m` })),
    remontees: (reseau.remonteesBac || []).map(ts => ({ nom: ts.nom, detail: `${nombreFr(Math.hypot(ts.amont.x - ts.aval.x, ts.amont.z - ts.aval.z))} m` })) });
  function ouvrirOptions(){ fermerLePoste(); optionsOuvertes = true; afficherOptions(reseau.options, ventActuel(), agirOptions, amenagements()); }
  function agirOptions(action, valeur){
    const o = reseau.options, v = ventActuel();
    if(action === 'fermer'){ optionsOuvertes = false; return fermerOptions(); }
    if(action === 'optBudget'){
      o.budget = valeur ? +valeur : null;
      reseau.budget = o.budget || niveau.budget;
      message(o.budget ? `Budget remis à ${euros(o.budget)} : maintenant, tout se paie.` : 'Argent illimité.', 'info', 3500);
    }
    if(action === 'optVentMode') o.vent = valeur === 'impose' ? { force: v.force, direction: v.direction } : null;
    if(action === 'optVentForce') o.vent = { force: valeur, direction: v.direction };
    if(action === 'optVentDirection') o.vent = { force: v.force, direction: valeur };
    if(action === 'optPannes'){
      o.pannes = valeur === '1';
      reseau.pannesPrevues = [];
      // Pannes activées pendant la nuit : elles arrivent dans le temps qui reste
      if(nuit && o.pannes) planifierPannes(niveau, reseau).forEach(e => { e.t = nuit.temps + 2 + (e.t - CONFIG.pannes.moment[0]) * Math.max(0, CONFIG.nuit.duree - nuit.temps - 3) / CONFIG.nuit.duree; });
    }
    if(action === 'optFrequence') o.frequence = valeur;
    if(action === 'optTypePanne') o.typesPannes[valeur] = o.typesPannes[valeur] === false;
    if(action === 'optEau') o.eauPayante = valeur === '1';
    if(action === 'optElec') o.electricitePayante = valeur === '1';
    if(action === 'optRemplir' && reseau.retenue) reseau.retenue.volume = volumeRetenue(niveau.retenue);
    if(action === 'optVider' && reseau.retenue) reseau.retenue.volume = 0;
    if(action === 'optSupprPiste' || action === 'optSupprRemontee'){
      const liste = action === 'optSupprPiste' ? reseau.pistesBac : reseau.remonteesBac, el = liste && liste[+valeur];
      if(!el || !confirm(`Supprimer « ${el.nom} » ?`)) return;
      liste.splice(+valeur, 1);
      return rechargerBac(`${el.nom} supprimé${action === 'optSupprPiste' ? 'e' : ''}.`);
    }
    if(nuit){ nuit.regime = regimeNuit(niveau, reseau, o.vent || nuit.regime.vent); appliquerRegime(); }
    manche.userData.orienter(ventActuel());
    majInfos(); planifierSauvegarde();
    if(fiche) dessinerFiche();
    if(optionsOuvertes) afficherOptions(o, ventActuel(), agirOptions, amenagements());
  }
  $('ouvrirOptions').hidden = !niveau.bac;
  $('ouvrirOptions').onclick = () => optionsOuvertes ? agirOptions('fermer') : ouvrirOptions();
  // Vitesse : ×1 → ×3 → ×10 → ×1 (la nuit comme la journée)
  function majBoutonVitesse(v){
    const vs = CONFIG.nuit.vitesses, suivante = vs[(vs.indexOf(v) + 1) % vs.length];
    $('accelerer').textContent = v > 1 ? `Vitesse ×${v} → ×${suivante}` : `Accélérer ×${suivante}`;
    $('accelerer').classList.toggle('actif', v > 1);
  }
  $('accelerer').onclick = () => {
    const cours = nuit || journee;
    if(!cours) return;
    const vs = CONFIG.nuit.vitesses;
    cours.vitesse = vs[(vs.indexOf(cours.vitesse) + 1) % vs.length];
    majBoutonVitesse(cours.vitesse);
  };

  // --- Toucher court ---
  const rayon = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function toucher(cx, cy){
    fermerTiroir();
    const r = canvas.getBoundingClientRect();
    ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    rayon.setFromCamera(ndc, camera);
    if(!outil && rayon.intersectObject(salle.userData.ecranMesh, false).length) return ouvrirPoste();   // l'écran du pupitre
    const hit = rayon.intersectObject(terrain, false)[0];
    if(hit) action(hit.point.x, hit.point.z);
  }
  function action(x, z){
    const n = noeudProche(x, z);
    if(fiche && !(n && n.id === fiche)) fermerDevis();
    if(!nuit && outil === 'depart') return outilDepart(x, z);
    if(!nuit && outil === 'demonter') return outilDemonter(x, z, n);
    if(!nuit && outil === 'deplacer') return outilDeplacer(x, z);
    if(!nuit && outil === 'piste') return outilPiste(x, z);
    if(!nuit && outil === 'remontee') return outilRemontee(x, z);
    if(!nuit && outil === 'regard') return outilRegard(x, z, n);
    if(!nuit && outil) return outilTranchee(x, z, n);
    // Sans outil : renseignements sur le point touché
    if(n) return infoNoeud(n);
    if(G && Math.hypot(x - G.x, z - G.z) < 12) return ouvrirGarageFiche();
    const ts = (niveau.remontees || []).find(q => distanceTelesiege(q, x, z) < Math.max(6, cam.actuel.distance * 0.02));
    if(ts) return ficheRemontee(ts);
    if(!dansZoneJeu(t, x, z)){ message('Ce point est en dehors du domaine skiable.', 'attention', 2500); return; }
    repere.position.set(x, hauteur(x, z) + 0.3, z);
    repere.visible = true;
    const R = niveau.retenue;
    if(R && Math.hypot(x - R.x, z - R.z) < R.cuvette.rayon){ message(`${R.nom} · altitude du bord ${nombreFr(coteReplat(t, R))} m`, 'info', 3500); return; }
    const pp = pistePlusProche(niveau.pistes, x, z);
    const ou = pp.dessus ? `sur la piste ${pp.piste.couleur} « ${pp.piste.nom} »` : `hors piste, à ${nombreFr(pp.auBord)} m de la piste`;
    const ep = EXPL && pp.dessus ? ` · ${Math.round(reseau.enneigement[pp.piste.nom] || 0)} cm de neige${pistesOuvertes(niveau, reseau).includes(pp.piste) ? ', peut ouvrir' : ', fermée'}` : '';
    message(`Altitude ${nombreFr(altitude(t, x, z, niveau.pistes))} m · ${ou}${ep}`, pp.dessus ? 'ok' : 'info', 3500);
  }

  // ----- EXPLOITATION : la journée de ski, les skieurs, l'administration -----
  const EXPL = !!niveau.exploitation, E = CONFIG.exploitation;
  let journee = null;
  // Lumière du jour : ciel clair, soleil ; retour à la nuit le soir
  const nuitLumieres = lumieres.children.filter(l => l.isLight).map(l => ({ l, i: l.intensity, c: l.color.clone(), s: l.isHemisphereLight ? l.groundColor.clone() : null }));
  const couleurNuit = new THREE.Color(COULEUR_HORIZON), couleurJour = new THREE.Color('#A9C9EE');
  let jourF = 0, jourCible = 0;
  function ambiance(dt){
    if(Math.abs(jourF - jourCible) < 0.001) return;
    jourF += Math.sign(jourCible - jourF) * Math.min(Math.abs(jourCible - jourF), dt * 0.8);
    scene.background.copy(couleurNuit).lerp(couleurJour, jourF);
    scene.fog.color.copy(scene.background);
    ciel.visible = etoiles.visible = lune.visible = jourF < 0.5;
    for(const n of nuitLumieres){
      n.l.intensity = n.i * (1 + jourF * (n.l.isDirectionalLight ? 0.7 : n.l.isHemisphereLight ? 1.1 : 1.5));
      n.l.color.copy(n.c).lerp(new THREE.Color(n.l.isDirectionalLight ? '#FFF2DC' : '#E6F0FF'), jourF);
    }
  }
  // Skieurs : file d'attente → télésiège → piste → retour à une remontée
  const skieurs3D = creerSkieurs(160), agents = [], _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(2, 2, 2), _axe = new THREE.Vector3(0, 1, 0);
  scene.add(skieurs3D);
  const remonteeParNom = nom => niveau.remontees.find(ts => ts.nom === nom);
  const departs = {};                                       // prochain départ de chaque télésiège
  function placeFile(ts, k){
    const dx = ts.amont.x - ts.aval.x, dz = ts.amont.z - ts.aval.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    const rang = Math.floor(k / 4), col = k % 4 - 1.5;
    return { x: ts.aval.x - ux * (8 + rang * 2.2) - uz * col * 1.6, z: ts.aval.z - uz * (8 + rang * 2.2) + ux * col * 1.6 };
  }
  function choisirRemontee(x, z){
    const ouvertes = (journee.remonteesActives || journee.remontees).map(remonteeParNom).filter(Boolean);
    if(!ouvertes.length) return null;
    return ouvertes.sort((a, b) => Math.hypot(a.aval.x - x, a.aval.z - z) - Math.hypot(b.aval.x - x, b.aval.z - z))[0];
  }
  function demarrerSkieurs(){
    agents.length = 0;
    const n = Math.min(160, Math.round(journee.clients / 7)), pistes = niveau.pistes.filter(p => journee.pistes.includes(p.nom));
    for(let i = 0; i < n; i++){
      const a = { etat: 'file', x: 0, z: 0, cap: 0, ts: null, t: 0 };
      // une partie des skieurs part déjà sur les pistes, les autres attendent en bas
      if(i % 3 === 0 && pistes.length){ commencerDescente(a, pistes[i % pistes.length], Math.random()); }
      else { a.ts = choisirRemontee(0, 250); if(a.ts){ const f = placeFile(a.ts, i); a.x = f.x; a.z = f.z; } }
      agents.push(a);
    }
    skieurs3D.count = n;
  }
  function commencerDescente(a, piste, depart = 0){
    const c = courbePiste(piste), e = extremitesPiste(t, piste);
    a.etat = 'descente'; a.chemin = e.inverse ? c.slice().reverse() : c; a.largeur = piste.largeur; a.i = Math.floor(depart * (a.chemin.length - 2)); a.f = 0; a.ph = Math.random() * 6;
  }
  function avancerSkieurs(dt){
    const files = {};
    for(const a of agents){
      if(a.etat === 'file' && a.ts) (files[a.ts.nom] = files[a.ts.nom] || []).push(a);
    }
    // Départs : une personne toutes les quelques fractions de seconde, plus lent quand il y a trop de monde ; rien si en panne
    for(const [nom, file] of Object.entries(files)){
      const ts = remonteeParNom(nom);
      file.forEach((a, k) => { const f = placeFile(ts, k); a.x += (f.x - a.x) * Math.min(1, dt * 3); a.z += (f.z - a.z) * Math.min(1, dt * 3); a.cap = Math.atan2(ts.amont.x - ts.aval.x, ts.amont.z - ts.aval.z); });
      if(enPanne(reseau, nom) || !(journee.remonteesActives || []).includes(nom)) continue;
      departs[nom] = (departs[nom] || 0) - dt;
      if(departs[nom] <= 0 && file.length){ const a = file[0]; a.etat = 'monte'; a.t = 0; a.duree = longueurRemontee(ts) / 35; departs[nom] = 0.35 * Math.max(0.6, journee.attente / 6); }
    }
    for(const a of agents){
      if(a.etat === 'monte'){
        const ts = a.ts;
        if(!enPanne(reseau, ts.nom)) a.t += dt / a.duree;
        const f = Math.min(1, a.t), x = ts.aval.x + (ts.amont.x - ts.aval.x) * f, z = ts.aval.z + (ts.amont.z - ts.aval.z) * f;
        a.x = x; a.z = z; a.y = poser(x, z) + 6 + Math.sin(Math.PI * f) * 3; a.cap = Math.atan2(ts.amont.x - ts.aval.x, ts.amont.z - ts.aval.z);
        if(f >= 1){
          const pistes = niveau.pistes.filter(p => journee.pistes.includes(p.nom) && remonteesDePiste(niveau, p, [ts]).length);
          if(pistes.length){ const p = pistes[Math.floor(Math.random() * pistes.length)]; a.etat = 'liaison'; a.piste = p; const h = extremitesPiste(t, p).haut; a.cx = h[0]; a.cz = h[1]; }
          else { a.etat = 'file'; a.ts = choisirRemontee(a.x, a.z); }
        }
        continue;
      }
      a.y = null;
      if(a.etat === 'liaison' || a.etat === 'retour'){
        const dx = a.cx - a.x, dz = a.cz - a.z, d = Math.hypot(dx, dz), v = (a.etat === 'liaison' ? 18 : 22) * dt;
        a.cap = Math.atan2(dx, dz);
        if(d <= v){ if(a.etat === 'liaison') commencerDescente(a, a.piste); else a.etat = 'file'; }
        else { a.x += dx / d * v; a.z += dz / d * v; }
      } else if(a.etat === 'descente'){
        const c = a.chemin;
        let reste = 32 * dt;
        while(reste > 0 && a.i < c.length - 1){
          const p0 = c[a.i], p1 = c[a.i + 1], L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1, pas = Math.min(reste, (1 - a.f) * L);
          a.f += pas / L; reste -= pas;
          if(a.f >= 1){ a.i++; a.f = 0; }
        }
        if(a.i >= c.length - 1){
          const ts = choisirRemontee(a.x, a.z);
          a.etat = ts ? 'retour' : 'file'; a.ts = ts;
          if(ts){ a.cx = ts.aval.x; a.cz = ts.aval.z; }
          continue;
        }
        const p0 = c[a.i], p1 = c[a.i + 1], L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1, nx = -(p1[1] - p0[1]) / L, nz = (p1[0] - p0[0]) / L;
        a.ph += dt * 2.2;
        const lat = Math.sin(a.ph) * a.largeur * 0.32;
        a.x = p0[0] + (p1[0] - p0[0]) * a.f + nx * lat; a.z = p0[1] + (p1[1] - p0[1]) * a.f + nz * lat;
        a.cap = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]) + Math.cos(a.ph) * 0.5;
      }
    }
    agents.forEach((a, i) => {
      _p.set(a.x, a.y !== null && a.y !== undefined ? a.y : poser(a.x, a.z), a.z);
      skieurs3D.setMatrixAt(i, _m.compose(_p, _q.setFromAxisAngle(_axe, a.cap || 0), _s));
    });
    skieurs3D.instanceMatrix.needsUpdate = true;
  }
  // Ouvrir la station pour la journée
  function lancerJournee(){
    if(journee || nuit) return;
    choisirOutil(null); fermerDevis(); fermerLePoste(); fermerAdministration(); fermerTiroir();
    garer();
    journee = debutJournee(niveau, reseau);
    journee.vitesse = 1;
    if(journee.ferme){
      message('Aucune piste ne peut ouvrir (pas assez de neige, pas de remontée en marche ou pas d\'agents) : la station reste fermée aujourd\'hui.', 'alarme', 7000);
      return finirJournee();
    }
    jourCible = 1;
    $('barreJeu').classList.add('en-nuit');
    $('accelerer').hidden = false; majBoutonVitesse(1);
    demarrerSkieurs();
    majRemontees3D();
    message(`La station ouvre : ${nombreFr(journee.clients)} skieurs attendus sur ${journee.pistes.length} piste${journee.pistes.length > 1 ? 's' : ''}.`, 'ok', 5000);
  }
  function finirJournee(){
    const bilan = finJournee(niveau, reseau, journee);
    journee = null; jourCible = 0; agents.length = 0; skieurs3D.count = 0; viderSecours3D();
    $('barreJeu').classList.remove('en-nuit');
    $('accelerer').hidden = true;
    afficherConsigne(null);
    synchroniser(); majPannes3D();
    sauver(true);
    const lignes = bilan.ferme ? ['Station fermée : aucune piste n\'a pu ouvrir. Les salaires sont payés quand même et la réputation baisse un peu.'] : [
      `${nombreFr(bilan.clients)} skieurs sur ${bilan.pistes} piste${bilan.pistes > 1 ? 's' : ''} ouverte${bilan.pistes > 1 ? 's' : ''} sur ${bilan.totalPistes} · attente moyenne ${Math.round(bilan.attente)} min`,
      `Forfaits : ${euros(bilan.forfaits)} · dépenses des skieurs : ${euros(bilan.annexes)} · salaires : −${euros(bilan.salaires)}`,
      bilan.secours.blesses ? `Secours sur piste : ${bilan.secours.secourus} blessé${bilan.secours.secourus > 1 ? 's' : ''} secouru${bilan.secours.secourus > 1 ? 's' : ''}, +${euros(bilan.secours.recette)} facturés`
        + (bilan.secours.helico ? ` · ${bilan.secours.helico} évacué${bilan.secours.helico > 1 ? 's' : ''} par hélicoptère faute de pisteur (non facturé${bilan.secours.helico > 1 ? 's' : ''})` : '')
        + (bilan.secours.secourus > bilan.secours.rapides ? ` · ${bilan.secours.secourus - bilan.secours.rapides} ont attendu trop longtemps` : '')
        : 'Secours sur piste : aucun blessé aujourd\'hui.'];
    const details = bilan.ferme ? '' : Object.entries(NOMS_SATISFACTION).map(([k, nom]) => `<div class="mesure"><span class="crit">${nom}</span>${barreSatisfaction(bilan.details[k])}</div>`).join('');
    let titre = `Journée ${bilan.jour} · saison ${bilan.saison}`, extra = '';
    if(bilan.saison && typeof bilan.saison === 'object'){
      const s = bilan.saison;
      titre = `Fin de la saison ${s.saison} !`;
      extra = `<p class="aide"><b>Satisfaction de la saison : ${Math.round((s.satisfaction || 0) * 100)} %</b> · ${nombreFr(s.clients)} clients · résultat ${s.resultat >= 0 ? '+' : '−'}${euros(Math.abs(s.resultat))}${s.joursFermes ? ` · ${s.joursFermes} jour(s) fermé(s)` : ''}.
        L'été passe : la neige fond, la retenue se remplit. La saison ${s.saison + 1} attire plus de clients, plus exigeants (${idealSaison(reseau)} cm de neige pour être parfait).</p>`;
    }
    fermerDevis();
    const d = afficherPanneau(`<div class="tete"><span>${echapper(titre)}</span><span>${bilan.net >= 0 ? '+' : '−'}${euros(Math.abs(bilan.net))}</span></div>
      ${bilan.ferme ? '' : `<div class="mesure"><span class="crit"><b>Satisfaction</b></span>${barreSatisfaction(bilan.satisfaction)}</div>`}
      <ul>${lignes.map(l => `<li>${echapper(l)}</li>`).join('')}</ul>${details}${extra}
      <div class="actions"><button class="bouton" type="button" id="bilanOk">Continuer</button></div>`);
    d.querySelector('#bilanOk').onclick = fermerDevis;
    message(bilan.ferme ? 'Station fermée aujourd\'hui.' : `Fin de la journée : ${Math.round(bilan.satisfaction * 100)} % de clients satisfaits.`, bilan.ferme ? 'alarme' : 'ok', 5000);
  }
  // Heure affichée pendant la journée : 9 h → 17 h
  function heureJournee(t){
    const m = Math.round((9 + Math.min(1, t / E.dureeJour) * E.heuresOuverture) * 60);
    return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
  }
  // Secours sur piste : un repère par blessé (croix qui clignote, puis le pisteur et sa barquette)
  const secours3D = new Map();
  function ajouterSecours3D(b){
    const g = creerSecours(VESTES[b.id % VESTES.length]), d = 4;
    const pente = hauteur(b.x, b.z - d) - hauteur(b.x, b.z + d), devers = hauteur(b.x - d, b.z) - hauteur(b.x + d, b.z);
    g.position.set(b.x, hauteur(b.x, b.z), b.z);
    g.rotation.y = Math.atan2(devers, pente);                              // l'amont (le haut de la pente) vers −z local
    g.scale.setScalar(2);
    scene.add(g); secours3D.set(b.id, g);
  }
  function majSecours3D(temps){
    for(const b of (journee && journee.secours) || []){
      const g = secours3D.get(b.id);
      if(!g) continue;
      if(b.etat === 'fini'){ scene.remove(g); secours3D.delete(b.id); continue; }
      g.userData.etat(b.etat, temps);
    }
  }
  function viderSecours3D(){ for(const g of secours3D.values()) scene.remove(g); secours3D.clear(); }
  function boucleJournee(dt, maintenant){
    const dtJeu = dt * journee.vitesse, r = avancerJournee(niveau, reseau, journee, dtJeu);
    for(const p of r.nouvelles) message(`Panne : ${CONFIG.pannes.types.remontee.nom} · ${p.cible}. Les skieurs attendent !`, 'alarme', 7000);
    for(const p of r.finies) message(`Réparation terminée : ${p.cible}.`, 'ok', 4000);
    if(r.nouvelles.length || r.finies.length){ majPannes3D(); majRemontees3D(); majCoinPannes(); }
    for(const b of r.blesses){
      ajouterSecours3D(b);
      message(`Blessé sur ${b.piste} (${b.couleur}) : ${b.etat === 'encours' ? 'un pisteur part le secourir.' : 'tous les pisteurs sont occupés, il attend !'}`, b.etat === 'encours' ? 'info' : 'attention', 3500);
    }
    for(const b of r.secourus) message(`Secours terminé sur ${b.piste} : ${euros(b.prix)} facturés.`, 'ok', 3000);
    majSecours3D(maintenant / 1000);
    avancerSkieurs(dtJeu);
    if(maintenant - derniereMaj > 250){
      derniereMaj = maintenant;
      majInfos();
      afficherConsigne(`Journée ${journee.jour} / ${E.joursSaison} · ${heureJournee(journee.temps)} · ${nombreFr(journee.clients)} skieurs · attente ${Math.round(journee.attente)} min · ${journee.pistes.length} piste(s) ouverte(s)`);
      if(adminOuverte) rafraichirAdmin();
    }
    if(r.fini) finirJournee();
  }
  // Administration
  let adminOuverte = false;
  function donneesAdmin(){
    const ex = reseau.exploitation, m = DAMEUSES[reseau.dameuse.modele];
    return { prix: reseau.prixForfait, estimation: journee ? journee.clients : (pistesOuvertes(niveau, reseau).length ? clientsAttendus(niveau, reseau) : null),
      personnel: reseau.personnel, besoins: besoinsPersonnel(niveau, reseau), carburant: reseau.carburant, conso: m.conso,
      saison: ex.saison, jour: ex.jour, reputation: ex.reputation, satisfaction: satisfactionSaison(reseau),
      clients: ex.jours.reduce((s, j) => s + j.clients, 0), resultat: Math.round(reseau.budget - ex.debutBudget), saisons: ex.saisons,
      dernier: ex.dernier && ex.dernier.saison === ex.saison ? ex.dernier : null,
      secoursSaison: { recette: ex.jours.reduce((t, j) => t + (j.secours || 0), 0), blesses: ex.jours.reduce((t, j) => t + (j.blesses || 0), 0) },
      secoursJour: journee && journee.secours ? { attente: journee.secours.filter(b => b.etat === 'attente').length, encours: journee.secours.filter(b => b.etat === 'encours').length,
        faits: journee.secours.filter(b => b.etat === 'fini').length } : null,
      salaires: Object.entries(reseau.personnel).reduce((s, [k, n]) => s + n * METIERS[k].salaire, 0) };
  }
  function rafraichirAdmin(){ if(adminOuverte) afficherAdmin(donneesAdmin(), agirAdmin); }
  function ouvrirAdministration(){ fermerDevis(); fermerLePoste(); adminOuverte = true; rafraichirAdmin(); }
  function fermerAdministration(){ adminOuverte = false; fermerAdmin(); }
  function agirAdmin(action, valeur){
    if(action === 'fermer') return fermerAdministration();
    if(action === 'prix') fixerPrix(reseau, valeur);
    if(action === 'personnel'){ const [k, d] = valeur.split(':'); changerPersonnel(reseau, k, +d); majRemontees3D(); }
    if(action === 'carburant'){
      const r = acheterCarburant(reseau, +valeur);
      message(r.ok ? `${nombreFr(r.litres)} L de gazole livrés (${euros(r.cout)}).` : r.raison, r.ok ? 'ok' : 'attention', 3000);
    }
    majInfos(); planifierSauvegarde();
    rafraichirAdmin();
  }
  if(EXPL){ $('ouvrirAdmin').hidden = false; $('ouvrirAdmin').onclick = () => adminOuverte ? fermerAdministration() : ouvrirAdministration(); }
  // Objectifs de l'exploitation
  function objectifsExploitation(){
    const ex = reseau.exploitation, sat = satisfactionSaison(reseau), ideal = idealSaison(reseau);
    const ouvrables = pistesOuvertes(niveau, reseau), ep = niveau.pistes.map(p => reseau.enneigement[p.nom] || 0), moy = ep.reduce((s, x) => s + x, 0) / Math.max(1, ep.length);
    const b = besoinsPersonnel(niveau, reseau), manque = Object.keys(b).filter(k => reseau.personnel[k] < b[k]);
    return [
      { texte: 'Satisfaction de la saison', fait: sat !== null && sat >= 0.8, progres: sat ?? 0, detail: `${sat === null ? '—' : Math.round(sat * 100) + ' %'} · réputation ${Math.round(ex.reputation * 100)} % · jour ${ex.jour} / ${E.joursSaison}` },
      { texte: 'Pistes qui peuvent ouvrir', fait: ouvrables.length === niveau.pistes.length, progres: ouvrables.length / Math.max(1, niveau.pistes.length), detail: `${ouvrables.length} / ${niveau.pistes.length} (au moins ${E.ouverture} cm et une remontée en marche)` },
      { texte: 'Enneigement moyen des pistes', fait: moy >= ideal, progres: moy / ideal, detail: `${Math.round(moy)} cm sur ${ideal} cm idéals` },
      { texte: 'Gazole pour la dameuse', fait: reseau.carburant.stock >= DAMEUSES[reseau.dameuse.modele].conso, progres: reseau.carburant.stock / E.carburant.cuve, detail: `${nombreFr(reseau.carburant.stock)} L dans la cuve` },
      { texte: 'Personnel conseillé', fait: !manque.length, detail: manque.length ? `il manque : ${manque.map(k => METIERS[k].nom.toLowerCase()).join(', ')}` : 'au complet (Administration)' }
    ];
  }
  // Bilan de la nuit en exploitation : la neige ne se vend pas, elle épaissit les pistes ; puis on ouvre la station
  function bilanNuitExploitation(bilan){
    reseau.exploitation.phase = 'matin';
    sauver(true);
    const dmg = bilan.damage, cout = bilan.electricite + bilan.remplissage.cout;
    const lignes = [
      `Neige produite : ${nombreFr(bilan.neige)} m³, dont ${nombreFr(bilan.piste)} m³ tombés sur les pistes`,
      bilan.neigeNaturelle ? `Il a neigé cette nuit : +${bilan.neigeNaturelle} cm sur toutes les pistes !` : null,
      dmg.sansConducteur ? 'Aucun conducteur : la dameuse est restée au garage (Administration).'
        : `Damage : ${nombreFr(bilan.dame)} m³ étalés, ${Math.round((dmg.qualite ?? 1) * 100)} % des pistes damées, ${nombreFr(dmg.litres)} L de gazole (reste ${nombreFr(reseau.carburant.stock)} L)`,
      bilan.aDamer >= 1 ? `Encore ${nombreFr(bilan.aDamer)} m³ en tas, à damer demain` : null,
      `Enneigement : ${niveau.pistes.map(p => `${p.nom} ${Math.round(reseau.enneigement[p.nom] || 0)} cm`).join(' · ')} (ouverture à ${E.ouverture} cm)`,
      bilan.kwh ? `Électricité : ${nombreFr(bilan.kwh)} kWh, ${euros(bilan.electricite)}` : null,
      reseau.retenue ? `Eau de la journée : ${nombreFr(bilan.remplissage.m3)} m³ (${euros(bilan.remplissage.cout)})` : null,
      avecPannes() && bilan.pannes ? `Pannes : ${bilan.pannes} cette nuit, réparations ${euros(bilan.reparations)}` : null
    ].filter(Boolean);
    fermerDevis();
    const d = afficherPanneau(`<div class="tete"><span>Matin · jour ${reseau.exploitation.jour} / ${E.joursSaison}</span><span>−${euros(cout)}</span></div>
      <ul>${lignes.map(l => `<li>${echapper(l)}</li>`).join('')}</ul>
      <div class="actions"><button class="bouton" type="button" id="bilanJour">Ouvrir la station</button><button class="bouton" type="button" id="bilanOk">Plus tard</button></div>`);
    d.querySelector('#bilanOk').onclick = fermerDevis;
    d.querySelector('#bilanJour').onclick = lancerJournee;
  }

  // --- Boucle principale ---
  let avant = performance.now(), angleVent = null, derniereMaj = 0;
  function boucle(maintenant){
    const dt = Math.min(0.05, (maintenant - avant) / 1000), temps = maintenant / 1000;
    avant = maintenant;
    cam.maj(dt);
    ciel.position.copy(camera.position);
    etoiles.position.copy(camera.position);
    lune.position.copy(camera.position);
    // La nuit avance : neige, tas, retenue
    if(nuit){
      const dtJeu = Math.min(dt * nuit.vitesse, CONFIG.nuit.duree - nuit.temps), tAvant = nuit.temps;
      nuit.temps += dtJeu;
      const ev = evenementsProgramme(niveau, reseau, tAvant, nuit.temps);
      if(ev.length){
        nuit.regime = regimeNuit(niveau, reseau, nuit.regime.vent);
        appliquerRegime();
        for(const t of new Set(ev.map(e => e.texte))) if(t) message(t, 'info', 5000);
      }
      const nouvelles = evenementsPannes(niveau, reseau, tAvant, nuit.temps, nuit.regime), finies = avancerPannes(reseau, nuit.temps);
      for(const p of nouvelles) message(`Panne : ${nomPanne(p)}`, 'alarme', 7000);
      for(const p of finies) message(`Réparation terminée : ${libellePanne(reseau, p)}.`, 'ok', 4000);
      if(nouvelles.length || finies.length) apresPannes();
      const r = avancerNuit(niveau, reseau, nuit.regime, dtJeu);
      if(r.vide){
        nuit.regime = regimeNuit(niveau, reseau, nuit.regime.vent);
        appliquerRegime();
        message('Retenue vide : les pompes sont à sec, tous les canons s\'arrêtent !', 'alarme', 6000);
      }
      majTasMeshes();
      if(maintenant - derniereMaj > 250){                // 4 fois par seconde : chiffres, consigne, fiche, poste
        derniereMaj = maintenant;
        majInfos();
        afficherConsigne(`Nuit ${reseau.nuit} · ${Math.max(0, Math.ceil(CONFIG.nuit.duree - nuit.temps))} s · ${nuit.regime.canons.filter(c => c.production).length} canon(s) en production · ${nombreFr(reseau.pisteNuit)} m³ sur la piste, à damer demain matin`);
        if(fiche) dessinerFiche();
        // Le réservoir d'air monte ou baisse : la production des perches change avec lui
        if(reseau.compresseur && Math.abs(reseau.compresseur.pression - nuit.regime.air.pression) > 0.05){
          nuit.regime = regimeNuit(niveau, reseau, nuit.regime.vent);
          appliquerRegime();
        }
        etatSalleDepuis(nuit.regime);
        if(compresseur) etatCompresseur(compresseur, { pression: reseau.compresseur.pression });
        rafraichirPoste();
      }
      if(nuit.temps >= CONFIG.nuit.duree) finirNuit();
    }
    if(journee) boucleJournee(dt, maintenant);
    ambiance(dt);
    jets.maj(dt * (nuit ? nuit.vitesse : 1), sources, temps);
    for(const o of regards3D.values()) animerCanon(o.userData.canon, dt);
    animerSallePompage(salle, dt, temps);
    if(compresseur) animerCompresseur(compresseur, dt, temps);
    animerPannes(dt, temps);
    decalerVue();
    avancerTournee(dt, temps);
    if(garage) animerGarage(garage, dt);
    for(const r of remontees3D) r.o.userData.animer(dt);
    majEtiquettes(camera, CONFIG.graphismes.distanceEtiquettes);
    voirAtravers(salle, camera, dt, 70);
    // Flèche du vent, tournée comme la vue
    const v = ventActuel(), a = cam.actuel.azimut, w = v.direction * Math.PI / 180;
    const ang = Math.round(Math.atan2(Math.sin(w) * Math.cos(a) - Math.cos(w) * Math.sin(a), -Math.sin(w) * Math.sin(a) - Math.cos(w) * Math.cos(a)) * 180 / Math.PI);
    if(ang !== angleVent){ angleVent = ang; orienterFlecheVent(ang); }
    if(repere.visible){
      repere.scale.setScalar(cam.actuel.distance / 140 + 0.6);
      repere.userData.fleche.position.y = 3.2 + Math.sin(maintenant / 220) * 0.6;
    }
    if(surbrillance.visible) surbrillance.scale.setScalar(Math.max(4, cam.actuel.distance * 0.03) * (1 + 0.12 * Math.sin(maintenant / 180)));
    renderer.render(scene, camera);
    requestAnimationFrame(boucle);
  }
  requestAnimationFrame(boucle);

  // Bandeau des compteurs en haut, repliable (le choix est gardé)
  const bandeau = $('bandeau'), boutonBandeau = $('replierBandeau');
  const replierBandeau = replie => {
    bandeau.classList.toggle('replie', replie);
    boutonBandeau.textContent = replie ? 'Compteurs ▾' : '▴';
    boutonBandeau.setAttribute('aria-expanded', String(!replie));
    boutonBandeau.setAttribute('aria-label', replie ? 'Afficher les compteurs' : 'Replier les compteurs');
  };
  bandeau.hidden = false;
  replierBandeau(!!lireSauvegarde('nivo-compteurs-replies'));
  boutonBandeau.onclick = () => { const r = !bandeau.classList.contains('replie'); replierBandeau(r); ecrireSauvegarde('nivo-compteurs-replies', r); };
  suivreHauteurHaut();

  // Accueil
  synchroniser();
  const o = niveau.objectif;
  $('sousTitre').textContent = niveau.exploitation ? 'Exploitation de la station · la satisfaction des clients avant tout'
    : niveau.bac ? 'Bac à sable · tout est débloqué, budget illimité'
    : niveau.carriere ? `Carrière · étape ${niveau.numero}/${CARRIERE.etapes.length} · ${niveau.nom} · ${nombreFr(o.m3)} m³ et ${euros(o.recette)} en ${o.nuits} nuits`
    : `Niveau ${niveau.numero} · ${niveau.nom} · objectif ${nombreFr(o.m3)} m³ ${o.type === 'production' ? `produits en ${o.nuits} nuits` : 'sur la piste'}${o.nuits && o.type !== 'production' ? ` en ${o.nuits} nuits` : ''}`;
  if(EXPL) $('hudNuit').previousElementSibling.textContent = 'Saison · jour';
  $('hudNeigeTitre').textContent = o.type === 'production' ? 'Neige produite' : o.type === 'exploitation' ? 'Satisfaction' : 'Neige piste';
  const tactile = window.matchMedia('(pointer:coarse)').matches;
  const commandes = tactile ? 'Un doigt pour vous déplacer. Deux doigts : pincez pour zoomer, tournez-les pour pivoter, glissez-les vers le haut ou le bas pour incliner la vue.' : 'Glissez pour tourner, molette pour zoomer, clic droit pour déplacer la vue.';
  if(!OUVRIR_MENU && niveau.carriere && avancementEtape(reseau).nuits === 0)
    message(`Étape ${niveau.numero} · ${niveau.nom} : ${niveau.resume} Objectif : ${nombreFr(o.m3)} m³ sur les pistes et ${euros(o.recette)} de recettes en ${o.nuits} nuits.`, 'info', 12000);
  if(!OUVRIR_MENU) message(`${commandes} ${niveau.construction === false ? 'Lancez la nuit, puis pilotez la salle de pompage au poste de travail.' : 'Construisez, puis lancez la nuit.'}`, 'info', 7000);
  if(reseau.messageApres){ message(reseau.messageApres, 'ok', 6000); delete reseau.messageApres; planifierSauvegarde(); }
  if(repris && !OUVRIR_MENU) message(`Partie reprise : prochaine nuit n° ${reseau.nuit}.`, 'ok', 4000);
  if(OUVRIR_MENU) ouvrirMenu();

  // Accès pour les essais automatiques (console du navigateur)
  window.nivo = { secours3D, ouvrirTiroir, lancerJournee, ouvrirAdministration, agirAdmin, get journee(){ return journee; }, proposerDemontage, proposerRetrait, commencerDeplacement, ouvrirOptions, agirOptions, get tournee(){ return tournee; }, ouvrirGarageFiche, ficheRemontee, synchroniser, scene, camera, renderer, cam, toucher, action, salle, compresseur, choisirOutil, valider, lancerNuit, ouvrirFiche, ouvrirPoste, agirPoste, ouvrirMenu, finirNuit,
    get reseau(){ return reseau; }, get nuit(){ return nuit; }, set choix(c){ choix = c; } };
}
