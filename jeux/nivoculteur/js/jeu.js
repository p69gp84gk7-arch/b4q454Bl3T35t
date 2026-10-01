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
  const decor = [creerSapins(niveau, CONFIG.graphismes.sapins, poser), creerRochers(niveau, CONFIG.graphismes.rochers, poser), creerJalons(niveau, poser)];
  scene.add(ciel, etoiles, lune, terrain, ...decor,
    creerLumieres(Math.max(t.largeur, t.longueur) / 2 + t.marge, new THREE.Vector3(0, t.denivele / 2, 0)));

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
  for(const ts of niveau.remontees || []) scene.add(creerTelesiege(ts, poser));
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
  const nouvellePartie = () => construireReseauFixe(niveau, creerReseau(niveau));
  let reseau = chargerPartie() || nouvellePartie(), outil = null, depart = null, proposition = null, sousSol = false;
  if(niveau.bac) reseau.options = { ...optionsBac(), ...(reseau.options || {}) };    // anciennes parties : options manquantes
  const repris = reseau.nuit > 1 || reseau.noeuds.some(n => n.type === 'regard' && !niveau.reseauFixe);
  function sauver(){
    if(nuit || (reseau.nuit === 1 && !reseau.lot)) return;        // rien à garder tant que le joueur n'a rien fait
    ecrireSauvegarde(clePartie, { version: VERSION_PARTIE, reseau, date: Date.now() });
    progression.dernier = niveau.id;
    ecrireSauvegarde('nivo-progression', progression);
  }
  let minuteurSauvegarde = null;
  const planifierSauvegarde = () => { clearTimeout(minuteurSauvegarde); minuteurSauvegarde = setTimeout(sauver, 600); };
  if(niveau.construction === false) $('barreJeu').classList.add('sans-construction');
  document.querySelector('[data-outil="air"]').hidden = !niveau.compresseur;
  let choix = { modele: niveau.compresseur ? 'p10' : 'v8', support: 'trepied' };   // enneigeur posé avec un nouveau regard
  let fiche = null, nuit = null;                              // fiche : regard affiché ; nuit : { regime, temps, vitesse }
  let reussi = !!(progression.niveaux[niveau.id] || {}).reussi, alarmeJusqua = 0;
  const groupeReseau = new THREE.Group(), groupeSousSol = new THREE.Group(), apercu = new THREE.Group();
  groupeSousSol.visible = false;
  const surbrillance = creerSurbrillance(), anneauChute = creerSurbrillance();
  const jets = creerJets(CONFIG.graphismes.flocons), manche = creerMancheAir();
  manche.position.set(niveau.pompage.x + 26, poser(niveau.pompage.x + 26, niveau.pompage.z - 12), niveau.pompage.z - 12);
  scene.add(groupeReseau, groupeSousSol, apercu, surbrillance, anneauChute, jets.groupe, manche);
  const regards3D = new Map(), tas3D = new Map();
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
      orienterCanon(o.userData.canon, n.direction, n.inclinaison);
      const e = etatRegard(niveau, reseau, n.id);
      o.userData.icone.material.map = textureIcone(e.eau, e.elec, e.besoinAir ? e.air : null);
    }
    for(const [id, o] of regards3D) if(!vus.has(id)){ groupeReseau.remove(o); liberer(o); regards3D.delete(id); }
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
      majTas(mesh, q.volume);
      if(q.dame) damer(mesh);
    }
  }
  // Ce qui compte pour l'objectif : toute la neige produite (niveau 1) ou la neige tombée sur la piste
  const neigeObjectif = () => niveau.objectif.type === 'production' ? reseau.neigeTotale : reseau.neigePiste;
  // ----- Dameuse : quand l'objectif est atteint, une dameuse par piste fait des allers-retours -----
  let dameuses = [], premiereMajDameuses = true;
  function trajetDameuse(piste){
    const c = courbePiste(piste), w = piste.largeur;
    const passe = decal => c.map((p, i) => {
      const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [p[0] - (b[1] - a[1]) / L * decal, p[1] + (b[0] - a[0]) / L * decal];
    });
    const pts = [...passe(-w / 4), ...passe(w / 4).reverse()], cumul = [0];
    pts.push(pts[0]);
    for(let i = 1; i < pts.length; i++) cumul.push(cumul[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cumul, longueur: cumul[cumul.length - 1] };
  }
  function majDameuses(){
    const atteint = !!niveau.objectif.m3 && neigeObjectif() >= niveau.objectif.m3;
    if(atteint && !dameuses.length){
      dameuses = niveau.pistes.map((piste, i) => {
        const g = creerDameuse(), tr = trajetDameuse(piste);
        g.rotation.order = 'YXZ';
        scene.add(g);
        return { g, tr, s: tr.longueur * (0.15 + i * 0.4) };
      });
      if(!premiereMajDameuses) message('Objectif atteint ! La dameuse passe pour préparer la piste.', 'ok', 7000);
    } else if(!atteint && dameuses.length){
      for(const d of dameuses){ scene.remove(d.g); liberer(d.g); }
      dameuses = [];
    }
    premiereMajDameuses = false;
  }
  const _avant = [0, 0];
  function avancerDameuses(dt, temps){
    for(const d of dameuses){
      const { pts, cumul, longueur } = d.tr;
      d.s = (d.s + dt * CONFIG.dameuse.vitesse) % longueur;
      let i = 1;
      while(i < cumul.length - 1 && cumul[i] < d.s) i++;
      const a = pts[i - 1], b = pts[i], f = (d.s - cumul[i - 1]) / Math.max(1e-6, cumul[i] - cumul[i - 1]);
      const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f, L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      _avant[0] = poser(x + ux * 2.5, z + uz * 2.5); _avant[1] = poser(x - ux * 2.5, z - uz * 2.5);
      d.g.position.set(x, poser(x, z), z);
      d.g.rotation.set(-Math.atan2(_avant[0] - _avant[1], 5), Math.atan2(ux, uz), 0);
      animerDameuse(d.g, temps);
      // Les tas de neige sur la piste sont étalés à son passage
      for(const [q, mesh] of tas3D) if(!q.dame && Math.hypot(q.x - x, q.z - z) < 9 && niveau.pistes.some(p => surPiste(p, q.x, q.z))){
        q.dame = true;
        majTas(mesh, q.volume); damer(mesh);
      }
    }
  }
  function damer(mesh){ mesh.scale.x *= 1.6; mesh.scale.z *= 1.6; mesh.scale.y *= 0.3; }

  function majInfos(){
    const R = niveau.retenue;
    majHud({ budget: niveau.bac && !reseau.options.budget ? 'Illimité' : reseau.budget, nuit: nuit ? `${reseau.nuit} · ${Math.max(0, Math.ceil(CONFIG.nuit.duree - nuit.temps))} s` : `n° ${reseau.nuit}`,
      neige: Math.round(neigeObjectif()), objectif: niveau.objectif.m3, vent: ventActuel(),
      retenue: reseau.retenue ? reseau.retenue.volume / volumeRetenue(R) : null });
    if(reseau.retenue) retenue.userData.remplir(hauteurRetenue(R, reseau.retenue.volume));
    majDameuses();
    majCoinPannes();
  }

  function consigne(){
    if(nuit) return;
    const suite = depart && `Départ : ${depart.nom}. Touchez le regard à raccorder, ou un endroit libre pour poser un nouveau regard. Touchez à nouveau le départ pour en changer.`;
    afficherConsigne({
      regard: 'Touchez le terrain pour poser un regard et son enneigeur (choisi ci-dessous). Touchez un regard pour le régler.',
      eau: suite || 'Eau : touchez la salle de pompage, ou un regard déjà alimenté en eau.',
      cable: suite || 'Électricité : touchez un départ électrique (près des bâtiments), ou un regard déjà alimenté.',
      air: suite || 'Air comprimé : touchez le compresseur (à côté de la salle de pompage), ou un regard déjà alimenté en air. Seules les perches ont besoin d\'air.'
    }[outil] || null);
    $('choixEnneigeur').hidden = !outil;
    if(outil) majChoix();
  }
  function majChoix(){
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
    depart = null;
    fermerDevis();
    document.querySelectorAll('[data-outil]').forEach(b => b.classList.toggle('actif', b.dataset.outil === outil));
    montrerDepart();
    consigne();
  }
  document.querySelectorAll('[data-outil]').forEach(b => { b.onclick = () => choisirOutil(b.dataset.outil); });

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
    const supports = Object.entries(SUPPORTS).map(([k, s]) => `<option value="${k}"${k === (n.support || 'trepied') ? ' selected' : ''}>${echapper(s.nom)}</option>`).join('');
    const d = afficherPanneau(`<div class="tete"><span>${echapper(n.nom)} · ${echapper(nomEnneigeur(n.modele, n.support))}</span><button class="fermer" type="button" id="ficheFermer" aria-label="Fermer">×</button></div>
      ${pressionFiche !== null ? `<div class="ligne">Pression ${jaugePression(pressionFiche, n.modele)}<b>${Math.round(pressionFiche)} bar</b></div>` : ''}
      ${pannesFiche.map(p => `<div class="ligne panne"><span>⚠ ${echapper(CONFIG.pannes.types[p.type].nom)}${p.etat === 'reparation' ? ' · équipe sur place' : ''}</span>
        ${p.etat === 'active' ? `<button class="bouton petit" type="button" data-reparer="${p.id}">Réparer · ${euros(CONFIG.pannes.types[p.type].cout)}</button>` : ''}</div>`).join('')}
      <ul><li>${echapper(etat)}</li>
      <li>Neige sur la piste ${nuit ? 'cette nuit' : 'avec le vent prévu'} (${vent.force ? vent.force + ' km/h' : 'pas de vent'}) : <b>${Math.round(part * 100)} %</b></li>
      <li>${m.debit} m³/h d'eau${m.air ? ` · ${m.air} Nm³/h d'air` : ''} · ${m.pressionMin} bar minimum · jusqu'à ${nombreFr(m.neige * CONFIG.nuit.duree * CONFIG.nuit.echelle / 3600)} m³ de neige par nuit (${m.neige} m³/h)</li></ul>
      <div class="ligne reglage-fiche">Direction <input type="range" id="ficheDir" min="-180" max="180" step="5" value="${n.direction}" aria-label="Direction du canon"><b>${n.direction}°</b></div>
      ${ventilo ? `<div class="ligne reglage-fiche">Inclinaison <input type="range" id="ficheInc" min="0" max="35" step="1" value="${n.inclinaison}" aria-label="Inclinaison du canon"><b>${n.inclinaison}°</b></div>` : ''}
      ${nuit || niveau.construction === false ? '' : `<div class="ligne choix">Remplacer par <select id="ficheModele">${options}</select><select id="ficheSupport">${supports}</select><button class="bouton petit" type="button" id="ficheRemplacer"></button></div>`}`);
    d.querySelector('#ficheFermer').onclick = fermerDevis;
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
    if(nuit) return;
    const prets = reseau.noeuds.filter(n => n.type === 'regard' && etatRegard(niveau, reseau, n.id).pret).length;
    if(!prets) return message(`Aucun canon n'est prêt : raccordez au moins un regard à l'eau et à l'électricité${K ? ' (et à l\'air pour une perche)' : ''}.`, 'attention', 4500);
    if(sousSol) $('sousSol').onclick();
    choisirOutil(null);
    nuit = { regime: debutNuit(niveau, reseau), temps: 0, vitesse: 1 };
    const evDepart = evenementsProgramme(niveau, reseau, -1, 0);
    if(evDepart.length) nuit.regime = regimeNuit(niveau, reseau, nuit.regime.vent);
    $('barreJeu').classList.add('en-nuit');
    $('accelerer').hidden = false; $('accelerer').classList.remove('actif');
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
  function marchePompes(g){
    const cmd = reseau.pompage, hs = g ? g.pompesEnPanne : (reseau.pannes || []).filter(p => p.type === 'pompe').map(p => +p.cible);
    if(cmd.mode !== 'auto') return [0, 1, 2].map(i => !!g && cmd.marche[i] && !hs.includes(i));
    const dispo = [0, 1, 2].filter(i => !hs.includes(i)).slice(0, g ? g.pompes : 0);
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
    const r = reparerPanne(niveau, reseau, id, !!nuit, nuit ? nuit.temps : 0);
    if(!r.ok) return message(r.raison, 'attention', 4000);
    const verbe = p.type === 'disjoncteur' ? 'Réarmement' : 'Réparation';
    message(r.finie ? `${verbe} faite : ${libellePanne(reseau, p)}${r.cout ? ` (${euros(r.cout)})` : ''}.`
                    : `L'équipe part : ${libellePanne(reseau, p)}, environ ${r.duree} s${p.type === 'fuite' ? ' (conduite isolée pendant les travaux)' : ''}.`, 'info', 4500);
    apresPannes();
  }
  // Coin en haut à droite : la liste des pannes en cours (replié d'office sur un petit écran)
  let coinReplie = window.innerWidth < 1100;
  function majCoinPannes(){
    afficherPannesCoin((reseau.pannes || []).map(p => ({ id: p.id, nom: CONFIG.pannes.types[p.type].nom, ou: libellePanne(reseau, p),
      reparation: p.etat === 'reparation', reste: p.etat === 'reparation' && nuit ? Math.max(0, Math.ceil(p.fin - nuit.temps)) : null,
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
    const premiereReussite = bilan.reussi && !reussi;
    if(premiereReussite){
      reussi = true;
      progression.niveaux[niveau.id] = { ...(progression.niveaux[niveau.id] || {}), reussi: true, nuits: bilan.nuit };
      ecrireSauvegarde('nivo-progression', progression);
    }
    sauver();
    const R = niveau.retenue, o = niveau.objectif, suivant = LEVELS.slice(LEVELS.indexOf(niveau) + 1).find(l => !l.bac);
    const lignes = [
      `Neige produite : ${nombreFr(bilan.neige)} m³, dont ${nombreFr(bilan.piste)} m³ sur la piste`,
      bilan.kwh ? `Électricité : ${nombreFr(bilan.kwh)} kWh, soit ${euros(bilan.electricite)} retirés du gain` : null,
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
      numero: reseau.nuit, vent: ventActuel(), accelere: !!nuit && nuit.vitesse > 1, total: neigeObjectif(), objectif: niveau.objectif.m3 || null,
      remplissage: reseau.retenue ? { m3: reseau.retenue.remplissage ?? CONFIG.retenue.remplissageJour, choix: CONFIG.retenue.choix, prix: CONFIG.retenue.prixM3 } : null,
      coups: reseau.coups || 0, coupsMax: niveau.objectif.coupsMax ?? null,
      retenue: reseau.retenue ? reseau.retenue.volume / volumeRetenue(R) : null,
      nuit: nuit && { numero: reseau.nuit, restant: Math.max(0, Math.ceil(CONFIG.nuit.duree - nuit.temps)), neige: reseau.pisteNuit, argent: Math.round(reseau.argentNuit) },
      pompage: { mode: cmd.mode, ouverture: cmd.ouverture,
        marche: cmd.mode === 'auto' ? marchePompes(g) : cmd.marche.slice(),
        defaut: [0, 1, 2].map(i => (reseau.pannes || []).some(p => p.type === 'pompe' && +p.cible === i)),
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
    if(action === 'remplissage'){ reseau.retenue.remplissage = +valeur; planifierSauvegarde(); return rafraichirPoste(); }
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
  function cartesMenu(){
    return LEVELS.map((l, i) => {
      const pr = progression.niveaux[l.id] || {}, partie = lireSauvegarde(`nivo-partie-${l.id}`);
      const ouvert = CONFIG.progression.toutOuvert || i === 0 || !!l.bac || !!(progression.niveaux[LEVELS[i - 1].id] || {}).reussi;
      let etat = l.bac ? 'Pour s\'entraîner et essayer' : pr.reussi ? 'Réussi ✓' : 'Pas encore réussi';
      if(partie && partie.reseau){
        const fait = l.objectif.type === 'production' ? partie.reseau.neigeTotale : partie.reseau.neigePiste;
        etat = `${pr.reussi ? 'Réussi ✓ · ' : ''}Partie en cours : prochaine nuit n° ${partie.reseau.nuit}, ${nombreFr(Math.round(fait))}${l.objectif.m3 ? ` / ${nombreFr(l.objectif.m3)}` : ''} m³`;
      }
      if(!ouvert) etat = 'Réussissez le niveau précédent pour l\'ouvrir.';
      return { id: l.id, numero: l.numero, nom: l.nom, resume: l.resume, etat, ouvert, partie: !!(partie && partie.reseau) };
    });
  }
  function ouvrirMenu(){
    sauver();
    fermerLePoste();
    afficherMenu(cartesMenu(), [], (action, id) => {
      if(action === 'fermer') return fermerMenu();
      if(action === 'jouer'){ if(id === niveau.id) return fermerMenu(); location.href = `index.html?niveau=${id}`; }
      if(action === 'recommencer'){
        if(!confirm('Recommencer ce niveau depuis le début ? La partie en cours sera effacée.')) return;
        effacerSauvegarde(`nivo-partie-${id}`);
        location.href = `index.html?niveau=${id}&nouvelle`;
      }
    }, true);
  }
  $('ouvrirMenu').onclick = ouvrirMenu;

  // ----- Options du bac à sable -----
  let optionsOuvertes = false;
  function ouvrirOptions(){ fermerLePoste(); optionsOuvertes = true; afficherOptions(reseau.options, ventActuel(), agirOptions); }
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
    if(nuit){ nuit.regime = regimeNuit(niveau, reseau, o.vent || nuit.regime.vent); appliquerRegime(); }
    manche.userData.orienter(ventActuel());
    majInfos(); planifierSauvegarde();
    if(fiche) dessinerFiche();
    if(optionsOuvertes) afficherOptions(o, ventActuel(), agirOptions);
  }
  $('ouvrirOptions').hidden = !niveau.bac;
  $('ouvrirOptions').onclick = () => optionsOuvertes ? agirOptions('fermer') : ouvrirOptions();
  $('accelerer').onclick = () => {
    if(!nuit) return;
    nuit.vitesse = nuit.vitesse > 1 ? 1 : CONFIG.nuit.accelere;
    $('accelerer').classList.toggle('actif', nuit.vitesse > 1);
  };

  // --- Toucher court ---
  const rayon = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function toucher(cx, cy){
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
    if(!nuit && outil === 'regard') return outilRegard(x, z, n);
    if(!nuit && outil) return outilTranchee(x, z, n);
    // Sans outil : renseignements sur le point touché
    if(n) return infoNoeud(n);
    if(!dansZoneJeu(t, x, z)){ message('Ce point est en dehors du domaine skiable.', 'attention', 2500); return; }
    repere.position.set(x, hauteur(x, z) + 0.3, z);
    repere.visible = true;
    const R = niveau.retenue;
    if(R && Math.hypot(x - R.x, z - R.z) < R.cuvette.rayon){ message(`${R.nom} · altitude du bord ${nombreFr(coteReplat(t, R))} m`, 'info', 3500); return; }
    const pp = pistePlusProche(niveau.pistes, x, z);
    const ou = pp.dessus ? `sur la piste ${pp.piste.couleur} « ${pp.piste.nom} »` : `hors piste, à ${nombreFr(pp.auBord)} m de la piste`;
    message(`Altitude ${nombreFr(altitude(t, x, z, niveau.pistes))} m · ${ou}`, pp.dessus ? 'ok' : 'info', 3500);
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
        afficherConsigne(`Nuit ${reseau.nuit} · ${Math.max(0, Math.ceil(CONFIG.nuit.duree - nuit.temps))} s · ${nuit.regime.canons.filter(c => c.production).length} canon(s) en production · ${nombreFr(reseau.pisteNuit)} m³ sur la piste · +${euros(Math.round(reseau.argentNuit))}`);
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
    jets.maj(dt * (nuit ? nuit.vitesse : 1), sources, temps);
    for(const o of regards3D.values()) animerCanon(o.userData.canon, dt);
    animerSallePompage(salle, dt, temps);
    if(compresseur) animerCompresseur(compresseur, dt, temps);
    animerPannes(dt, temps);
    decalerVue();
    avancerDameuses(dt * (nuit ? nuit.vitesse : 1), temps);
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

  // Accueil
  synchroniser();
  const o = niveau.objectif;
  $('sousTitre').textContent = niveau.bac ? 'Bac à sable · tout est débloqué, budget illimité'
    : `Niveau ${niveau.numero} · ${niveau.nom} · objectif ${nombreFr(o.m3)} m³ ${o.type === 'production' ? `produits en ${o.nuits} nuits` : 'sur la piste'}${o.nuits && o.type !== 'production' ? ` en ${o.nuits} nuits` : ''}`;
  $('hudNeigeTitre').textContent = o.type === 'production' ? 'Neige produite' : 'Neige piste';
  const tactile = window.matchMedia('(pointer:coarse)').matches;
  const commandes = tactile ? 'Un doigt pour vous déplacer. Deux doigts : pincez pour zoomer, tournez-les pour pivoter, glissez-les vers le haut ou le bas pour incliner la vue.' : 'Glissez pour tourner, molette pour zoomer, clic droit pour déplacer la vue.';
  if(!OUVRIR_MENU) message(`${commandes} ${niveau.construction === false ? 'Lancez la nuit, puis pilotez la salle de pompage au poste de travail.' : 'Construisez, puis lancez la nuit.'}`, 'info', 7000);
  if(repris && !OUVRIR_MENU) message(`Partie reprise : prochaine nuit n° ${reseau.nuit}.`, 'ok', 4000);
  if(OUVRIR_MENU) ouvrirMenu();

  // Accès pour les essais automatiques (console du navigateur)
  window.nivo = { ouvrirOptions, agirOptions, get dameuses(){ return dameuses; }, synchroniser, scene, camera, renderer, cam, toucher, action, salle, compresseur, choisirOutil, valider, lancerNuit, ouvrirFiche, ouvrirPoste, agirPoste, ouvrirMenu, finirNuit,
    get reseau(){ return reseau; }, get nuit(){ return nuit; }, set choix(c){ choix = c; } };
}
