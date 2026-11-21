/* Escale : la scène 3D (Three.js), en style « dessin animé » (ombrage en tons, contours foncés), comme les autres jeux 3D.
   Repère (en mètres) : x le long de la piste, z vers la ville, y vers le haut. Le plan vient de ESCALE_MONDE.plan ;
   à chaque image, la scène place les avions et les véhicules d'après l'état de la simulation (A.vols, A.unites) et l'heure (A.t). */
window.ESCALE_3D = (() => {
  'use strict';
  const M = window.ESCALE_MONDE;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const alea = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  let T3 = null, R = null, scene = null, cam = null, ok = false, DEGRADE = null, CONTOUR = null, MAT = null, MATB = null, L = 1, H = 1;
  let monde = null, cleMonde = '', ciel = null, soleil = null, hemi = null, vitres = null, lampes = null, neige = null, toit = null;
  let plafonniers = null, lampesTerm = [];                           // l'éclairage de l'aérogare, la nuit
  let interieur = null, cleInt = '', foule = null, tetes = null, jambes = null, cheveux = null, sacs = null, tSim = null, coupe = false;
  const agents = [], files = { check:[], secu:[], pass:[] };
  let cuveG = null, cleCuve = '', jaugeCuve = null, citernes = [];
  const avions = new Map(), vehicules = new Map(), modeles = new Map(), passerelles = [];
  const vue = { x:0, z:-95, dist:380, cap:Math.PI + .45, incl:.9, suivi:null };

  const toon = o => new T3.MeshToonMaterial(Object.assign({ gradientMap:DEGRADE }, o));
  function geom(f, d, e = 0){
    switch(f){
      case 'boite': return new T3.BoxGeometry(d[0] + 2 * e, d[1] + 2 * e, d[2] + 2 * e);
      case 'cyl': return new T3.CylinderGeometry(d[0] + e, d[1] + e, d[2] + 2 * e, d[3] || 12);
      case 'cone': return new T3.ConeGeometry(d[0] + e, d[1] + 2 * e, d[2] || 10);
      case 'boule': return new T3.IcosahedronGeometry(d[0] + e, d[1] ?? 1);
    }
  }
  // gonfler une géométrie le long de ses normales (pour le contour des formes faites à la main)
  function gonfler(g, e){
    g = g.index ? g.toNonIndexed() : g.clone();
    if(!e) return g;
    const a = g.attributes.position.array, n = g.attributes.normal.array;
    for(let i = 0; i < a.length; i++) a[i] += n[i] * e;
    return g;
  }
  function fusion(pieces, e = 0){
    const pos = [], nor = [], col = [], c = new T3.Color();
    for(const p of pieces){
      let g = p.g ? gonfler(p.g, e) : geom(p.f, p.d, e); g = g.index ? g.toNonIndexed() : g;
      const q = new T3.Quaternion().setFromEuler(new T3.Euler(...(p.r || [0, 0, 0]), 'YXZ'));
      const mat = new T3.Matrix4().compose(new T3.Vector3(...(p.p || [0, 0, 0])), q, new T3.Vector3(...(p.s || [1, 1, 1])));
      g.applyMatrix4(mat);
      const a = g.attributes.position.array, n = g.attributes.normal.array, cs = g.attributes.color && !e ? g.attributes.color.array : null; c.set(p.c ?? 0xffffff);
      // une pièce en miroir (échelle négative) : on remet les triangles dans le bon sens
      const miroir = mat.determinant() < 0, ordre = miroir ? [0, 2, 1] : [0, 1, 2];
      for(let t = 0; t < a.length; t += 9) for(const k of ordre){ const i = t + k * 3; pos.push(a[i], a[i + 1], a[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]); if(cs) col.push(cs[i], cs[i + 1], cs[i + 2]); else col.push(c.r, c.g, c.b); }
      g.dispose();
    }
    const out = new T3.BufferGeometry();
    out.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T3.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new T3.Float32BufferAttribute(col, 3));
    return out;
  }
  function objet(pieces, e = .08, contour = true){
    const gr = new T3.Group(); gr.add(new T3.Mesh(fusion(pieces), MAT));
    if(contour) gr.add(new T3.Mesh(fusion(pieces, e), CONTOUR));
    return gr;
  }
  function plat(w, d, couleur, y = 0){ const m = new T3.Mesh(new T3.PlaneGeometry(w, d), toon({ color:couleur })); m.rotation.x = -Math.PI / 2; m.position.y = y; return m; }

  function init(canvas){
    if(ok) return true;
    try{
      T3 = window.THREE; if(!T3) return false;
      R = new T3.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
      R.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
      const d = new Uint8Array([105, 105, 105, 255, 180, 180, 180, 255, 255, 255, 255, 255]);
      DEGRADE = new T3.DataTexture(d, 3, 1, T3.RGBAFormat); DEGRADE.minFilter = DEGRADE.magFilter = T3.NearestFilter; DEGRADE.needsUpdate = true;
      CONTOUR = new T3.MeshBasicMaterial({ color:0x1B2333, side:T3.BackSide });
      MAT = toon({ vertexColors:true });
      MATB = new T3.MeshBasicMaterial({ vertexColors:true });
      cam = new T3.PerspectiveCamera(42, 1, 2, 9000);
      scene = new T3.Scene();
      ciel = new T3.Color(0x8FCBF3); scene.background = ciel; scene.fog = new T3.Fog(0xCFE6F7, 1400, 5200);
      hemi = new T3.HemisphereLight(0xF2F8FF, 0x6B7F5A, .75); scene.add(hemi);
      soleil = new T3.DirectionalLight(0xFFF4DE, .7); soleil.position.set(-.5, 1, .35); scene.add(soleil);
      ok = true;
    }catch(e){ console.error(e); ok = false; }
    return ok;
  }
  function taille(w, h){ if(!ok) return; L = w; H = h; R.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 50 : 38; cam.updateProjectionMatrix(); }

  /* ---------- Les textures dessinées ---------- */
  function texte(txt, w, h, fond, coul, taillePx){
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    if(fond){ x.fillStyle = fond; x.fillRect(0, 0, w, h); }
    x.fillStyle = coul; x.font = `800 ${taillePx}px "Bricolage Grotesque", system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2 + 2);
    const t = new T3.CanvasTexture(c); t.anisotropy = 4; return t;
  }
  function texturePiste(longueur){
    const c = document.createElement('canvas'); c.width = 2048; c.height = 128; const x = c.getContext('2d'), sx = 2048 / longueur;
    x.fillStyle = '#3A3F47'; x.fillRect(0, 0, 2048, 128);
    // un peu de texture : des traces de pneus près des seuils
    for(let i = 0; i < 260; i++){ x.fillStyle = `rgba(20,22,26,${Math.random() * .25})`; const px = (Math.random() < .5 ? hasardEntre(80, 380) : hasardEntre(longueur - 380, longueur - 80)) * sx; x.fillRect(px, 40 + Math.random() * 48, 6 + Math.random() * 30, 2 + Math.random() * 4); }
    x.fillStyle = '#F4F4F0';
    // les seuils (touches de piano), les numéros, l'axe en tirets, les bords, les zones de toucher
    for(const bout of [0, 1]){
      const x0 = bout ? 2048 - 8 * sx - 30 * sx : 8 * sx;
      for(let k = 0; k < 8; k++) x.fillRect(x0, 10 + k * 14.5, 30 * sx, 8);
      x.save(); x.translate(bout ? 2048 - 70 * sx : 70 * sx, 64); x.rotate(bout ? -Math.PI / 2 : Math.PI / 2); x.font = '900 46px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(bout ? '27' : '09', 0, 0); x.restore();
      for(const d of [150, 190]){ const px = bout ? 2048 - d * sx : d * sx; x.fillRect(px, 26, 18 * sx, 12); x.fillRect(px, 90, 18 * sx, 12); }
    }
    for(let px = 110 * sx; px < 2048 - 110 * sx; px += 36 * sx) x.fillRect(px, 62, 20 * sx, 4);
    x.fillRect(0, 3, 2048, 3); x.fillRect(0, 122, 2048, 3);
    const t = new T3.CanvasTexture(c); t.anisotropy = 8; return t;
  }
  const hasardEntre = (a, b) => a + Math.random() * (b - a);

  /* ---------- Construire l'aéroport ---------- */
  function construire(A){
    const P = M.plan(A), D = M.AEROPORTS[A.id], cle = A.id + ':' + A.portes.map(g => g.taille + (g.passerelle ? 'p' : '')).join(',')
      + '|' + (P.hangars || []).map(x => x.k + ((A.hangars || {})[x.k] ? '1' : '0')).join(',') + '|p' + M.nbPistes(A) + 'e' + (A.pisteExt || 0) + '|t' + A.terminal.l + 'x' + A.terminal.h + '|i' + (A.immo || []).map(b => b.type + b.parcelle).join(',');
    if(cle === cleMonde) return; cleMonde = cle;
    if(monde){ scene.remove(monde); monde.traverse(o => { if(o.geometry) o.geometry.dispose(); }); }
    for(const [, a] of avions){ scene.remove(a.obj); scene.remove(a.ombre); } avions.clear();
    for(const [, v] of vehicules) scene.remove(v.obj); vehicules.clear();
    passerelles.length = 0;
    monde = new T3.Group(); scene.add(monde);
    const rnd = alea(A.id.length * 977 + 13);
    const decor = D.decor, couleurSol = decor === 'montagne' ? 0x8DB574 : decor === 'mer' ? 0x9CC37A : 0x86AE6C;
    // le sol
    const sol = plat(9000, 9000, couleurSol, -.2); monde.add(sol);
    // l'aire de l'aéroport (herbe plus claire, tondue)
    const aire = plat(P.piste.x1 - P.piste.x0 + 500, 700 + (M.nbPistes(A) - 1) * M.ECART_PISTES, decor === 'montagne' ? 0x9CC484 : 0xA7CB86, -.1);
    aire.position.set(0, -.1, -130 - (M.nbPistes(A) - 1) * M.ECART_PISTES / 2); monde.add(aire);
    // la piste
    for(let k = 0; k < M.nbPistes(A); k++){
      const pi = P.pistes[k];
      const piste = new T3.Mesh(new T3.PlaneGeometry(pi.x1 - pi.x0, pi.largeur), new T3.MeshToonMaterial({ map:texturePiste(pi.x1 - pi.x0), gradientMap:DEGRADE }));
      piste.rotation.x = -Math.PI / 2; piste.position.set(0, .05, pi.z); monde.add(piste);
    }
    // les voies de circulation (asphalte) et leurs lignes jaunes
    const asphalte = [], jaune = [];
    const voie = (x1, z1, x2, z2, l = 23) => { const dx = x2 - x1, dz = z2 - z1, lg = Math.hypot(dx, dz), a = Math.atan2(dx, dz); asphalte.push({ f:'boite', d:[l, .1, lg + l], p:[(x1 + x2) / 2, .02, (z1 + z2) / 2], r:[0, a, 0], c:0x50555E }); jaune.push({ f:'boite', d:[.5, .02, lg], p:[(x1 + x2) / 2, .1, (z1 + z2) / 2], r:[0, a, 0], c:0xF2C230 }); };
    voie(P.piste.x0 + 20, M.TAXI_Z, P.piste.x1 - 20, M.TAXI_Z);
    for(const b of P.bretelles) voie(b, P.pistes[M.nbPistes(A) - 1].z + 10, b, M.TAXI_Z);
    voie(P.piste.x0 + 20, P.pistes[M.nbPistes(A) - 1].z + 10, P.piste.x0 + 20, M.TAXI_Z);
    for(const l of P.liens) voie(l, M.TAXI_Z, l, M.VOIE_P);
    // l'aire de stationnement (béton clair), la voie des postes, la route de service
    // le béton va jusqu'au dernier hangar : sans cela, ils seraient posés sur l'herbe
    const ax0 = P.liens[0] - 30, ax1 = Math.max(P.depot.x + 70, ...(P.hangars || []).map(g => g.x + 32));
    asphalte.push({ f:'boite', d:[ax1 - ax0, .08, M.FACADE_Z - M.VOIE_P + 22], p:[(ax0 + ax1) / 2, .01, (M.FACADE_Z + M.VOIE_P - 22) / 2], c:0x9DA2A8 });
    jaune.push({ f:'boite', d:[P.liens[1] - P.liens[0], .02, .5], p:[(P.liens[0] + P.liens[1]) / 2, .11, M.VOIE_P], c:0xF2C230 });
    jaune.push({ f:'boite', d:[P.depot.x - P.liens[0], .02, .35], p:[(P.liens[0] + P.depot.x) / 2, .11, M.SERVICE_Z - 4], c:0xFFFFFF });
    jaune.push({ f:'boite', d:[P.depot.x - P.liens[0], .02, .35], p:[(P.liens[0] + P.depot.x) / 2, .11, M.SERVICE_Z + 4], c:0xFFFFFF });
    // les postes : la ligne d'entrée, les limites, le numéro
    P.postes.forEach((p, i) => {
      jaune.push({ f:'boite', d:[.5, .02, p.nezZ - M.VOIE_P], p:[p.cx, .11, (p.nezZ + M.VOIE_P) / 2], c:0xF2C230 });
      jaune.push({ f:'boite', d:[.35, .02, 90], p:[p.cx - p.w / 2, .11, M.FACADE_Z - 45], c:0xE04A3A });
      const n = new T3.Mesh(new T3.PlaneGeometry(14, 7), new T3.MeshBasicMaterial({ map:texte(A.portes[i].nom, 128, 64, '#F2C230', '#1B2333', 40) }));
      n.rotation.x = -Math.PI / 2; n.rotation.z = Math.PI; n.position.set(p.cx, .14, M.VOIE_P + 14); monde.add(n);
    });
    jaune.push({ f:'boite', d:[.35, .02, 90], p:[P.postes[P.postes.length - 1].cx + P.postes[P.postes.length - 1].w / 2, .11, M.FACADE_Z - 45], c:0xE04A3A });
    monde.add(new T3.Mesh(fusion(asphalte), MAT), new T3.Mesh(fusion(jaune), MATB));
    // l'aérogare : un long bâtiment, une façade vitrée côté pistes, le toit et ses machines
    const T = P.terminal, tl = T.x1 - T.x0, tz = T.z1 - T.z0, cx = (T.x0 + T.x1) / 2, cz = (T.z0 + T.z1) / 2;
    // le bâtiment : le sol, les pignons et les piliers restent ; le toit (et ses machines) s'enlève quand on zoome, pour voir dedans
    const bat = [
      { f:'boite', d:[tl, .5, tz], p:[cx, .25, cz], c:0xDCE1E7 },
      { f:'boite', d:[1.2, 15, tz], p:[T.x0 + .6, 7.5, cz], c:0xE6E8EC }, { f:'boite', d:[1.2, 15, tz], p:[T.x1 - .6, 7.5, cz], c:0xE6E8EC },
      { f:'boite', d:[tl, 2, 10], p:[cx, 4.5, T.z1 + 5], c:0xBFC5CC },                   // l'auvent côté ville
    ];
    for(let k = 1; k < Math.floor(tl / 30); k++) bat.push({ f:'boite', d:[1, 11.5, 1], p:[T.x0 + k * tl / Math.floor(tl / 30), 6, T.z0 + .6], c:0xC9CED6 }, { f:'boite', d:[1, 11.5, 1], p:[T.x0 + k * tl / Math.floor(tl / 30), 6, T.z1 - .6], c:0xC9CED6 });
    monde.add(objet(bat, .2));
    const toitP = [
      { f:'boite', d:[tl, 3.6, tz], p:[cx, 13.4, cz], c:0xE6E8EC },
      { f:'boite', d:[tl + 4, 1.6, tz + 4], p:[cx, 15.6, cz], c:0x9AA2AE },
      { f:'boite', d:[tl * .6, 5, tz * .5], p:[cx - tl * .1, 18, cz + 4], c:0xD5D9DF },
      { f:'boite', d:[tl * .6 + 1.4, .9, tz * .5 + 1.4], p:[cx - tl * .1, 20.8, cz + 4], c:0x8C949F },
    ];
    for(let k = 0; k < Math.floor(tl / 40); k++) toitP.push({ f:'boite', d:[6, 2.4, 5], p:[T.x0 + 20 + k * 40 + rnd() * 10, 17.6, cz + (rnd() - .5) * 20], c:0xB4BBC4 });
    toit = objet(toitP, .25); monde.add(toit);
    /* L'éclairage de l'aérogare. La nuit, quand on zoome et que le toit s'enlève, l'intérieur
       n'était éclairé que par le peu de lune qui reste : on ne voyait plus ni les comptoirs ni la
       foule. Deux choses, donc : des bandeaux lumineux suspendus au plafond, qu'on voit dès que le
       toit est retiré, et quelques lampes douces qui éclairent vraiment le sol, les constructions
       et les passagers. Les lampes restent dans la scène en permanence (changer leur nombre
       obligerait la carte graphique à tout recompiler) : seule leur force varie avec l'heure. */
    const neons = [], rangs = Math.max(2, Math.round(tz / 16));
    for(let r = 0; r < rangs; r++){
      const nz = T.z0 + (r + .5) * tz / rangs;
      for(let bx = T.x0 + 8; bx < T.x1 - 6; bx += 16) neons.push({ f:'boite', d:[11, .5, 1.1], p:[bx + 5.5, 10.4, nz], c:0xFFF6E2 });
    }
    plafonniers = new T3.Mesh(fusion(neons), new T3.MeshBasicMaterial({ vertexColors:true, transparent:true, opacity:.2, depthWrite:false }));
    monde.add(plafonniers);
    lampesTerm = [];
    const nLampes = Math.max(2, Math.min(5, Math.round(tl / 90)));
    for(let k = 0; k < nLampes; k++){
      const pl = new T3.PointLight(0xFFE7BE, 0, tl / nLampes + tz + 60, 1.4);
      pl.position.set(T.x0 + (k + .5) * tl / nLampes, 11, cz);
      monde.add(pl); lampesTerm.push(pl);
    }
    // la façade vitrée (elle s'allume la nuit, et devient transparente quand on regarde dedans)
    vitres = new T3.MeshToonMaterial({ color:0x3E8EDB, gradientMap:DEGRADE, emissive:0x000000, transparent:true, opacity:1, side:T3.DoubleSide });
    const ctex = document.createElement('canvas'); ctex.width = 512; ctex.height = 64; const xt = ctex.getContext('2d'); xt.fillStyle = '#fff'; xt.fillRect(0, 0, 512, 64); xt.fillStyle = 'rgba(30,50,80,.55)'; for(let k = 0; k < 512; k += 16) xt.fillRect(k, 0, 2, 64); xt.fillRect(0, 30, 512, 2);
    const tv = new T3.CanvasTexture(ctex); tv.wrapS = T3.RepeatWrapping; tv.repeat.set(tl / 60, 1); vitres.map = tv;
    const facade = new T3.Mesh(new T3.PlaneGeometry(tl - 2, 11), vitres); facade.rotation.y = Math.PI; facade.position.set(cx, 6, T.z0 - .1); monde.add(facade);
    const facade2 = new T3.Mesh(new T3.PlaneGeometry(tl - 2, 11), vitres); facade2.position.set(cx, 6, T.z1 + .1); monde.add(facade2);
    // le nom de l'aéroport sur le toit
    const nom = new T3.Mesh(new T3.PlaneGeometry(Math.min(tl * .55, 160), 18), new T3.MeshBasicMaterial({ map:texte(D.nom.toUpperCase(), 1024, 128, null, '#1B4E8C', 96), transparent:true }));
    nom.rotation.x = -Math.PI / 2; nom.rotation.z = Math.PI; nom.position.set(cx + tl * .18, 16.5, cz - 6); toit.add(nom);
    cleInt = ''; agents.length = 0; files.check.length = files.secu.length = files.pass.length = 0; tSim = null; coupe = null;
    // les portes : passerelle (rotonde et couloir) ou escalier
    P.postes.forEach((p, i) => {
      if(!A.portes[i].passerelle) return;
      const rot = objet([{ f:'cyl', d:[3.2, 3.2, 6.5, 14], p:[0, 3.25, 0], c:0xC9CED6 }, { f:'boite', d:[5, 3, 5], p:[0, 7.5, 0], c:0x9AA2AE }], .15);
      rot.position.set(p.cx + 9, 0, M.FACADE_Z - 4); monde.add(rot);
      const couloir = objet([{ f:'boite', d:[3.2, 3.2, 1], p:[0, 0, .5], c:0xDADDE2 }, { f:'boite', d:[3.25, .5, 1], p:[0, 1.5, .5], c:0x2F6FB5 }], .1);
      couloir.position.set(p.cx + 9, 5.2, M.FACADE_Z - 4); monde.add(couloir);
      const pied = objet([{ f:'boite', d:[.8, 5, .8], p:[0, -2.5, 0], c:0x6E7681 }, { f:'boite', d:[3, .8, 1.5], p:[0, -5, 0], c:0x3A3F47 }], .08);
      monde.add(pied);
      passerelles.push({ porte:i, couloir, pied, x0:p.cx + 9, z0:M.FACADE_Z - 4, sorti:0 });
    });
    // la tour de contrôle
    const tour = objet([{ f:'cyl', d:[3.2, 4.2, 38, 12], p:[0, 19, 0], c:0xE9ECEF }, { f:'cyl', d:[7, 5.5, 4, 12], p:[0, 40, 0], c:0x56C1E8 }, { f:'cyl', d:[7.6, 7.6, 1.2, 12], p:[0, 42.6, 0], c:0x5C6672 }, { f:'cyl', d:[.25, .25, 7, 6], p:[2, 46, 0], c:0x5C6672 }, { f:'boite', d:[12, 4, 12], p:[0, 2, 0], c:0xD5D9DF }], .2);
    tour.position.set(P.tour.x, 0, P.tour.z); monde.add(tour);
    // le dépôt des véhicules (un hangar), la station de carburant
    const dep = objet([{ f:'boite', d:[46, 12, 30], p:[0, 6, 18], c:0xD9C9A3 }, { f:'boite', d:[48, 1.2, 32], p:[0, 12.6, 18], c:0x7F8C8D }, { f:'boite', d:[20, 9, .4], p:[0, 4.5, 2.9], c:0x5C6672 }], .2);
    dep.position.set(P.depot.x, 0, P.depot.z + 10); monde.add(dep);
    // les hangars : construits, ils ont leur enseigne et leur porte ; pas encore construits, c'est
    // un terrain vague avec un panneau de chantier, pour qu'on voie la place qui les attend
    for(const hg of P.hangars || []){
      const H = M.HANGARS[hg.k], bati = !!(A.hangars || {})[hg.k];
      const b = bati
        ? objet([{ f:'boite', d:[44, 11, 26], p:[0, 5.5, 0], c:0xCFCFC4 }, { f:'boite', d:[46, 1.1, 28], p:[0, 11.6, 0], c:0x6F7A86 },
                 { f:'boite', d:[18, 8.5, .4], p:[0, 4.2, -13.1], c:0x4E5862 }, { f:'boite', d:[44, .1, 10], p:[0, .05, -18], c:0x8A9096 }], .2)
        : objet([{ f:'boite', d:[44, .1, 26], p:[0, .05, 0], c:0x9A9478 }, { f:'boite', d:[.6, 4, .6], p:[-6, 2, -13], c:0x7A6A4A }, { f:'boite', d:[.6, 4, .6], p:[6, 2, -13], c:0x7A6A4A }], .2);
      b.position.set(hg.x, 0, hg.z); monde.add(b);
      const pan = new T3.Mesh(new T3.PlaneGeometry(26, 6.5), new T3.MeshBasicMaterial({ map:texteCache(H.ico + ' ' + H.nom, bati ? '#14233A' : '#9A6B1F', bati ? '#FFB703' : '#FFF3D6', 1024), side:T3.DoubleSide, transparent:true }));
      pan.position.set(hg.x, bati ? 14.5 : 5.2, hg.z - 13.4); monde.add(pan);
    }
    cleCuve = '';                                                    // les cuves sont construites dans majCuve (selon leur niveau)
    // côté ville : la route, le parking et ses voitures
    const route = []; route.push({ f:'boite', d:[tl + 300, .1, 16], p:[cx, .02, T.z1 + 20], c:0x4A4F57 }, { f:'boite', d:[tl + 60, .1, 70], p:[cx, .02, T.z1 + 70], c:0x5A5F67 });
    for(let k = 0; k < tl + 60; k += 6) route.push({ f:'boite', d:[.25, .02, 12], p:[T.x0 - 30 + k, .1, T.z1 + 58], c:0xFFFFFF }, { f:'boite', d:[.25, .02, 12], p:[T.x0 - 30 + k, .1, T.z1 + 82], c:0xFFFFFF });
    monde.add(new T3.Mesh(fusion(route), MAT));
    const voitures = []; const cv = [0xD7263D, 0x1B98E0, 0xF2F2EE, 0x2E294E, 0x8C949F, 0xF18F01, 0x111111];
    for(let k = 0; k < tl + 60 - 6; k += 6) for(const zz of [52, 64, 76, 88]) if(rnd() < .7){ const c = cv[Math.floor(rnd() * cv.length)]; voitures.push({ f:'boite', d:[2.1, 1.3, 4.4], p:[T.x0 - 27 + k, .75, T.z1 + zz], c }, { f:'boite', d:[1.8, .8, 2.2], p:[T.x0 - 27 + k, 1.7, T.z1 + zz + .2], c:0x2A3442 }); }
    if(voitures.length) monde.add(new T3.Mesh(fusion(voitures), MAT));
    // les feux de piste (ils brillent la nuit)
    const pts = [];
    for(let k = 0; k < M.nbPistes(A); k++) for(let x = P.pistes[k].x0; x <= P.pistes[k].x1; x += 30){ pts.push(x, .6, P.pistes[k].z - 23, x, .6, P.pistes[k].z + 23); }
    for(let x = P.piste.x0 + 20; x <= P.piste.x1 - 20; x += 25) pts.push(x, .4, M.TAXI_Z - 12, x, .4, M.TAXI_Z + 12);
    const gl = new T3.BufferGeometry(); gl.setAttribute('position', new T3.Float32BufferAttribute(pts, 3));
    const colL = []; for(let k = 0; k < pts.length / 3; k++){ const piste_ = pts[k * 3 + 2] < M.TAXI_Z - 20; colL.push(piste_ ? 1 : .2, piste_ ? .95 : .45, piste_ ? .8 : 1); }
    gl.setAttribute('color', new T3.Float32BufferAttribute(colL, 3));
    lampes = new T3.Points(gl, new T3.PointsMaterial({ size:2.4, vertexColors:true, transparent:true, opacity:.2, sizeAttenuation:true, depthWrite:false })); monde.add(lampes);
    // le décor autour
    decorer(D.decor, P, rnd);
    // l'immobilier de l'aéroport
    for(const b of A.immo || []){ const pl = P.parcelles[b.parcelle]; if(!pl) continue; const g = objet(immoPieces(b.type), .1); g.position.set(pl.x, 0, pl.z); monde.add(g); }
    // la neige qui tombe
    const ng = new T3.BufferGeometry(), np = []; for(let k = 0; k < 2500; k++) np.push((Math.random() - .5) * 1600, Math.random() * 300, (Math.random() - .5) * 1600 - 120);
    ng.setAttribute('position', new T3.Float32BufferAttribute(np, 3));
    neige = new T3.Points(ng, new T3.PointsMaterial({ color:0xFFFFFF, size:1.6, transparent:true, opacity:.9, depthWrite:false })); neige.visible = false; monde.add(neige);
  }

  // les bâtiments de l'immobilier de l'aéroport (autour de leur parcelle, au sol)
  function immoPieces(type){
    const p = [], fen = (x0, y0, z, nx, ny, dx, dy, c = 0x2A3F5F) => { for(let i = 0; i < nx; i++) for(let j = 0; j < ny; j++) p.push({ f:'boite', d:[dx * .55, dy * .55, .4], p:[x0 + i * dx, y0 + j * dy, z], c }); };
    switch(type){
      case 'station':
        p.push({ f:'boite', d:[34, .8, 22], p:[0, 5.4, 0], c:0xE63946 }, { f:'boite', d:[34.5, .4, 22.5], p:[0, 5.9, 0], c:0xFFFFFF });
        for(const [x, z] of [[-14, -8], [14, -8], [-14, 8], [14, 8]]) p.push({ f:'cyl', d:[.5, .5, 5, 8], p:[x, 2.5, z], c:0x8C949F });
        for(const x of [-8, 0, 8]) p.push({ f:'boite', d:[1.4, 2.4, 1], p:[x, 1.2, 0], c:0xF2C230 }, { f:'boite', d:[1.1, .6, .1], p:[x, 2, .55], c:0x14233A });
        p.push({ f:'boite', d:[14, 4, 8], p:[-8, 2, -16], c:0xE9EDF2 }, { f:'boite', d:[14.5, .6, 8.5], p:[-8, 4.3, -16], c:0xE63946 }); break;
      case 'parking':
        for(let k = 0; k < 4; k++){ p.push({ f:'boite', d:[44, .8, 34], p:[0, 3.6 + k * 3.6, 0], c:0xA7ADB6 }, { f:'boite', d:[44, 1, .5], p:[0, 4.3 + k * 3.6, 17], c:0xC9CED6 }); for(let c = 0; c < 6; c++) p.push({ f:'boite', d:[2.1, 1.3, 4.4], p:[-17 + c * 6.6, 4.6 + k * 3.6, -8], c:[0xD7263D, 0x1B98E0, 0xF2F2EE, 0x2E294E][(c + k) % 4] }); }
        for(const x of [-20, -7, 7, 20]) for(const z of [-14, 14]) p.push({ f:'boite', d:[1.2, 15, 1.2], p:[x, 7.5, z], c:0x8C949F });
        p.push({ f:'boite', d:[10, 3, .6], p:[0, 16, 17], c:0x1B4E8C }, { f:'boite', d:[8, 1.4, .7], p:[0, 16, 17], c:0xFFFFFF }); break;
      case 'hotel':
        p.push({ f:'boite', d:[34, 30, 20], p:[0, 15, 0], c:0xE9E4D8 }, { f:'boite', d:[36, 3, 22], p:[0, 31, 0], c:0x1B4E8C }, { f:'boite', d:[20, 5, 14], p:[0, 2.5, 18], c:0xBFD9EA }, { f:'boite', d:[22, .6, 16], p:[0, 5.2, 18], c:0x1B4E8C });
        fen(-14, 6, 10.3, 8, 6, 4, 4.4); fen(-14, 6, -10.3, 8, 6, 4, 4.4); p.push({ f:'boite', d:[10, 1.6, .5], p:[0, 33, 11.4], c:0xFFB703 }); break;
      case 'bureaux':
        p.push({ f:'boite', d:[26, 52, 26], p:[0, 26, 0], c:0x3A6EA5 }); for(let k = 0; k < 13; k++) p.push({ f:'boite', d:[26.6, .8, 26.6], p:[0, 2 + k * 4, 0], c:0xDDE7F3 });
        p.push({ f:'boite', d:[18, 4, 18], p:[0, 54, 0], c:0x5C6672 }, { f:'cyl', d:[.2, .2, 10, 6], p:[0, 61, 0], c:0xD7263D }); break;
      case 'fret':
        for(const z of [-14, 14]){ p.push({ f:'boite', d:[46, 9, 20], p:[0, 4.5, z], c:0xB9BEC6 }, { f:'boite', d:[47, 1, 21], p:[0, 9.4, z], c:0x5C6672 }); for(let k = 0; k < 4; k++) p.push({ f:'boite', d:[7, 6, .5], p:[-16 + k * 10.5, 3, z + (z > 0 ? -10.3 : 10.3)], c:0x2A6F4D }); }
        p.push({ f:'boite', d:[3, 3, 9], p:[22, 1.8, 0], c:0xF18F01 }, { f:'boite', d:[3, 4.6, 12], p:[22, 3, 12], c:0xFFFFFF }); break;
      case 'tour':
        p.push({ f:'cyl', d:[2.6, 3.4, 44, 12], p:[0, 22, 0], c:0xD9DEE4 }, { f:'cyl', d:[11, 7, 4, 18], p:[0, 46, 0], c:0x5C6672 }, { f:'cyl', d:[10.5, 10.5, 3, 18], p:[0, 49, 0], c:0xBFE3F0 }, { f:'cyl', d:[11, 11, .6, 18], p:[0, 50.7, 0], c:0x1B4E8C }, { f:'cyl', d:[.25, .25, 14, 6], p:[0, 58, 0], c:0xD7263D });
        for(const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) p.push({ f:'boite', d:[1.4, 6, 1.4], p:[x, 3, z], c:0xB9BEC6 }); break;
    }
    return p;
  }
  function decorer(decor, P, rnd){
    const arbres = [], loin = [];
    const arbre = (x, z, s, sapin) => sapin ? arbres.push({ f:'cone', d:[3 * s, 11 * s, 7], p:[x, 6 * s, z], c:0x2F6B3F }, { f:'cyl', d:[.6 * s, .6 * s, 2 * s, 5], p:[x, .8 * s, z], c:0x6B4A2F })
      : arbres.push({ f:'boule', d:[4 * s, 0], p:[x, 5 * s, z], c:0x4E8F3E }, { f:'cyl', d:[.6 * s, .7 * s, 3 * s, 5], p:[x, 1.5 * s, z], c:0x6B4A2F });
    // on dégage aussi la place de la seconde piste, construite ou non : sinon des arbres
    // pousseraient là où elle doit s'ouvrir, et ils y resteraient
    const zLoin = P.pistes[P.pistes.length - 1].z;
    const libre = (x, z) => !(z > zLoin - 60 && z < 160 && x > P.piste.x0 - 120 && x < P.piste.x1 + 120);
    for(let k = 0; k < 420; k++){ const x = (rnd() - .5) * 2600, z = (rnd() - .5) * 1800 - 100; if(libre(x, z)) arbre(x, z, .8 + rnd() * .8, decor === 'montagne' || (decor === 'ville' && rnd() < .3)); }
    if(decor === 'montagne'){
      // les montagnes enneigées tout autour
      for(let k = 0; k < 16; k++){
        const a = k / 16 * Math.PI * 2 + rnd() * .2, d = 1900 + rnd() * 700, h = 380 + rnd() * 520, r = 420 + rnd() * 280, x = Math.cos(a) * d, z = Math.sin(a) * d - 200;
        loin.push({ f:'cone', d:[r, h, 7], p:[x, h / 2 - 5, z], c:0x6E7F8F }, { f:'cone', d:[r * .42, h * .42, 7], p:[x, h - h * .21 - 4, z], c:0xF7FAFC });
      }
    } else if(decor === 'mer'){
      // la mer au-delà de la piste, la plage, les palmiers
      const mer = plat(9000, 3000, 0x2C8FC9, -.05); mer.position.z = P.piste.z - 1700; monde.add(mer);
      const plage = plat(9000, 90, 0xEBD9A8, -.08); plage.position.z = P.piste.z - 240; monde.add(plage);
      for(let x = -2200; x < 2200; x += 60 + rnd() * 60){ const z = P.piste.z - 210 + rnd() * 40; arbres.push({ f:'cyl', d:[.5, .7, 12, 5], p:[x, 6, z], r:[0, 0, .15], c:0x8B6B43 }, { f:'cone', d:[6, 3, 6], p:[x + .9, 12.5, z], c:0x3E9B4F }); }
      for(let k = 0; k < 6; k++){ const x = (rnd() - .5) * 3000, z = P.piste.z - 700 - rnd() * 900; loin.push({ f:'boite', d:[14, 3, 5], p:[x, 1.5, z], c:0xFFFFFF }, { f:'boite', d:[1.2, 9, 1.2], p:[x, 7, z], c:0xD7DDE4 }); }
    } else {
      // la ville : des immeubles derrière l'aérogare
      for(let k = 0; k < 220; k++){
        const x = (rnd() - .5) * 3400, z = 330 + rnd() * 1300, h = 15 + rnd() * rnd() * 140, w = 22 + rnd() * 30, cs = [0xC7CCD3, 0xA9B4C2, 0xD9CBB5, 0x8E9AAF, 0xBFC9D6];
        loin.push({ f:'boite', d:[w, h, w * (.7 + rnd() * .6)], p:[x, h / 2, z], c:cs[Math.floor(rnd() * cs.length)] });
      }
      const tours = [[300, 620, 260], [-420, 700, 220], [80, 900, 300]];
      for(const [x, z, h] of tours) loin.push({ f:'boite', d:[34, h, 34], p:[x, h / 2, z], c:0x6C8EBF }, { f:'cyl', d:[1, 1, 30, 6], p:[x, h + 15, z], c:0x8C949F });
    }
    if(arbres.length) monde.add(objet(arbres, .2));
    if(loin.length) monde.add(objet(loin, 1.5));
  }

  /* ---------- Les avions ---------- */
  const RAYON = { atr72:1.35, q400:1.35, e190:1.5, a220:1.75, a320:2, b738:1.95, a321:2, b789:2.9, a359:3, b77w:3.15, a388:3.6 };
  function aile(envergure, cordeRacine, cordeBout, fleche, epaisseur){
    const s = new T3.Shape();
    s.moveTo(0, 0); s.lineTo(envergure, -fleche); s.lineTo(envergure, -fleche - cordeBout); s.lineTo(0, -cordeRacine); s.lineTo(0, 0);
    const g = new T3.ExtrudeGeometry(s, { depth:epaisseur, bevelEnabled:false });
    g.translate(0, 0, -epaisseur / 2); g.rotateX(Math.PI / 2); g.computeVertexNormals();
    return g;
  }
  // une bande le long du bord de fuite (volets, ailerons) : de la fraction x0 à x1 de l'envergure, sur la fraction `part` de la corde
  function bandeFuite(envergure, cordeRacine, cordeBout, fleche, epaisseur, x0, x1, part){
    const corde = x => cordeRacine + (cordeBout - cordeRacine) * x / envergure, fuite = x => -(cordeRacine + (fleche + cordeBout - cordeRacine) * x / envergure);
    const a = x0 * envergure, b = x1 * envergure, s = new T3.Shape();
    s.moveTo(a, fuite(a)); s.lineTo(b, fuite(b)); s.lineTo(b, fuite(b) + corde(b) * part); s.lineTo(a, fuite(a) + corde(a) * part); s.lineTo(a, fuite(a));
    const g = new T3.ExtrudeGeometry(s, { depth:epaisseur, bevelEnabled:false });
    g.translate(0, 0, -epaisseur / 2); g.rotateX(Math.PI / 2); g.computeVertexNormals();
    return g;
  }
  function couleursLivree(comp, livree){
    const C = M.COMPAGNIES[comp], c1 = new T3.Color(C.c1), c2 = new T3.Color(C.c2), c3 = new T3.Color(C.c3), blanc = new T3.Color(0xF4F6F8), or = new T3.Color(0xD4AF37);
    return { c1, c2, c3, blanc, or, livree };
  }
  // le fuselage : un tour (lathe) avec des couleurs selon la livrée (bandes, ventre, hublots)
  function fuselage(type, comp, livree, lg, r){
    const prof = [], n = 72;
    for(let k = 0; k <= n; k++){
      const u = k / n, z = u * lg;
      let rr = r;
      if(u < .12) rr = r * Math.pow(u / .12, .55);               // le nez arrondi
      else if(u > .74) rr = r * (1 - Math.pow((u - .74) / .26, 1.6) * .82);   // la queue qui s'affine
      prof.push(new T3.Vector2(Math.max(.05, rr), z));
    }
    const g = new T3.LatheGeometry(prof, 40);
    g.rotateX(Math.PI / 2); g.translate(0, 0, -lg / 2); g.rotateY(Math.PI);    // nez vers +z
    // la queue relevée (pour l'empennage)
    const a = g.attributes.position.array;
    for(let i = 0; i < a.length; i += 3){ const u = (lg / 2 - a[i + 2]) / lg; if(u > .7) a[i + 1] += (u - .7) * r * 1.6; if(AV(type).deuxPonts) a[i + 1] *= a[i + 1] > 0 ? 1.25 : 1; }
    g.computeVertexNormals();
    const L = couleursLivree(comp, livree), col = [], cc = new T3.Color();
    for(let i = 0; i < a.length; i += 3){
      const y = a[i + 1] / r, u = (lg / 2 - a[i + 2]) / lg;        // u : 0 au nez, 1 à la queue
      let c = L.blanc;
      if(livree === 'ventre' && y < -.15) c = L.c1;
      if(livree === 'bande' && y > -.35 && y < .05) c = L.c1;
      if(livree === 'bande' && y >= .05 && y < .14) c = L.c2;
      if(livree === 'speciale') c = u < .18 || u > .78 ? L.c2 : L.c1;
      if(livree === 'or') c = y < -.2 ? L.c1 : L.or;
      if(livree === 'degrade') c = cc.set(L.c1).lerp(L.c2, clamp(u * 1.15, 0, 1));
      if(livree === 'pointes') c = u < .14 || u > .86 ? L.c1 : y < -.5 ? L.c2 : L.blanc;
      if(livree === 'base' && y > -.42 && y < -.28 && u > .1) c = L.c1;
      // les hublots (une bande sombre), le poste de pilotage
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new T3.Float32BufferAttribute(col, 3));
    return g;
  }
  const AV = t => M.AVIONS[t];
  function modeleAvion(type, comp, livree){
    const cle = type + '|' + comp + '|' + livree;
    if(modeles.has(cle)) return modeles.get(cle);
    const A = AV(type), C = M.COMPAGNIES[comp], r = RAYON[type], lg = A.longueur, env = A.envergure;
    const hDq = () => r * (A.taille === 'S' ? 2.6 : 2.2);
    const L = couleursLivree(comp, livree), c1 = L.c1.getHex(), c2 = L.c2.getHex(), c3 = livree === 'or' ? 0xD4AF37 : L.c3.getHex(), gris = 0xC9CED6;
    const p = [];
    p.push({ g:fuselage(type, comp, livree, lg, r) });
    const haute = A.aile === 'haute', yAile = haute ? r * .85 : -r * .32, zAile = haute ? lg * .02 : lg * .06;
    const corde = haute ? lg * .12 : lg * (A.taille === 'S' ? .17 : .2), fleche = haute ? 0 : corde * (A.taille === 'L' || A.taille === 'XL' ? 1.2 : .9);
    for(const s of [1, -1]){
      const ga = aile(env / 2 - r * .6, corde, corde * .35, fleche, r * .16);
      p.push({ g:ga, p:[s * r * .6, yAile, zAile + corde / 2], s:[s, 1, 1], c:gris });
      // les volets (près du fuselage) et les ailerons (vers le bout), un ton plus sombre
      const lg1 = env / 2 - r * .6;
      p.push({ g:bandeFuite(lg1, corde, corde * .35, fleche, r * .2, .08, .56, .24), p:[s * r * .6, yAile, zAile + corde / 2], s:[s, 1, 1], c:0xA9B2BE, nc:true });
      p.push({ g:bandeFuite(lg1, corde, corde * .35, fleche, r * .2, .64, .94, .2), p:[s * r * .6, yAile, zAile + corde / 2], s:[s, 1, 1], c:0x8E99A6, nc:true });
      // le saumon (winglet) des réacteurs
      if(!haute) p.push({ f:'boite', d:[.25, r * .9, corde * .3], p:[s * (env / 2 - .1), yAile + r * .45, zAile + corde / 2 - fleche - corde * .2], r:[0, 0, -s * .25], c:c1 });
      // l'empennage horizontal
      p.push({ g:aile(env * .17, corde * .55, corde * .25, corde * .45, r * .12), p:[s * r * .3, r * (haute ? 1.9 : .45), -lg / 2 + corde * .65], s:[s, 1, 1], c:livree === 'speciale' ? c1 : gris });
      // les moteurs
      const nM = A.moteurs === 'quatre' ? 2 : 1;
      for(let k = 0; k < nM; k++){
        const ex = s * (r + (env / 2) * (nM === 2 ? (k ? .62 : .3) : (haute ? .22 : .3)));
        const ez = zAile + corde / 2 - fleche * Math.abs(ex) / (env / 2) + (haute ? corde * .55 : corde * .35);
        if(A.moteurs === 'helices'){
          p.push({ f:'cyl', d:[r * .32, r * .26, corde * 1.4, 10], p:[ex, yAile - r * .15, ez - corde * .4], r:[Math.PI / 2, 0, 0], c:c3 });
          p.push({ f:'cone', d:[r * .14, r * .3, 8], p:[ex, yAile - r * .15, ez + corde * .45], r:[Math.PI / 2, 0, 0], c:0x2A3442 });
        } else {
          // le moteur est accroché SOUS l'aile par un mât : son entrée d'air dépasse devant le bord d'attaque, sa tuyère finit sous l'aile
          const re = r * (A.gros ? .55 : .42), xl = (Math.abs(ex) - r * .6) / (env / 2 - r * .6);
          const zBord = zAile + corde / 2 - fleche * clamp(xl, 0, 1);                       // le bord d'attaque à cet endroit de l'aile
          const zm = zBord + re * 1.05, pieds = r * 1.35 + (A.taille === 'S' ? .5 : A.taille === 'M' ? .6 : .75), ym = Math.max(yAile - r * .08 - re * 1.05 - .15, -pieds + re + 1);     // jamais plus bas qu'1 m au-dessus du sol                // le centre de la nacelle
          p.push({ f:'cyl', d:[re, re * .86, re * 3.3, 16], p:[ex, ym, zm], r:[Math.PI / 2, 0, 0], c:c3 });
          p.push({ f:'cyl', d:[re * .82, re * .82, .2, 16], p:[ex, ym, zm + re * 1.66], r:[Math.PI / 2, 0, 0], c:0x1E2430, nc:true });
          p.push({ f:'cyl', d:[re * 1.03, re * 1.03, re * .3, 16], p:[ex, ym, zm + re * 1.45], r:[Math.PI / 2, 0, 0], c:0xE3E7EC });              // la lèvre de l'entrée d'air
          p.push({ f:'cone', d:[re * .22, re * .5, 8], p:[ex, ym, zm + re * 1.62], r:[Math.PI / 2, 0, 0], c:0xC9CED6, nc:true });                    // le cône central de la soufflante
          p.push({ f:'cone', d:[re * .55, re * 1.1, 12], p:[ex, ym, zm - re * 1.95], r:[-Math.PI / 2, 0, 0], c:0x4A5058 });                      // la tuyère
          p.push({ f:'boite', d:[Math.max(.3, re * .22), re * .95, re * 2.3], p:[ex, yAile - r * .08 - re * .3, zm - re * .15], c:gris });        // le mât, entre l'aile et la nacelle
        }
      }
    }
    // les hublots un par un (deux rangées sur l'A380), les portes, le cockpit
    const rUn = u => u < .12 ? r * Math.pow(u / .12, .55) : u > .74 ? r * (1 - Math.pow((u - .74) / .26, 1.6) * .82) : r;
    const pasH = Math.max(lg * .021, .9);
    for(const rang of A.deuxPonts ? [.2, .72] : [.27]) for(let u = .19; u <= .7; u += pasH / lg) for(const sd of [1, -1]){
      const rr = rUn(u), yy = r * rang, x = Math.sqrt(Math.max(.01, rr * rr - yy * yy));
      p.push({ f:'boite', d:[.16, r * .1, pasH * .5], p:[sd * (x + .01), yy * (A.deuxPonts && rang > .5 ? 1.25 : 1), lg / 2 - u * lg], c:0x27323F, nc:true });
    }
    for(const u of A.taille === 'S' ? [.15, .7] : [.15, .45, .72]) for(const sd of [1, -1])
      p.push({ f:'boite', d:[.2, r * .62, lg * .018], p:[sd * (rUn(u) * .985), r * .1, lg / 2 - u * lg], c:0xDDE2E8, nc:true });
    // les vitres du cockpit : sur la peau du nez, deux de chaque côté et un pare-brise en V devant
    for(const u of [.055, .085]) for(const sd of [1, -1]){ const rr = rUn(u), yy = r * .44, x = Math.sqrt(Math.max(.01, rr * rr - yy * yy)); p.push({ f:'boite', d:[.2, r * .26, lg * .02], p:[sd * (x + .02), yy, lg / 2 - u * lg], c:0x1E2A38, nc:true }); }
    for(const sd of [1, -1]){ const u = .03, rr = rUn(u), yy = r * .36, x = Math.sqrt(Math.max(.01, rr * rr - yy * yy)); p.push({ f:'boite', d:[x * 1.0, r * .24, .16], p:[sd * x * .5, yy + r * .02, lg / 2 - u * lg + .04], r:[0, sd * .5, 0], c:0x1E2A38, nc:true }); }
    // la liaison aile-fuselage
    if(!haute) p.push({ f:'boite', d:[r * 1.9, r * .4, corde * 1.15], p:[0, yAile + r * .05, zAile + corde * .35], c:0xDDE2E8 });
    // les feux de bout d'aile : rouge à gauche, vert à droite, blanc à la queue
    p.push({ f:'boite', d:[.3, .3, .5], p:[env / 2 - .2, yAile + (haute ? 0 : r * .9), zAile + corde / 2 - fleche - corde * .5], c:0x2BA84A, nc:true });
    p.push({ f:'boite', d:[.3, .3, .5], p:[-(env / 2 - .2), yAile + (haute ? 0 : r * .9), zAile + corde / 2 - fleche - corde * .5], c:0xE5383B, nc:true });
    p.push({ f:'boite', d:[.3, .3, .3], p:[0, r * .55 + hDq(), -lg / 2 + lg * .02], c:0xFFFFFF, nc:true });
    // la dérive (aux couleurs de la compagnie)
    const hD = hDq(), cD = lg * .16;
    const sD = new T3.Shape(); sD.moveTo(0, 0); sD.lineTo(cD, 0); sD.lineTo(cD * 1.25, hD); sD.lineTo(cD * .75, hD); sD.lineTo(0, 0);
    const gD = new T3.ExtrudeGeometry(sD, { depth:r * .14, bevelEnabled:false }); gD.translate(0, 0, -r * .07); gD.rotateY(Math.PI / 2); gD.computeVertexNormals();
    p.push({ g:gD, p:[0, r * .55, -lg / 2 + lg * .05 + cD], c:livree === 'or' ? 0xD4AF37 : c1 });
    p.push({ f:'boite', d:[r * .17, hD * .2, cD * .55], p:[0, r * .55 + hD * .55, -lg / 2 + lg * .05 + cD * .35], c:c2 });
    // le train d'atterrissage
    const wr = A.taille === 'S' ? .5 : A.taille === 'M' ? .6 : .75, nbRang = A.taille === 'L' || A.taille === 'XL' ? 3 : 1;
    const roue = (x, y, z, w) => { p.push({ f:'cyl', d:[wr, wr, w, 12], p:[x, y, z], r:[0, 0, Math.PI / 2], c:0x1E2430 }, { f:'cyl', d:[wr * .55, wr * .55, w + .08, 10], p:[x, y, z], r:[0, 0, Math.PI / 2], c:0xB9BEC6, nc:true }); };
    p.push({ f:'cyl', d:[.2, .2, r * 1.3, 6], p:[0, -r * .7, lg * .36], c:0x8C949F, nc:true });                         // la jambe avant et ses deux roues
    for(const sd of [-1, 1]) roue(sd * .42, -r * 1.35, lg * .36, .36);
    for(const sd of [1, -1]){
      p.push({ f:'cyl', d:[.26, .26, r * 1.1, 6], p:[sd * r * .7, -r * .75, zAile + corde * .4], c:0x8C949F, nc:true });                // les jambes principales
      p.push({ f:'boite', d:[.5, .22, corde * .5], p:[sd * r * .7, -r * .3, zAile + corde * .4], c:0x9AA3AE, nc:true });                // la trappe
      if(nbRang === 1) for(const dx of [-.3, .3]) roue(sd * r * .7 + dx, -r * 1.35, zAile + corde * .4, .3);                              // deux roues côte à côte
      else for(const k of [-1, 0, 1]) roue(sd * r * .7, -r * 1.35, zAile + corde * .4 + k * wr * 2.5, .55);                              // le bogie : trois essieux
    }
    const geo = fusion(p), geoC = fusion(p.filter(x => !x.nc), .09);
    // les hélices (elles tournent)
    let helices = null;
    if(A.moteurs === 'helices'){
      // une hélice centrée sur son moyeu (elle tourne sur elle-même), posée devant chaque moteur
      const hp = []; for(let b = 0; b < 6; b++) hp.push({ f:'boite', d:[.25, r * 1.5, .08], p:[0, 0, 0], r:[0, 0, b * Math.PI / 3], c:0x22262E });
      helices = { geo:fusion(hp), pos:[1, -1].map(s => [s * (r + (env / 2) * .22), yAile - r * .15, zAile + corde / 2 + corde * .55 + corde * .52]) };
    }
    const m = { geo, geoC, helices, r, lg, pieds:r * 1.35 + wr };        // pieds : la hauteur des roues sous l'axe du fuselage (l'avion se pose dessus)
    modeles.set(cle, m);
    return m;
  }
  function creerAvion(v, P){
    const liv = P.livrees[v.comp] ? P.livrees[v.comp].choisie : 'base';
    const md = modeleAvion(v.avion, v.comp, liv);
    const g = new T3.Group(), corps = new T3.Group();
    corps.add(new T3.Mesh(md.geo, MAT), new T3.Mesh(md.geoC, CONTOUR));
    const helices = creerHelices(md); if(helices) corps.add(helices);
    g.add(corps);
    // l'ombre (un disque sombre posé au sol)
    const ombre = new T3.Mesh(new T3.CircleGeometry(1, 20), new T3.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:.12, depthWrite:false }));
    ombre.rotation.x = -Math.PI / 2; ombre.scale.set(md.lg * .46, AV(v.avion).envergure * .22, 1);
    scene.add(ombre);
    scene.add(g);
    corps.position.y = md.pieds;
    g.userData.vol = v.id;
    return { obj:g, corps, ombre, helices, md, liv };
  }

  // les hélices : un groupe, une hélice par moteur, chacune tourne autour de son propre axe
  function creerHelices(md){
    if(!md.helices) return null;
    const g = new T3.Group();
    for(const p of md.helices.pos){ const h = new T3.Mesh(md.helices.geo, MAT); h.position.set(...p); g.add(h); }
    return g;
  }
  /* ---------- Les véhicules ---------- */
  const MODELES_V = {
    carburant:() => [{ f:'boite', d:[2.4, 2.2, 2.2], p:[0, 1.5, 3.4], c:0xF4F4F0 }, { f:'cyl', d:[1.25, 1.25, 5.2, 12], p:[0, 1.9, -.6], r:[Math.PI / 2, 0, 0], c:0xF2C230 }, { f:'boite', d:[2.4, .5, 7.6], p:[0, .55, .4], c:0x3A3F47 }],
    repas:() => [{ f:'boite', d:[2.4, 2.1, 2], p:[0, 1.4, 3.2], c:0xF4F4F0 }, { f:'boite', d:[2.6, 2.8, 4.6], p:[0, 3.1, -.6], c:0x4F7CAC }, { f:'boite', d:[2.4, .5, 7.2], p:[0, .55, .4], c:0x3A3F47 }],
    bagages:() => [{ f:'boite', d:[1.7, 1.4, 2.4], p:[0, 1, 2.6], c:0xF2C230 }, { f:'boite', d:[1.9, .8, 2.6], p:[0, .8, -.3], c:0x8C949F }, { f:'boite', d:[1.5, .8, 2], p:[0, 1.6, -.3], c:0xD7263D }, { f:'boite', d:[1.9, .8, 2.6], p:[0, .8, -3.3], c:0x8C949F }, { f:'boite', d:[1.5, .8, 2], p:[0, 1.6, -3.3], c:0x1B98E0 }],
    nettoyage:() => [{ f:'boite', d:[2.1, 2.2, 4.8], p:[0, 1.4, 0], c:0x5FA35A }, { f:'boite', d:[1.9, .9, 1.2], p:[0, 1.9, 2.1], c:0x2A3442 }],
    tech:() => [{ f:'boite', d:[2.1, 2, 4.4], p:[0, 1.3, 0], c:0xF18F01 }, { f:'boite', d:[1.9, .8, 1.1], p:[0, 1.8, 1.9], c:0x2A3442 }, { f:'boite', d:[.3, .3, .3], p:[0, 2.5, .8], c:0x1B98E0 }],
    bus:() => [{ f:'boite', d:[2.7, 3.1, 12], p:[0, 1.9, 0], c:0xF4F4F0 }, { f:'boite', d:[2.75, 1, 11.4], p:[0, 2.4, 0], c:0x2A3442 }, { f:'boite', d:[2.8, .5, 12.1], p:[0, .8, 0], c:0x1B5FAE }],
    degivrage:() => [{ f:'boite', d:[2.5, 2.4, 2.4], p:[0, 1.6, 3.4], c:0xE85D2F }, { f:'boite', d:[2.5, 2, 4.6], p:[0, 1.6, -.6], c:0xF4F4F0 }, { f:'boite', d:[.5, .5, 7], p:[0, 4.5, -1], r:[-.6, 0, 0], c:0xE85D2F }, { f:'boite', d:[1.4, 1.2, 1.2], p:[0, 6.8, 2.2], c:0xE85D2F }],
  };
  // positions des roues (z, x, rayon) et petits détails de chaque véhicule : vitres, gyrophares, rampes, bandes de couleur
  const ROUES_V = { carburant:[[3.4, -2.4], 1.15, .55], repas:[[3.2, -2.2], 1.15, .55], bagages:[[2.6, -.9, -3.9], 1, .45], nettoyage:[[1.8, -1.8], 1.05, .5], tech:[[1.6, -1.6], 1.05, .5], bus:[[3.9, -3.7], 1.3, .6], degivrage:[[3.4, -2.2], 1.15, .55] };
  const VITRE = 0x27323F, FEU = 0xFF9F1C, BLANC = 0xF4F4F0;
  const DETAILS_V = {
    carburant:() => [{ f:'boite', d:[2.2, .9, .12], p:[0, 2, 4.52], c:VITRE }, { f:'boite', d:[.4, .3, .4], p:[0, 2.75, 3.4], c:FEU }, { f:'cyl', d:[1.29, 1.29, .35, 12], p:[0, 1.9, -2.4], r:[Math.PI / 2, 0, 0], c:0xD7263D }, { f:'cyl', d:[1.29, 1.29, .35, 12], p:[0, 1.9, 1.2], r:[Math.PI / 2, 0, 0], c:0xD7263D }, { f:'boite', d:[1.2, .3, 2.2], p:[0, 3.2, -.6], c:0x8C949F }, { f:'boite', d:[.5, .9, .5], p:[0, 3.55, -2.4], c:0x8C949F }],
    repas:() => [{ f:'boite', d:[2.2, .9, .12], p:[0, 1.9, 4.22], c:VITRE }, { f:'boite', d:[.4, .3, .4], p:[0, 2.8, 3.2], c:FEU }, { f:'boite', d:[.1, 1.8, 1.4], p:[1.32, 3.2, -.4], c:0xDDE2E8 }, { f:'boite', d:[.1, 1.8, 1.4], p:[-1.32, 3.2, -.4], c:0xDDE2E8 }, { f:'boite', d:[2.7, .25, 4.7], p:[0, 4.6, -.6], c:0x3C6491 }, { f:'boite', d:[.12, .8, 4.4], p:[1.32, 5.1, -.6], c:0x3C6491 }, { f:'boite', d:[.12, .8, 4.4], p:[-1.32, 5.1, -.6], c:0x3C6491 }],
    bagages:() => [{ f:'boite', d:[1.5, .8, .12], p:[0, 1.7, 3.8], c:VITRE }, { f:'boite', d:[1.7, .12, 1.8], p:[0, 2.55, 2.4], c:0xF2C230 }, { f:'cyl', d:[.07, .07, 1.5, 5], p:[-.8, 1.8, 3.2], c:0x8C949F }, { f:'cyl', d:[.07, .07, 1.5, 5], p:[.8, 1.8, 3.2], c:0x8C949F }, { f:'boite', d:[.3, .25, .3], p:[0, 2.75, 2.4], c:FEU }, { f:'boite', d:[.1, .6, 2.6], p:[.95, 1.35, -.3], c:0x6B7480 }, { f:'boite', d:[.1, .6, 2.6], p:[-.95, 1.35, -.3], c:0x6B7480 }, { f:'boite', d:[.1, .6, 2.6], p:[.95, 1.35, -3.3], c:0x6B7480 }, { f:'boite', d:[.1, .6, 2.6], p:[-.95, 1.35, -3.3], c:0x6B7480 }, { f:'boite', d:[.2, .2, 1.4], p:[0, .6, -1.8], c:0x6B7480 }],
    nettoyage:() => [{ f:'boite', d:[1.9, .8, .12], p:[0, 1.95, 2.72], c:VITRE }, { f:'boite', d:[.4, .3, .4], p:[0, 2.65, 1.2], c:FEU }, { f:'boite', d:[2.15, .3, 1.2], p:[0, 1.05, -1.2], c:0x3E7A3A }, { f:'boite', d:[1.9, .12, 3], p:[0, 2.55, -.6], c:0x4C8C47 }],
    tech:() => [{ f:'boite', d:[1.9, .8, .12], p:[0, 1.85, 2.2], c:VITRE }, { f:'boite', d:[1.6, .25, .3], p:[0, 2.5, 1.2], c:0x1B98E0 }, { f:'boite', d:[1.7, .6, 1.4], p:[0, 2.5, -1.2], c:0x6B7480 }, { f:'boite', d:[2.15, .25, 4.5], p:[0, .9, 0], c:BLANC }],
    bus:() => [{ f:'boite', d:[2.4, .9, .12], p:[0, 2.4, 6.05], c:VITRE }, { f:'boite', d:[1.8, .4, .12], p:[0, 3.3, 6.05], c:FEU }, { f:'boite', d:[.1, 2.2, 1.6], p:[1.4, 1.9, 3.2], c:0x9AB6D8 }, { f:'boite', d:[.1, 2.2, 1.6], p:[1.4, 1.9, -1.2], c:0x9AB6D8 }, { f:'boite', d:[2.6, .12, 11.6], p:[0, 3.5, 0], c:0xDDE2E8 }, { f:'boite', d:[.4, .3, .4], p:[0, 3.7, 0], c:FEU }],
    degivrage:() => [{ f:'boite', d:[2.3, .9, .12], p:[0, 2.1, 4.62], c:VITRE }, { f:'boite', d:[.4, .3, .4], p:[0, 3, 3.4], c:FEU }, { f:'boite', d:[1.5, .12, 1.5], p:[0, 7.45, 2.2], c:0xE85D2F }, { f:'boite', d:[.1, .9, 1.5], p:[.7, 7.9, 2.2], c:0xE85D2F }, { f:'boite', d:[.1, .9, 1.5], p:[-.7, 7.9, 2.2], c:0xE85D2F }, { f:'cyl', d:[.2, .2, 1.8, 8], p:[0, 6.6, -2.2], c:0x6B7480 }],
  };
  const geoVeh = {};
  function creerVehicule(u){
    if(!geoVeh[u.type]){
      const pc = MODELES_V[u.type](), nc = [], det = DETAILS_V[u.type] ? DETAILS_V[u.type]() : [];
      // les roues : quatre pneus avec leur moyeu (aux positions propres à chaque véhicule)
      const [zs, xl, rr] = ROUES_V[u.type] || [[2, -1.6], 1.15, .5];
      for(const z of zs) for(const sd of [-1, 1]) nc.push({ f:'cyl', d:[rr, rr, .5, 12], p:[sd * xl, rr, z], r:[0, 0, Math.PI / 2], c:0x1E2430 }, { f:'cyl', d:[rr * .55, rr * .55, .56, 10], p:[sd * xl, rr, z], r:[0, 0, Math.PI / 2], c:0xC9CED6 });
      const tout = pc.concat(nc, det);
      geoVeh[u.type] = { g:fusion(tout), c:fusion(pc, .07) };
    }
    const g = new T3.Group(); g.add(new T3.Mesh(geoVeh[u.type].g, MAT), new T3.Mesh(geoVeh[u.type].c, CONTOUR));
    scene.add(g); return { obj:g };
  }
  // où se met chaque véhicule autour de l'avion (côté droit de l'avion, vu de la piste ; l'avion a le nez vers l'aérogare)
  const PLACE_TACHE = { carburant:[.95, .05], repas:[.8, -.25], bagages:[.6, .3], nettoyage:[.7, -.12], tech:[.35, .1], bus:[1.2, -.18], degivrage:[1.1, .42] };

  /* ---------- La cuve à carburant (une cuve de plus par niveau, une jauge) et les camions-citernes ---------- */
  function majCuve(A, Pl){
    const C = A.carbu; if(!C) return;
    const n = C.niv + 1, x0 = Pl.carburant.x, z0 = Pl.carburant.z + 40;
    if(cleCuve !== A.id + n){
      cleCuve = A.id + n;
      if(cuveG){ monde.remove(cuveG); cuveG.traverse(o => { if(o.geometry) o.geometry.dispose(); }); }
      const p = [{ f:'boite', d:[n * 17 + 12, .3, 30], p:[(n - 1) * 8.5, .15, 2], c:0xA9B0B8 }];
      for(let k = 0; k < n; k++) p.push({ f:'cyl', d:[7, 7, 9, 16], p:[k * 17, 4.5, 0], c:0xF2F2EE }, { f:'cyl', d:[7.2, 7.2, .8, 16], p:[k * 17, 9.2, 0], c:0xC9CED6 }, { f:'boite', d:[14.5, .4, .4], p:[k * 17, 4.6, 7.1], c:0xF2C230 });
      p.push({ f:'boite', d:[n * 17, .8, .8], p:[(n - 1) * 8.5, .6, 9], c:0x8C949F });                // le tuyau
      p.push({ f:'boite', d:[720, .12, 9], p:[350, .06, 19], c:0x5A5F67 });                       // la route des camions-citernes
      p.push({ f:'boite', d:[3.2, 12.4, 1], p:[-9, 6.2, 6], c:0x3A3F47 });                          // le support de la jauge
      cuveG = objet(p, .2); cuveG.position.set(x0, 0, z0); monde.add(cuveG);
      jaugeCuve = new T3.Mesh(new T3.BoxGeometry(2.2, 11.6, .4), new T3.MeshBasicMaterial({ color:0xFB8500 })); jaugeCuve.geometry.translate(0, 5.8, 0);
      jaugeCuve.position.set(-9, .4, 6.6); cuveG.add(jaugeCuve);
    }
    const pc = clamp(C.stock / M.capCuve(C), .001, 1);
    jaugeCuve.scale.y = pc; jaugeCuve.material.color.setHex(pc < .15 ? 0xE5383B : 0xFB8500);
    // les camions-citernes qui arrivent dans les 25 dernières minutes avant leur livraison
    const proches = C.commandes.filter(c => c.t - A.t < 25).slice(0, 4);
    while(citernes.length < proches.length){
      const pc2 = [{ f:'boite', d:[2.4, 2.4, 2.4], p:[0, 1.6, 7.2], c:0xD7263D }, { f:'boite', d:[2.2, .9, 1.2], p:[0, 2.2, 8.2], c:0x2A3442 }, { f:'cyl', d:[1.35, 1.35, 10, 14], p:[0, 2.1, .6], r:[Math.PI / 2, 0, 0], c:0xE9ECEF },
        { f:'boite', d:[2.5, .5, 15], p:[0, .65, 2.6], c:0x3A3F47 }, { f:'boite', d:[2.8, .5, .2], p:[0, 2.1, 5.7], c:0xF2C230 }];
      for(const zz of [7.4, 1.5, -2.5]) pc2.push({ f:'cyl', d:[.5, .5, 2.7, 8], p:[0, .5, zz], r:[0, 0, Math.PI / 2], c:0x1E2430 });
      const o = objet(pc2, .08); scene.add(o); citernes.push(o);
    }
    citernes.forEach((o, i) => {
      const c = proches[i]; o.visible = !!c && monde.visible !== false; if(!c) return;
      const u = clamp(1 - (c.t - A.t) / 25, 0, 1), xa = x0 + 700, xb = x0 + (C.niv) * 8.5 + i * 0;
      o.position.set(lerp(xa, xb, u), 0, z0 + 19 + i * 0); o.rotation.y = -Math.PI / 2;
    });
  }

  /* ---------- Chaque image ---------- */
  function maj(A, P, dtReel){
    if(!ok) return;
    construire(A);
    const Pl = M.plan(A), t = A.t, mn = M.minuteDe(t);
    lumiere(mn, A.meteo);
    majCuve(A, Pl);
    if(neige){ neige.visible = A.meteo === 'neige'; if(neige.visible){ const a = neige.geometry.attributes.position.array; for(let i = 1; i < a.length; i += 3){ a[i] -= dtReel * 22; if(a[i] < 0) a[i] += 300; } neige.geometry.attributes.position.needsUpdate = true; } }
    // les avions
    const vus = new Set();
    for(const v of A.vols){
      if(!M.VOLS_VISIBLES.includes(v.etat)) continue;
      const pos = positionAvion(A, Pl, v, t); if(!pos) continue;
      vus.add(v.id);
      let a = avions.get(v.id);
      const liv = P.livrees[v.comp] ? P.livrees[v.comp].choisie : 'base';
      if(a && a.liv !== liv){ scene.remove(a.obj); scene.remove(a.ombre); avions.delete(v.id); a = null; }
      if(!a){ a = creerAvion(v, P); avions.set(v.id, a); }
      a.obj.position.set(pos.x, pos.y, pos.z); a.obj.rotation.set(0, Math.PI / 2 - pos.cap, 0);
      a.corps.rotation.x = -(pos.tangage || 0);
      a.ombre.position.set(pos.x, .15, pos.z); a.ombre.rotation.z = -pos.cap; a.ombre.material.opacity = .12 * clamp(1 - pos.y / 120, 0, 1);
      if(a.helices){ a.helices.visible = true; }
      a.obj.userData.etat = v.etat;
    }
    for(const [id, a] of avions) if(!vus.has(id)){ scene.remove(a.obj); scene.remove(a.ombre); avions.delete(id); }
    // les passerelles : elles s'avancent vers la porte de l'avion
    for(const pa of passerelles){
      const v = A.vols.find(x => x.porte === pa.porte && (x.etat === 'escale'));
      const cible = v ? 1 : 0; pa.sorti += (cible - pa.sorti) * Math.min(1, dtReel * 1.5);
      const p = Pl.postes[pa.porte], porteX = p.cx + (v ? RAYON[v.avion] + .6 : 4), porteZ = p.nezZ - (v ? 5.5 : 4);
      const fx = lerp(pa.x0 - 2, porteX + 1.6, pa.sorti), fz = lerp(pa.z0 - 4, porteZ, pa.sorti);
      const dx = fx - pa.x0, dz = fz - pa.z0, lg = Math.max(2, Math.hypot(dx, dz));
      pa.couloir.position.set(pa.x0, 5.2, pa.z0); pa.couloir.rotation.y = Math.atan2(dx, dz); pa.couloir.scale.z = lg;
      pa.pied.position.set(pa.x0 + dx * .8, 5.2, pa.z0 + dz * .8);
    }
    // les véhicules
    for(const u of A.unites){
      let o = vehicules.get(u.id); if(!o){ o = creerVehicule(u); vehicules.set(u.id, o); }
      const pos = positionVehicule(A, Pl, u, t);
      o.obj.position.set(pos.x, 0, pos.z); o.obj.rotation.y = Math.PI / 2 - pos.cap;
    }
    for(const [id, o] of vehicules) if(!A.unites.some(u => u.id === id)){ scene.remove(o.obj); vehicules.delete(id); }
    for(const [, a] of avions) if(a.helices) for(const h of a.helices.children) h.rotation.z += dtReel * 30;
    majInterieur(A, Pl, dtReel);
    camera(A, Pl, dtReel);
  }
  // la position d'un avion selon sa phase
  function positionAvion(A, Pl, v, t){
    const tr = M.trajetDe(Pl, v), pz = tr.z, u = v.duree > 0 ? clamp((t - v.t0) / v.duree, 0, 1) : 1;
    // au poste, le nez touche la ligne d'arrêt quelle que soit la longueur de l'avion
    const g = A.portes[v.porte], dNez = ({ S:36, M:45, L:67, XL:74 })[g.taille] / 2 - M.AVIONS[v.avion].longueur / 2;
    const sur = (trj, s) => M.surTrajet(trj, s);
    switch(v.etat){
      case 'approche': {
        // la descente vers la piste (pente d'environ 4°), d'autant plus loin qu'il reste du temps
        const reste = Math.max(0, v.t0 + v.duree - t), d = reste * 420, x = tr.toucher - d;
        return { x, y:d * .07, z:pz, cap:0, tangage:.05 };
      }
      case 'atterrissage': { const s = tr.arr.roule * (1 - (1 - u) * (1 - u)); return { ...sur(tr.arr, s), y:0 }; }
      case 'roulageArr': {
        const s = tr.arr.roule + (tr.arr.total - tr.arr.roule) * lisse(u), p = sur(tr.arr, s), k = clamp(1 - (tr.arr.total - s) / 30, 0, 1);
        return { x:p.x, z:p.z + dNez * k, y:0, cap:p.cap };
      }
      case 'attentePoste': return { ...sur(tr.arr, tr.arr.roule + 70), y:0 };
      case 'escale': { const p = sur(tr.arr, tr.arr.total); return { x:p.x, z:p.z + dNez, y:0, cap:Math.PI / 2 }; }
      case 'repousse': { const s = tr.pousse.total * lisse(u), p = sur(tr.pousse, s); return { x:p.x, z:p.z + dNez * clamp(1 - s / 25, 0, 1), y:0, cap:p.cap + Math.PI }; }
      case 'roulageDep': return { ...sur(tr.dep, (tr.dep.total - 35) * lisse(u)), y:0 };
      case 'attentePiste': return { ...sur(tr.dep, tr.dep.total - 35), y:0 };
      case 'decollage': case 'parti': {
        // l'alignement, puis la course au décollage qui accélère, la rotation et la montée
        const p0 = sur(tr.dep, tr.dep.total), tau = v.etat === 'parti' ? 1.8 + (t - v.t0) : (t - v.t0);
        if(tau < .15){ const p = sur(tr.dep, tr.dep.total - 35 + 35 * tau / .15); return { ...p, y:0 }; }
        const tt = tau - .15, roule = Math.min(tt, .85), dist = 560 * roule * roule + (tt > .85 ? (tt - .85) * 960 : 0), y = tt > .85 ? Math.pow(tt - .85, 1.25) * 240 : 0;
        return { x:p0.x + dist, y, z:pz, cap:0, tangage:tt > .85 ? Math.min(.2, (tt - .85) * .45) : 0 };
      }
    }
    return null;
  }
  const lisse = u => u * u * (3 - 2 * u);
  function positionVehicule(A, Pl, u, t){
    const P = Pl.depot, k = u.n, type = Object.keys(MODELES_V).indexOf(u.type);
    const parc = { x:P.x - 22 + (k % 4) * 6 + (type % 2) * 26, z:P.z - 8 - type * 9 - Math.floor(k / 4) * 5, cap:Math.PI / 2 };
    if(u.etat === 'libre') return parc;
    const v = A.vols.find(x => x.id === u.vol); if(!v) return parc;
    const tr = Pl.service[v.porte], p = Pl.postes[v.porte], AVx = M.AVIONS[v.avion], [fx, fz] = PLACE_TACHE[u.type] || [1, 0];
    const cible = { x:p.cx + RAYON[v.avion] + 3.5 + fx * 7, z:p.nezZ - AVx.longueur * (.5 - fz), cap:Math.PI / 2 };
    const pr = clamp((t - u.t0) / Math.max(.01, u.duree), 0, 1);
    if(u.etat === 'travail') return cible;
    const s = u.etat === 'aller' ? pr : 1 - pr, q = M.surTrajet(tr, tr.total * lisse(s));
    // le dernier bout : vers la place près de l'avion
    if(s > .92){ const w = (s - .92) / .08; return { x:lerp(q.x, cible.x, w), z:lerp(q.z, cible.z, w), cap:u.etat === 'aller' ? q.cap : q.cap + Math.PI }; }
    return { x:q.x, z:q.z, cap:u.etat === 'aller' ? q.cap : q.cap + Math.PI };
  }

  /* ---------- L'intérieur du terminal et ses passagers ---------- */
  // les cases du plan (A.terminal) posées dans l'aérogare : la case x = 0 à gauche vue des pistes, la ligne y = 0 côté ville
  // MARGE_Z : côté ville ; JETEE : la bande le long de la façade côté pistes, où sont les portes d'embarquement
  const MARGE_X = 7, MARGE_Z = 5, JETEE = 15, ECH_P = 1.5;          // les passagers et le mobilier sont un peu grossis pour être vus de loin
  // la grille du terminal : pw × pd le pas d'une case, cw × cd la place d'une construction (le reste fait les allées),
  // et les petites cases (un quart de case) pour les petits objets
  const ALLEE = 3.6;
  // le sol de chaque zone : Départs (rose), réserve (bleu), Arrivées (vert d'eau), commerces (crème)
  const COUL_SOL = { dep:[0xF3E0E0, 0xEBCFCF], res:[0xDCE7FA, 0xCBDAF5], arr:[0xD3EDE8, 0xC2E3DC], com:[0xF7EFD6, 0xEFE5C3] };
  const COUL_ZONE = { dep:0xE5383B, res:0x2F6FE0, arr:0x2A9D8F, com:0xFFB703 };
  // tourner de rot quarts de tour (vu de dessus, comme une rotation Y de Three.js) : un point (x, z), ou toutes les pièces d'un objet
  const tournerXZ = (x, z, rot) => { const t = (rot || 0) * Math.PI / 2, c = Math.round(Math.cos(t)), s = Math.round(Math.sin(t)); return { x:x * c + z * s, z:-x * s + z * c }; };
  function tournerPieces(pieces, rot){
    if(!rot) return pieces; const t = rot * Math.PI / 2;
    return pieces.map(q => { const p = q.p || [0, 0, 0], o = tournerXZ(p[0], p[2], rot), r = q.r || [0, 0, 0]; return { ...q, p:[o.x, p[1], o.z], r:[r[0], r[1] + t, r[2]] }; });
  }
  function grilleT(A, Pl){
    // les cases sont CARRÉES (le côté vient de l'aéroport : T.cel) ; une construction occupe les 6 × 6 petits carrés du centre (3/4 de la case), l'anneau d'un petit carré autour fait l'allée
    const T = Pl.terminal, l = A.terminal.l, h = A.terminal.h, pw = T.cel, pd = T.cel, N = M.PETIT_DIV;
    const la = A.terminal.la || 0, cr = A.terminal.cr || 0, cd0 = l - la - cr, ca0 = cd0 + cr;      // Départs [0, cd0), réserve [cd0, ca0), Arrivées [ca0, l) dans la rangée du hall ; les rangées 1 à 3 sont les commerces
    return { T, l, h, cd0, ca0, cr, pw, pd, N, cw:pw * (N - 2) / N, cd:pd * (N - 2) / N, zone:(x, y = 0) => y >= 1 ? 'com' : x < cd0 ? 'dep' : x < ca0 ? 'res' : 'arr', centre:(x, y) => ({ x:T.x1 - MARGE_X - (x + .5) * pw, z:T.z1 - MARGE_Z - (y + .5) * pd }),
      sub:(x, y) => ({ x:T.x1 - MARGE_X - (x + .5) * pw / N, z:T.z1 - MARGE_Z - (y + .5) * pd / N }), epetit:pw / N / 2.6 * 1.05 };
  }
  // les petits objets (autour de leur centre)
  function petitObjet(type, e){
    switch(type){
      case 'plante': return plante(0, 0, e * 1.1);
      case 'banc': return [{ f:'boite', d:[2.6 * e, .18 * e, .8 * e], p:[0, .5 * e, 0], c:0x8B5A3C }, { f:'boite', d:[2.6 * e, .6 * e, .14 * e], p:[0, .85 * e, -.36 * e], c:0x8B5A3C },
        { f:'boite', d:[.14 * e, .5 * e, .7 * e], p:[-1.1 * e, .25 * e, 0], c:0x3A3F47 }, { f:'boite', d:[.14 * e, .5 * e, .7 * e], p:[1.1 * e, .25 * e, 0], c:0x3A3F47 }];
      case 'poubelle': return poubelle(0, 0, e);
      case 'ecran': return ecran(0, 0, e);
      case 'distributeur': return [{ f:'boite', d:[1.2 * e, 2.2 * e, .9 * e], p:[0, 1.1 * e, 0], c:0xD7263D }, { f:'boite', d:[.8 * e, 1.3 * e, .05], p:[-.12 * e, 1.35 * e, .46 * e], c:0x8ECAE6 }, { f:'boite', d:[.2 * e, .5 * e, .06], p:[.42 * e, 1.3 * e, .46 * e], c:0x14233A }];
      case 'palmier': return [{ f:'cyl', d:[.5 * e, .4 * e, .6 * e, 8], p:[0, .3 * e, 0], c:0xB07D62 }, { f:'cyl', d:[.14 * e, .2 * e, 2 * e, 6], p:[0, 1.5 * e, 0], r:[.08, 0, 0], c:0x8B6B43 }, ...[0, 1, 2, 3, 4].map(k => ({ f:'boite', d:[1.5 * e, .06 * e, .3 * e], p:[Math.cos(k * 1.26) * .6 * e, 2.6 * e, Math.sin(k * 1.26) * .6 * e], r:[0, -k * 1.26, -.35], c:0x3E8E41 }))];
      case 'canape': return [{ f:'boite', d:[2.6 * e, .6 * e, 1 * e], p:[0, .4 * e, 0], c:0x3D405B }, { f:'boite', d:[2.6 * e, .8 * e, .3 * e], p:[0, .9 * e, -.4 * e], c:0x3D405B }, { f:'boite', d:[.3 * e, .6 * e, 1 * e], p:[-1.15 * e, .75 * e, 0], c:0x2F3150 }, { f:'boite', d:[.3 * e, .6 * e, 1 * e], p:[1.15 * e, .75 * e, 0], c:0x2F3150 }];
      case 'fauteuil': return [{ f:'boite', d:[1 * e, .5 * e, 1 * e], p:[0, .4 * e, 0], c:0xE07A5F }, { f:'boite', d:[1 * e, .8 * e, .25 * e], p:[0, .85 * e, -.4 * e], c:0xE07A5F }, { f:'cyl', d:[.08 * e, .08 * e, .3 * e, 6], p:[0, .15 * e, 0], c:0x3A3F47 }];
      case 'poubelletri': return [0, 1, 2].map(k => ({ f:'boite', d:[.5 * e, .9 * e, .6 * e], p:[(k - 1) * .6 * e, .45 * e, 0], c:[0x2BA84A, 0x1B98E0, 0xF2C230][k] }));
      case 'cafe_auto': return [{ f:'boite', d:[1.1 * e, 2 * e, .9 * e], p:[0, 1 * e, 0], c:0x5C3D2E }, { f:'boite', d:[.8 * e, .6 * e, .05], p:[0, 1.5 * e, .46 * e], c:0x14233A }, { f:'boite', d:[.3 * e, .3 * e, .2], p:[0, .7 * e, .5 * e], c:0xE9EDF2 }];
      case 'photomaton': return [{ f:'boite', d:[1.4 * e, 2.3 * e, 1.2 * e], p:[0, 1.15 * e, 0], c:0x3A6EA5 }, { f:'boite', d:[1 * e, 1.3 * e, .05], p:[0, 1.2 * e, .62 * e], c:0xBFD9EA }, { f:'boite', d:[1.4 * e, .3 * e, 1.3 * e], p:[0, 2.4 * e, 0], c:0xF2C230 }];
      case 'kiosque': return [{ f:'boite', d:[2.2 * e, 1.3 * e, 1.4 * e], p:[0, .65 * e, 0], c:0xE76F51 }, { f:'boite', d:[2.6 * e, .15 * e, 1.8 * e], p:[0, 2.3 * e, 0], c:0x3A3F47 }, { f:'boite', d:[.1, 1 * e, .1], p:[-1.2 * e, 1.8 * e, .8 * e], c:0x8C949F }, { f:'boite', d:[.1, 1 * e, .1], p:[1.2 * e, 1.8 * e, .8 * e], c:0x8C949F }];
      case 'info': return [{ f:'cyl', d:[.1 * e, .1 * e, 1.6 * e, 6], p:[0, .8 * e, 0], c:0x8C949F }, { f:'boite', d:[1 * e, .8 * e, .12 * e], p:[0, 1.8 * e, 0], r:[-.25, 0, 0], c:0x1B4E8C }, { f:'boite', d:[.8 * e, .5 * e, .05], p:[0, 1.8 * e, .08 * e], r:[-.25, 0, 0], c:0x8ECAE6 }];
      case 'chariots': return [0, 1, 2, 3].map(k => ({ f:'boite', d:[.8 * e, .6 * e, 1.1 * e], p:[0, .5 * e + k * .05, -.7 * e + k * .5 * e], c:0xB9BEC6 }));
      case 'sculpture': return [{ f:'boite', d:[1 * e, .7 * e, 1 * e], p:[0, .35 * e, 0], c:0x8C949F }, { f:'boule', d:[.55 * e, 1], p:[0, 1.2 * e, 0], c:0xD4AF37 }, { f:'boite', d:[.3 * e, 1.1 * e, .3 * e], p:[.1 * e, 1.9 * e, 0], r:[0, .5, .4], c:0xD4AF37 }];
      case 'lampadaire': return [{ f:'cyl', d:[.07 * e, .09 * e, 2.4 * e, 6], p:[0, 1.2 * e, 0], c:0x3A3F47 }, { f:'boule', d:[.35 * e, 1], p:[0, 2.55 * e, 0], c:0xFFE9A8 }];
      case 'horlogep': return [{ f:'cyl', d:[.1 * e, .1 * e, 2.2 * e, 6], p:[0, 1.1 * e, 0], c:0x3A3F47 }, { f:'cyl', d:[.6 * e, .6 * e, .12 * e, 16], p:[0, 2.4 * e, 0], r:[Math.PI / 2, 0, 0], c:0xFFFFFF }, { f:'boite', d:[.05, .45 * e, .05], p:[0, 2.5 * e, .08 * e], c:0x1B1B1B }];
      case 'jeuxenfants': return [{ f:'cyl', d:[.9 * e, .9 * e, .12 * e, 14], p:[0, .08 * e, 0], c:0xF2C230 }, { f:'cyl', d:[.1 * e, .1 * e, 1.7 * e, 6], p:[0, .9 * e, 0], c:0xE5383B }, ...[0, 1, 2].map(k => ({ f:'boite', d:[.45 * e, .45 * e, .6 * e], p:[Math.cos(k * 2.1) * .6 * e, .65 * e, Math.sin(k * 2.1) * .6 * e], c:[0x1B98E0, 0x2BA84A, 0xE5383B][k] }))];
      case 'borne': return [{ f:'cyl', d:[.25 * e, .3 * e, 1.3 * e, 8], p:[0, .65 * e, 0], c:0xE9EDF2 }, { f:'boite', d:[.6 * e, .45 * e, .2 * e], p:[0, 1.45 * e, 0], c:0x14233A }, { f:'boite', d:[.45 * e, .25 * e, .05], p:[0, 1.47 * e, .11 * e], c:0x51CF66 }];
      case 'eau': return [{ f:'boite', d:[.8 * e, 1.1 * e, .6 * e], p:[0, .55 * e, 0], c:0xF4F4F0 }, { f:'boite', d:[.7 * e, .12 * e, .5 * e], p:[0, 1.16 * e, 0], c:0x8C949F }, { f:'cyl', d:[.08 * e, .08 * e, .3 * e, 6], p:[0, 1.35 * e, -.1 * e], c:0x1B98E0 }];
    }
    return [];
  }
  const clair = c => new T3.Color(c).lerp(new T3.Color(0xFFFFFF), .55).getHex();
  // la file d'attente devant les comptoirs et les portiques : des rangées en serpentin (5 personnes par rangée)
  const FILE_PAS_X = 1.8, FILE_PAS_Z = 1.95, FILE_RANGEES = 4;
  const baseFile = (type, cd) => -cd * (type === 'comptoir' ? .3 : .2) + 2 * ECH_P;
  const posFile = (type, cd, rangee, k) => ({ x:(rangee % 2 ? -1 : 1) * (k - 2) * FILE_PAS_X, z:baseFile(type, cd) + rangee * FILE_PAS_Z });
  // les petits éléments qui reviennent partout
  const PEAU = 0xE0AC69;
  const agent = (x, z, c, e) => [{ f:'cyl', d:[.14 * e, .13 * e, .75 * e, 6], p:[x - .15 * e, .38 * e, z], c:0x2A3442 }, { f:'cyl', d:[.14 * e, .13 * e, .75 * e, 6], p:[x + .15 * e, .38 * e, z], c:0x2A3442 },
    { f:'cyl', d:[.3 * e, .37 * e, .85 * e, 8], p:[x, 1.2 * e, z], c }, { f:'cyl', d:[.1 * e, .09 * e, .75 * e, 5], p:[x - .43 * e, 1.15 * e, z], c }, { f:'cyl', d:[.1 * e, .09 * e, .75 * e, 5], p:[x + .43 * e, 1.15 * e, z], c },
    { f:'boule', d:[.25 * e, 1], p:[x, 1.88 * e, z], c:PEAU }, { f:'cyl', d:[.28 * e, .3 * e, .12 * e, 8], p:[x, 2.07 * e, z], c }, { f:'boite', d:[.3 * e, .05 * e, .22 * e], p:[x, 2.0 * e, z + .22 * e], c }];
  const poteau = (x, z, e) => [{ f:'cyl', d:[.09 * e, .09 * e, 1 * e, 6], p:[x, .5 * e, z], c:0xB9BEC6 }, { f:'cyl', d:[.25 * e, .25 * e, .08, 8], p:[x, .04, z], c:0x5C6672 }];
  const sangle = (x1, x2, z, e, c = 0x1B4E8C) => ({ f:'boite', d:[Math.abs(x2 - x1), .16 * e, .05], p:[(x1 + x2) / 2, .85 * e, z], c });
  const poubelle = (x, z, e) => [{ f:'cyl', d:[.35 * e, .3 * e, .9 * e, 8], p:[x, .45 * e, z], c:0x5C6672 }, { f:'cyl', d:[.37 * e, .37 * e, .1 * e, 8], p:[x, .92 * e, z], c:0x2BA84A }];
  const ecran = (x, z, e, c = 0x14233A) => [{ f:'cyl', d:[.1 * e, .1 * e, 2.6 * e, 6], p:[x, 1.3 * e, z], c:0x8C949F }, { f:'boite', d:[2.2 * e, 1.2 * e, .15 * e], p:[x, 2.9 * e, z], c }, { f:'boite', d:[1.9 * e, .14 * e, .05], p:[x, 3.15 * e, z + .1 * e], c:0xFFB703 }, { f:'boite', d:[1.9 * e, .1 * e, .05], p:[x, 2.85 * e, z + .1 * e], c:0x8ECAE6 }, { f:'boite', d:[1.9 * e, .1 * e, .05], p:[x, 2.6 * e, z + .1 * e], c:0x8ECAE6 }];
  const plante = (x, z, e) => [{ f:'cyl', d:[.45 * e, .35 * e, .7 * e, 8], p:[x, .35 * e, z], c:0xB07D62 }, { f:'boule', d:[.75 * e, 1], p:[x, 1.25 * e, z], c:0x4E8F3E }];
  // des cloisons autour de la case, avec une ouverture au milieu de certains côtés (vers la ville +z, vers les pistes -z, sur les côtés x)
  function cloisons(w, d, h, c, ouv, larg = .4, vitre = null){
    const p = [], ep = .25;
    const cote = (cx, cz, long, axeX, ouvert) => {
      const seg = ouvert ? (long * (1 - larg)) / 2 : long;
      const parts = ouvert ? [-(long - seg) / 2, (long - seg) / 2] : [0];
      for(const o of parts){
        const x = axeX ? cx + o : cx, z = axeX ? cz : cz + o;
        p.push({ f:'boite', d:axeX ? [seg, h * .35, ep] : [ep, h * .35, seg], p:[x, h * .175, z], c });                           // le soubassement
        p.push({ f:'boite', d:axeX ? [seg, h * .65, ep * .4] : [ep * .4, h * .65, seg], p:[x, h * .675, z], c:vitre ?? c });       // la vitre (ou le mur)
        p.push({ f:'boite', d:axeX ? [seg, .15, ep * 1.2] : [ep * 1.2, .15, seg], p:[x, h, z], c:0x5C6672 });                   // le cadre en haut
      }
    };
    cote(0, d / 2, w, true, ouv.includes('+z')); cote(0, -d / 2, w, true, ouv.includes('-z'));
    cote(w / 2, 0, d, false, ouv.includes('+x')); cote(-w / 2, 0, d, false, ouv.includes('-x'));
    return p;
  }
  // l'enseigne au-dessus de l'entrée (une bande de couleur, un pictogramme en relief)
  const enseigne = (z, w, h, c, e) => [{ f:'boite', d:[w * .42, .9 * e, .35], p:[0, h + .5 * e, z], c }, { f:'boite', d:[w * .42 - .6, .25 * e, .38], p:[0, h + .5 * e, z], c:0xFFFFFF }];
  // le mobilier de chaque construction (autour du centre de sa case, -z vers les pistes, +z vers la ville)
  function mobilier(type, niv, cw, cd){
    const p = [], e = ECH_P, w = cw * .86, d = cd * .86, n = Math.max(2, Math.floor(w / (4 * e))), H = 2.6 * e, coul = M.MODULES[type].coul;
    const files = (t, col) => {
      // les barrières à sangle qui dessinent le serpentin de la file
      const xMax = 2 * FILE_PAS_X + FILE_PAS_X * .6;
      for(let r = 0; r <= FILE_RANGEES; r++){
        const z = baseFile(t, cd) + (r - .5) * FILE_PAS_Z, gauche = r % 2 === 0;
        const x1 = r === 0 || r === FILE_RANGEES ? -xMax : gauche ? -xMax + FILE_PAS_X * 1.1 : -xMax, x2 = r === 0 || r === FILE_RANGEES ? xMax : gauche ? xMax : xMax - FILE_PAS_X * 1.1;
        if(r === 0) continue;
        p.push(...poteau(x1, z, e), ...poteau(x2, z, e), sangle(x1, x2, z, e, col));
      }
      p.push(...poteau(-xMax, baseFile(t, cd) - .5 * FILE_PAS_Z, e), ...poteau(xMax, baseFile(t, cd) - .5 * FILE_PAS_Z, e));
    };
    switch(type){
      case 'comptoir': {
        // les comptoirs, les agents derrière, le tapis des bagages, le mur aux couleurs, la file à sangles
        const zC = -cd * .3 + .3;
        for(let k = 0; k < n; k++){
          const x = -w / 2 + (k + .5) * w / n;
          p.push({ f:'boite', d:[w / n * .62, 1.1 * e, 1.1 * e], p:[x, .55 * e, zC], c:0xE9EDF2 }, { f:'boite', d:[w / n * .62, .15, 1.2 * e], p:[x, 1.12 * e, zC], c:0x4F7CAC });
          p.push({ f:'boite', d:[.7 * e, .5 * e, .05], p:[x - .4 * e, 1.5 * e, zC + .2 * e], r:[-.3, 0, 0], c:0x1E2A38 }, { f:'boite', d:[.9 * e, .3 * e, .9 * e], p:[x + w / n * .4, .15 * e, zC + .2 * e], c:0x5C6672 });
          p.push(...agent(x, zC - 1.2 * e, 0x1B4E8C, e));
          p.push({ f:'boite', d:[.6 * e, .9 * e, .12], p:[x, 3.1 * e, zC - .1], c:0x14233A }, { f:'boite', d:[.5 * e, .2 * e, .14], p:[x, 3.3 * e, zC - .1], c:0x51CF66 });
        }
        p.push({ f:'boite', d:[w, .5 * e, 1.1 * e], p:[0, .25 * e, zC - 2.3 * e], c:0x3A3F47 }, { f:'boite', d:[w, 3.4 * e, .3], p:[0, 1.7 * e, zC - 3 * e], c:0x2F5E8E }, { f:'boite', d:[w * .5, .6 * e, .32], p:[0, 3 * e, zC - 2.98 * e], c:0xFFB703 });
        files('comptoir', 0x1B4E8C);
        p.push(...ecran(w / 2 - 1.5 * e, d * .4, e), ...plante(-w / 2 + 1.2 * e, d * .4, e), ...poubelle(-w / 2 + 3 * e, d * .42, e));
        break;
      }
      case 'securite': {
        // les portiques, les tapis à rayons X et les bacs, les agents, la cloison vitrée côté pistes, la file
        const zS = -cd * .2;
        const voies = Math.min(3, niv + 1);
        for(let k = 0; k < voies; k++){
          const x = (k - (voies - 1) / 2) * Math.min(w / voies, 7 * e);
          p.push({ f:'boite', d:[.3, 2.4 * e, .4], p:[x - 1 * e, 1.2 * e, zS], c:0x7A5C99 }, { f:'boite', d:[.3, 2.4 * e, .4], p:[x + 1 * e, 1.2 * e, zS], c:0x7A5C99 }, { f:'boite', d:[2.3 * e, .4, .45], p:[x, 2.4 * e, zS], c:0x7A5C99 });
          p.push({ f:'boite', d:[1.3 * e, 1.2 * e, 1.6 * e], p:[x + 2.3 * e, .9 * e, zS], c:0xD9DEE4 }, { f:'boite', d:[.9 * e, .5 * e, 4.6 * e], p:[x + 2.3 * e, .45 * e, zS], c:0x3A3F47 });
          for(let b = 0; b < 3; b++) p.push({ f:'boite', d:[.8 * e, .15 * e, .6 * e], p:[x + 2.3 * e, .78 * e, zS + 1.5 * e - b * .9 * e], c:0x8C949F });
          p.push(...agent(x - 2 * e, zS - 1.2 * e, 0x2A2D43, e), ...agent(x + 3.6 * e, zS - .6 * e, 0x2A2D43, e));
        }
        p.push(...cloisons(w, d, H, 0xE6E8EC, ['+z', '-z'], .7, 0xBFD9EA));
        files('securite', 0x7A5C99);
        p.push({ f:'boite', d:[w * .4, .8 * e, .3], p:[0, H + .5 * e, d / 2], c:0x7A5C99 }, { f:'boite', d:[w * .4 - .6, .22 * e, .32], p:[0, H + .5 * e, d / 2], c:0xFFFFFF });
        break;
      }
      case 'passeports': {
        // des cabines vitrées de la police aux frontières, une cloison, la file à sangles
        const zS = -cd * .2, nb = Math.min(4, 1 + niv);
        for(let k = 0; k < nb; k++){
          const x = (k - (nb - 1) / 2) * Math.min(w / nb, 4.2 * e);
          p.push({ f:'boite', d:[2.4 * e, 1.2 * e, 2 * e], p:[x, .6 * e, zS - .4 * e], c:0x3D5A80 }, { f:'boite', d:[2.4 * e, 1.3 * e, .12], p:[x, 1.85 * e, zS + .6 * e], c:0xBFD9EA }, { f:'boite', d:[2.5 * e, .2 * e, 2.1 * e], p:[x, 2.6 * e, zS - .4 * e], c:0x2A3F5F });
          p.push({ f:'boite', d:[.8 * e, .3 * e, .12], p:[x, 2.85 * e, zS + .62 * e], c:0x51CF66 }, ...agent(x, zS - .9 * e, 0x14233A, e));
        }
        p.push(...cloisons(w, d, 2 * e, 0x98A8BC, ['+z', '-z'], .7));
        files('passeports', 0x3D5A80);
        p.push({ f:'boite', d:[w * .45, .8 * e, .3], p:[0, 2 * e + .5 * e, d / 2], c:0x3D5A80 }, { f:'boite', d:[w * .45 - .6, .22 * e, .32], p:[0, 2.5 * e, d / 2], c:0xFFFFFF });
        break;
      }
      case 'douane': {
        // deux couloirs : vert (rien à déclarer) et rouge (marchandises à déclarer), les tables de fouille et les douaniers
        const zD = -cd * .05;
        for(const [sx, c] of [[-1, 0x2BA84A], [1, 0xE5383B]]){
          const x = sx * w * .22;
          p.push({ f:'boite', d:[w * .36, .06, d * .8], p:[x, .05, 0], c:sx < 0 ? 0xB7E4C7 : 0xF8C4C4 });
          p.push({ f:'boite', d:[w * .3, .9 * e, .35], p:[x, 3.2 * e, -d * .38], c }, { f:'boite', d:[w * .26, .25 * e, .37], p:[x, 3.2 * e, -d * .38], c:0xFFFFFF });
          p.push({ f:'boite', d:[.1, 3 * e, .1], p:[x - w * .14, 1.5 * e, -d * .38], c:0x8C949F }, { f:'boite', d:[.1, 3 * e, .1], p:[x + w * .14, 1.5 * e, -d * .38], c:0x8C949F });
        }
        p.push({ f:'boite', d:[3 * e, 1 * e, 1.3 * e], p:[w * .22, .5 * e, zD], c:0xD9DEE4 }, { f:'boite', d:[1.2 * e, .6 * e, .9 * e], p:[w * .22, 1.3 * e, zD], c:0x1B98E0 }, ...agent(w * .22 + 2.2 * e, zD, 0x264653, e), ...agent(w * .22 - 2.2 * e, zD + 1 * e, 0x264653, e));
        p.push({ f:'boite', d:[.3, 1 * e, d * .7], p:[0, .5 * e, 0], c:0x5C6672 }, ...agent(-w * .22, zD + 1.5 * e, 0x264653, e));
        p.push(...poteau(-w / 2 + .5, -d / 2, e), ...poteau(w / 2 - .5, -d / 2, e));
        break;
      }
      case 'tapis': {
        const r0 = Math.min(w, d) * .3;
        p.push({ f:'cyl', d:[r0, r0, .9 * e, 28], p:[0, .45 * e, 0], c:0x3A3F47 }, { f:'cyl', d:[r0 * .68, r0 * .68, 1.15 * e, 24], p:[0, .58 * e, 0], c:0x9AA2AE }, { f:'cyl', d:[.3 * e, .3 * e, 3 * e, 8], p:[0, 1.5 * e, 0], c:0x8C949F });
        p.push({ f:'boite', d:[2.6 * e, 1.1 * e, .2 * e], p:[0, 3.4 * e, 0], c:0x14233A }, { f:'boite', d:[2.2 * e, .25 * e, .22 * e], p:[0, 3.6 * e, 0], c:0xFFB703 });
        for(let k = 0; k < 10; k++){ const a = k / 10 * Math.PI * 2, r = r0 * .84; p.push({ f:'boite', d:[1 * e, .6 * e, .7 * e], p:[Math.cos(a) * r, 1.1 * e, Math.sin(a) * r], r:[0, -a, 0], c:[0xD7263D, 0x1B98E0, 0xF2C230, 0x2BA84A, 0x14233A][k % 5] }); }
        // les chariots à bagages rangés
        for(let k = 0; k < 4; k++) p.push({ f:'boite', d:[.9 * e, .5 * e, 1.6 * e], p:[w / 2 - 1 * e, .5 * e, -d / 2 + 1.2 * e + k * .5 * e], c:0xB9BEC6 });
        p.push(...poubelle(-w / 2 + 1 * e, d / 2 - 1 * e, e));
        break;
      }
      case 'salle': {
        // des rangées de sièges dos à dos, un écran des départs, des poubelles, une moquette
        p.push({ f:'boite', d:[w * .95, .08, d * .9], p:[0, .04, 0], c:0x7D8CA3 });
        const rangs = Math.max(2, Math.min(4, Math.floor(d / (3.4 * e))));
        for(let r = 0; r < rangs; r++) for(let k = 0; k < n; k++){
          const x = -w / 2 + (k + .5) * w / n, z = -d * .32 + r * (d * .62 / Math.max(1, rangs - 1));
          for(const sens of [-1, 1]){ p.push({ f:'boite', d:[w / n * .84, .45 * e, .75 * e], p:[x, .45 * e, z + sens * .45 * e], c:0x2F6FB5 }, { f:'boite', d:[w / n * .84, .75 * e, .16 * e], p:[x, .95 * e, z], c:0x24558C }); }
          for(let a = 0; a < 4; a++) p.push({ f:'boite', d:[.12 * e, .55 * e, 1.7 * e], p:[x - w / n * .42 + a * w / n * .28, .55 * e, z], c:0x5C6672 });
        }
        p.push(...ecran(-w / 2 + 1.4 * e, -d / 2 + .8 * e, e), ...poubelle(w / 2 - .9 * e, -d / 2 + .9 * e, e), ...poubelle(w / 2 - .9 * e, d / 2 - .9 * e, e));
        break;
      }
      case 'boutique': {
        // une vitrine avec son entrée, l'enseigne, les étagères et la caisse
        p.push(...cloisons(w, d, H, 0xE07A5F, ['+z'], .35, 0xBFD9EA), ...enseigne(d / 2, w, H, coul, e));
        for(let r = 0; r < 2; r++){ const z = -d * .25 + r * d * .28; p.push({ f:'boite', d:[w * .55, 1.8 * e, .8 * e], p:[-w * .1, .9 * e, z], c:0xF4F1DE }); for(let k = 0; k < 6; k++) p.push({ f:'boite', d:[.6 * e, .45 * e, .5 * e], p:[-w * .1 - w * .22 + k * w * .09, 1.95 * e, z], c:[0xF2C230, 0x1B98E0, 0x2BA84A, 0xD7263D][k % 4] }); }
        p.push({ f:'boite', d:[.8 * e, 2.4 * e, d * .75], p:[-w / 2 + .7 * e, 1.2 * e, -d * .05], c:0xF4F1DE });
        p.push({ f:'boite', d:[2.4 * e, 1.1 * e, 1 * e], p:[w * .3, .55 * e, d * .2], c:0x6B4A2F }, { f:'boite', d:[.5 * e, .4 * e, .4 * e], p:[w * .3, 1.3 * e, d * .2], c:0x1E2A38 }, ...agent(w * .3, d * .2 - 1.1 * e, coul, e));
        p.push(...plante(w * .42, d / 2 + .9 * e, e), ...plante(-w * .42, d / 2 + .9 * e, e));
        break;
      }
      case 'cafe': case 'restaurant': {
        // un muret bas avec des jardinières, le comptoir et sa machine, les tables, les chaises, le menu
        const resto = type === 'restaurant';
        p.push({ f:'boite', d:[w * .95, .08, d * .9], p:[0, .04, 0], c:resto ? 0xC9A27E : 0xA9785A });
        p.push(...cloisons(w, d, 1.3 * e, resto ? 0x8B5A3C : 0x6B4A2F, ['+z', '-x'], .35));
        for(let k = 0; k < 4; k++) p.push({ f:'boule', d:[.45 * e, 0], p:[-w / 2 + .3 + k * w / 4 + w / 8, 1.5 * e, -d / 2], c:0x4E8F3E });
        p.push({ f:'boite', d:[w * .55, 1.15 * e, 1 * e], p:[w * .1, .58 * e, -d * .36], c:resto ? 0xB5835A : 0x8B5A3C }, { f:'boite', d:[w * .55, .12, 1.15 * e], p:[w * .1, 1.18 * e, -d * .36], c:0xF4F1DE });
        p.push({ f:'boite', d:[.8 * e, .9 * e, .6 * e], p:[w * .25, 1.65 * e, -d * .38], c:0x3A3F47 }, ...agent(w * .05, -d * .36 - 1.1 * e, 0xF4F1DE, e));
        p.push({ f:'boite', d:[w * .4, 1.2 * e, .15], p:[w * .1, 3 * e, -d / 2 + .1], c:0x14233A }, { f:'boite', d:[w * .36, .2 * e, .17], p:[w * .1, 3.3 * e, -d / 2 + .1], c:coul });
        const nb = resto ? 6 : 5;
        for(let k = 0; k < nb; k++){
          const x = -w * .3 + (k % 3) * w * .3, z = -d * .02 + Math.floor(k / 3) * d * .3;
          p.push({ f:'cyl', d:[.85 * e, .85 * e, .1, 14], p:[x, 1 * e, z], c:resto ? 0xFFFFFF : 0xF4F1DE }, { f:'cyl', d:[.1, .1, 1 * e, 6], p:[x, .5 * e, z], c:0x3A3F47 });
          for(const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]].slice(0, resto ? 4 : 2)) p.push({ f:'boite', d:[.55 * e, .55 * e, .55 * e], p:[x + dx * 1.15 * e, .3 * e, z + dz * 1.15 * e], c:resto ? 0x8B2E2E : 0x2A6F4D });
        }
        break;
      }
      case 'toilettes': {
        p.push(...cloisons(w * .8, d * .7, 3 * e, 0x9DB4C0, [], .3));
        p.push({ f:'boite', d:[w * .8, .15, d * .7], p:[0, 3 * e, 0], c:0x8C949F });
        p.push({ f:'boite', d:[1.1 * e, 2.2 * e, .1], p:[-w * .18, 1.1 * e, d * .35 + .1], c:0x1B6EC2 }, { f:'boite', d:[1.1 * e, 2.2 * e, .1], p:[w * .18, 1.1 * e, d * .35 + .1], c:0xE5383B });
        p.push({ f:'boite', d:[.8 * e, .8 * e, .12], p:[-w * .18, 2.8 * e, d * .35 + .15], c:0xFFFFFF }, { f:'boite', d:[.8 * e, .8 * e, .12], p:[w * .18, 2.8 * e, d * .35 + .15], c:0xFFFFFF });
        p.push({ f:'boite', d:[1.4 * e, .8 * e, .15], p:[0, 3.6 * e, d * .35 + .1], c:0x1B4E8C });
        break;
      }
      case 'jeux': {
        // un tapis mou, une barrière colorée, des cubes, un toboggan, une balle géante
        p.push({ f:'boite', d:[w * .85, .14, d * .8], p:[0, .07, 0], c:0x8ECAE6 });
        p.push(...cloisons(w * .85, d * .8, 1 * e, 0xF2CC8F, ['+z'], .3));
        p.push({ f:'boite', d:[1.6 * e, 1.6 * e, 1.6 * e], p:[-w * .22, .8 * e, -d * .1], c:0xF2C230 }, { f:'boite', d:[1.1 * e, 1.1 * e, 1.1 * e], p:[-w * .22, 2.15 * e, -d * .1], c:0x2BA84A }, { f:'boule', d:[1 * e, 1], p:[w * .15, 1 * e, -d * .18], c:0xE5383B });
        p.push({ f:'boite', d:[1 * e, 2.6 * e, 1 * e], p:[w * .25, 1.3 * e, d * .15], c:0x2BA84A }, { f:'boite', d:[3.2 * e, .3, 1 * e], p:[w * .07, 1.2 * e, d * .15], r:[0, 0, .55], c:0x1B98E0 });
        break;
      }
      case 'salon': {
        // un salon fermé (vitré), un tapis, des canapés, un bar
        p.push({ f:'boite', d:[w * .95, .1, d * .9], p:[0, .05, 0], c:0x5B4636 });
        p.push(...cloisons(w, d, H, 0x2A2D43, ['+z'], .3, 0x8FA6BF), ...enseigne(d / 2, w, H, 0xD4AF37, e));
        for(let k = 0; k < 4; k++){ const x = (k % 2 ? 1 : -1) * w * .22, z = (k < 2 ? -1 : 1) * d * .16; p.push({ f:'boite', d:[2.4 * e, .7 * e, 1 * e], p:[x, .35 * e, z], c:0x3D405B }, { f:'boite', d:[2.4 * e, .7 * e, .3 * e], p:[x, .9 * e, z + .5 * e], c:0x3D405B }, { f:'cyl', d:[.6 * e, .6 * e, .6 * e, 10], p:[x, .3 * e, z - 1.3 * e], c:0xD4AF37 }); }
        p.push({ f:'boite', d:[w * .4, 1.1 * e, .9 * e], p:[0, .55 * e, -d * .38], c:0xD4AF37 }, ...plante(-w * .4, -d * .38, e), ...plante(w * .4, -d * .38, e));
        break;
      }
      case 'plantes':
        for(let k = 0; k < 3; k++){ const x = (k - 1) * w * .28; p.push({ f:'boite', d:[1.6 * e, .8 * e, 1.6 * e], p:[x, .4 * e, 0], c:0xB07D62 }, { f:'boule', d:[1 * e, 1], p:[x, 1.7 * e, 0], c:0x4E8F3E }, { f:'boule', d:[.6 * e, 1], p:[x + .5 * e, 2.4 * e, .2], c:0x5FA35A }); }
        p.push({ f:'boite', d:[3 * e, .5 * e, .8 * e], p:[0, .45 * e, d * .3], c:0x8B5A3C });
        break;
      case 'fontaine': {
        const r0 = Math.min(w, d) * .3;
        p.push({ f:'cyl', d:[r0, r0 * 1.05, .7 * e, 24], p:[0, .35 * e, 0], c:0xD9DEE4 }, { f:'cyl', d:[r0 * .88, r0 * .88, .1, 24], p:[0, .72 * e, 0], c:0x5FB8E6 }, { f:'cyl', d:[.4 * e, .5 * e, 2.4 * e, 8], p:[0, 1.2 * e, 0], c:0xD9DEE4 }, { f:'cyl', d:[1 * e, .6 * e, .3 * e, 12], p:[0, 2.5 * e, 0], c:0xD9DEE4 }, { f:'boule', d:[.5 * e, 1], p:[0, 2.9 * e, 0], c:0x8ECAE6 });
        for(let k = 0; k < 4; k++){ const a = k * Math.PI / 2 + .4; p.push({ f:'boite', d:[2.4 * e, .5 * e, .8 * e], p:[Math.cos(a) * (r0 + 1.6 * e), .4 * e, Math.sin(a) * (r0 + 1.6 * e)], r:[0, -a + Math.PI / 2, 0], c:0x8B5A3C }); }
        break;
      }
      default: mobilierGen(type, niv, cw, cd, p, e, w, d, H, coul);
    }
    return p;
  }
  // les constructions du catalogue (restaurants, cafés, bars, boutiques, services, décorations) : un décor de base par famille, des accessoires propres à chacune
  const hachage = t => { let h = 0; for(const ch of t) h = (h * 31 + ch.charCodeAt(0)) % 997; return h; };
  function mobilierGen(type, niv, cw, cd, p, e, w, d, H, coulCss){
    const Mo = M.MODULES[type], coul = parseInt(String(Mo.coul).replace('#', ''), 16), hh = hachage(type), clr = c => new T3.Color(c).lerp(new T3.Color(0xFFFFFF), .5).getHex();
    const table = (x, z, c1 = 0xFFFFFF, haute = false) => { p.push({ f:'cyl', d:[.8 * e, .8 * e, .1, 14], p:[x, (haute ? 1.5 : 1) * e, z], c:c1 }, { f:'cyl', d:[.1, .1, (haute ? 1.5 : 1) * e, 6], p:[x, (haute ? .75 : .5) * e, z], c:0x3A3F47 }); };
    const chaise = (x, z, c) => p.push({ f:'boite', d:[.55 * e, .55 * e, .55 * e], p:[x, .3 * e, z], c });
    const tabouret = (x, z, c) => p.push({ f:'cyl', d:[.28 * e, .28 * e, .1, 10], p:[x, .85 * e, z], c }, { f:'cyl', d:[.07, .07, .85 * e, 5], p:[x, .42 * e, z], c:0x3A3F47 });
    const comptoir = (x, z, lg, c, haut = 1.15) => p.push({ f:'boite', d:[lg, haut * e, 1 * e], p:[x, haut * e / 2, z], c }, { f:'boite', d:[lg + .1, .12, 1.15 * e], p:[x, haut * e + .06, z], c:0xF4F1DE });
    const enseigneP = (z, c) => p.push({ f:'boite', d:[w * .45, .9 * e, .3], p:[0, H + .6 * e, z], c }, { f:'boite', d:[w * .45 - .6, .25 * e, .32], p:[0, H + .6 * e, z], c:0xFFFFFF });
    const g = Mo.gen;
    if(g === 'resto' || g === 'cafe' || g === 'bar'){
      const sol = { fastfood:0xE9C46A, pizzeria:0xB5835A, brasserie:0x6B4A2F, sushi:0x2B2D42, gastro:0xE9E4D8, coffeeshop:0x8B5A3C, boulangerie:0xF1DFC1, salonthe:0xD8E2DC, bar_jus:0xF4E1B0, pub:0x5B3A24, bar_cocktail:0x2D1B3D, bar_vin:0x4A1D2B }[type] || 0xB5835A;
      p.push({ f:'boite', d:[w * .95, .08, d * .9], p:[0, .04, 0], c:sol });
      p.push(...cloisons(w, d, 1.3 * e, coul, ['+z', '-x'], .35));
      p.push({ f:'boite', d:[w * .5, 1.2 * e, .15], p:[w * .1, 3 * e, -d / 2 + .1], c:0x14233A }, { f:'boite', d:[w * .46, .22 * e, .17], p:[w * .1, 3.35 * e, -d / 2 + .1], c:coul });
      enseigneP(d / 2, coul);
      if(g === 'bar'){
        comptoir(w * .05, -d * .3, w * .7, coul === 0 ? 0x6B4A2F : coul, 1.3);
        for(let k = 0; k < 5; k++) tabouret(-w * .26 + k * w * .16, -d * .3 + 1.3 * e, [0xE5383B, 0x1B98E0, 0xF2C230][(k + hh) % 3]);
        for(let k = 0; k < 8; k++) p.push({ f:'cyl', d:[.1 * e, .1 * e, .6 * e, 6], p:[-w * .3 + k * w * .09, 2.6 * e, -d / 2 + .5 * e], c:[0x2A9D8F, 0xE76F51, 0xF4A261, 0x6D597A][k % 4] });      // les bouteilles
        p.push({ f:'boite', d:[w * .7, .12, .5 * e], p:[w * .05, 2.2 * e, -d / 2 + .5 * e], c:0x3A3F47 });
        if(type === 'pub') for(let k = 0; k < 2; k++) p.push({ f:'cyl', d:[.5 * e, .5 * e, .8 * e, 10], p:[w * .3 + k * .9 * e, .4 * e, d * .25], c:0x7A4A24 });
        if(type === 'bar_cocktail') for(let k = 0; k < 3; k++) p.push({ f:'boule', d:[.3 * e, 1], p:[-w * .25 + k * w * .25, 3.4 * e, -d * .1], c:0xC77DFF });
        if(type === 'bar_vin') for(let k = 0; k < 3; k++) p.push({ f:'cyl', d:[.55 * e, .55 * e, .9 * e, 10], p:[-w * .38 + k * .9 * e, .45 * e, d * .3], r:[Math.PI / 2, 0, 0], c:0x7A4A24 });
        if(type === 'bar_jus') for(let k = 0; k < 6; k++) p.push({ f:'boule', d:[.2 * e, 0], p:[-w * .25 + k * w * .1, 1.5 * e, -d * .3], c:[0xF18F01, 0x2BA84A, 0xE5383B][k % 3] });
        for(let k = 0; k < 2; k++) table(-w * .2 + k * w * .4, d * .15, 0xF4F1DE, true);
      } else if(g === 'cafe'){
        comptoir(w * .1, -d * .34, w * .55, coul);
        p.push({ f:'boite', d:[.8 * e, .8 * e, .6 * e], p:[w * .22, 1.6 * e, -d * .38], c:0x3A3F47 });
        if(type === 'boulangerie') for(let k = 0; k < 5; k++) p.push({ f:'boite', d:[.5 * e, .22 * e, .35 * e], p:[w * .1 - w * .2 + k * w * .1, 1.35 * e, -d * .34], c:[0xC68642, 0xE0AC69, 0xA5672B][k % 3] });
        for(let k = 0; k < 4; k++){ const x = -w * .3 + (k % 2) * w * .5, z = d * .02 + Math.floor(k / 2) * d * .28; table(x, z, type === 'salonthe' ? 0xFAF3E0 : 0xF4F1DE, type === 'coffeeshop'); chaise(x + 1.1 * e, z, 0x2A6F4D); chaise(x - 1.1 * e, z, 0x2A6F4D); if(type === 'salonthe') p.push({ f:'boule', d:[.2 * e, 0], p:[x, 1.25 * e, z], c:0xE9C46A }); }
      } else {
        const nb = type === 'fastfood' ? 8 : type === 'gastro' ? 4 : 6;
        comptoir(w * .1, -d * .36, w * .6, coul);
        if(type === 'pizzeria') p.push({ f:'boule', d:[1.1 * e, 1], p:[w * .3, 1.2 * e, -d * .36], s:[1, .7, 1], c:0xB5532A });
        if(type === 'sushi') p.push({ f:'boite', d:[w * .7, .3 * e, 1 * e], p:[0, 1 * e, -d * .05], c:0x1B1B1B }, ...[0, 1, 2, 3, 4, 5].map(k => ({ f:'cyl', d:[.22 * e, .22 * e, .1, 8], p:[-w * .3 + k * w * .12, 1.2 * e, -d * .05], c:[0xE5383B, 0xFFFFFF, 0xF2C230][k % 3] })));
        for(let k = 0; k < nb; k++){
          const x = -w * .32 + (k % 3) * w * .32, z = -d * .02 + Math.floor(k / 3) * d * .3;
          if(type === 'sushi'){ tabouret(-w * .3 + (k % 6) * w * .12, d * .1, 0xE5383B); if(k > 5) break; continue; }
          table(x, z, type === 'pizzeria' ? 0xE5383B : type === 'gastro' ? 0xFFFFFF : 0xF4F1DE);
          if(type === 'fastfood') p.push({ f:'boite', d:[1.5 * e, .5 * e, .5 * e], p:[x, .3 * e, z - 1 * e], c:0xE63946 }, { f:'boite', d:[1.5 * e, .5 * e, .5 * e], p:[x, .3 * e, z + 1 * e], c:0xE63946 });
          else for(const [dx, dz] of [[1, 0], [-1, 0]]) chaise(x + dx * 1.15 * e, z + dz * 1.15 * e, type === 'gastro' ? 0x6D597A : 0x8B2E2E);
          if(type === 'gastro') p.push({ f:'cyl', d:[.04, .04, .3 * e, 5], p:[x, 1.25 * e, z], c:0xFFE9A8 });
        }
        if(type === 'gastro') p.push({ f:'boule', d:[.9 * e, 1], p:[0, 3.4 * e, 0], c:0xFFE9A8 });
      }
    } else if(g === 'shop'){
      p.push(...cloisons(w, d, H, coul, ['+z'], .35, 0xBFD9EA), ...enseigne(d / 2, w, H, coul, e));
      p.push({ f:'boite', d:[.8 * e, 2.4 * e, d * .75], p:[-w / 2 + .7 * e, 1.2 * e, -d * .05], c:0xF4F1DE });
      p.push({ f:'boite', d:[2.4 * e, 1.1 * e, 1 * e], p:[w * .3, .55 * e, d * .2], c:0x6B4A2F }, { f:'boite', d:[.5 * e, .4 * e, .4 * e], p:[w * .3, 1.3 * e, d * .2], c:0x1E2A38 }, ...agent(w * .3, d * .2 - 1.1 * e, coul, e));
      const rayon = (x, z, c) => { p.push({ f:'boite', d:[w * .5, 1.8 * e, .7 * e], p:[x, .9 * e, z], c:0xF4F1DE }); for(let k = 0; k < 6; k++) p.push({ f:'boite', d:[.55 * e, .4 * e, .45 * e], p:[x - w * .2 + k * w * .08, 1.95 * e, z], c:c[k % c.length] }); };
      switch(type){
        case 'presse': rayon(-w * .1, -d * .25, [0xE5383B, 0x1B98E0, 0xF2C230, 0xFFFFFF]); p.push({ f:'boite', d:[1.4 * e, 1.2 * e, .6 * e], p:[-w * .1, .6 * e, d * .05], r:[-.3, 0, 0], c:0xE9C46A }); break;
        case 'souvenirs': p.push({ f:'cyl', d:[.5 * e, .5 * e, 2 * e, 8], p:[-w * .1, 1 * e, -d * .15], c:0xE76F51 }); for(let k = 0; k < 6; k++) p.push({ f:'boule', d:[.35 * e, 1], p:[-w * .3 + k * w * .12, 1.2 * e, d * .08], c:[0xF2C230, 0xE5383B, 0x1B98E0][k % 3] }); break;
        case 'pharmacie': rayon(-w * .1, -d * .25, [0xFFFFFF, 0x2A9D8F]); p.push({ f:'boite', d:[1.6 * e, .5 * e, .3], p:[0, H + 1.5 * e, d / 2], c:0x2BA84A }, { f:'boite', d:[.5 * e, 1.6 * e, .32], p:[0, H + 1.5 * e, d / 2], c:0x2BA84A }); break;
        case 'jouets': for(let k = 0; k < 6; k++) p.push({ f:'boite', d:[.8 * e, .8 * e, .8 * e], p:[-w * .3 + (k % 3) * w * .2, .4 * e + (k > 2 ? .8 * e : 0), -d * .1], c:[0xE5383B, 0xF2C230, 0x1B98E0, 0x2BA84A][k % 4] }); p.push({ f:'boule', d:[.6 * e, 1], p:[w * .05, 1.8 * e, -d * .2], c:0xC68642 }); break;
        case 'mode': for(let k = 0; k < 3; k++) p.push({ f:'cyl', d:[.25 * e, .35 * e, 1.1 * e, 8], p:[-w * .3 + k * w * .25, 1.4 * e, -d * .1], c:[0xD81159, 0x8F2D56, 0x218380][k] }, { f:'boule', d:[.22 * e, 1], p:[-w * .3 + k * w * .25, 2.2 * e, -d * .1], c:0xE8D5C4 }, { f:'cyl', d:[.05, .05, 1.1 * e, 6], p:[-w * .3 + k * w * .25, .55 * e, -d * .1], c:0x3A3F47 }); rayon(0, -d * .38, [0xD81159, 0xFFFFFF, 0x218380]); break;
        case 'parfumerie': for(let k = 0; k < 2; k++) p.push({ f:'boite', d:[w * .45, 1 * e, .9 * e], p:[-w * .12, .5 * e, -d * .28 + k * d * .3], c:0xFFFFFF }); for(let k = 0; k < 8; k++) p.push({ f:'cyl', d:[.1 * e, .12 * e, .4 * e, 6], p:[-w * .3 + k * w * .07, 1.25 * e, -d * .28 + (k % 2) * d * .3], c:[0xB5838D, 0xFFB5A7, 0xFCD5CE][k % 3] }); break;
        case 'spiritueux': for(let k = 0; k < 10; k++) p.push({ f:'cyl', d:[.1 * e, .12 * e, .7 * e, 6], p:[-w * .35 + k * w * .075, 1.5 * e, -d * .4], c:[0x5C3D2E, 0x2A6F4D, 0x8D6E3F][k % 3] }); rayon(0, -d * .1, [0x5C3D2E, 0xE9C46A]); break;
        case 'electronique': for(let k = 0; k < 3; k++) p.push({ f:'boite', d:[1.2 * e, .8 * e, .12], p:[-w * .3 + k * w * .25, 2.1 * e, -d * .4], c:0x0B1320 }, { f:'boite', d:[1 * e, .6 * e, .14], p:[-w * .3 + k * w * .25, 2.1 * e, -d * .4 + .05], c:0x4CC9F0 }); rayon(0, -d * .1, [0x1D3557, 0x4CC9F0]); break;
        case 'bijouterie': for(let k = 0; k < 2; k++) p.push({ f:'boite', d:[w * .4, 1.1 * e, .9 * e], p:[-w * .15, .55 * e, -d * .28 + k * d * .3], c:0x14233A }, { f:'boite', d:[w * .4, .5 * e, .9 * e], p:[-w * .15, 1.35 * e, -d * .28 + k * d * .3], c:0xBFE3F0 }); for(let k = 0; k < 5; k++) p.push({ f:'boule', d:[.12 * e, 0], p:[-w * .3 + k * w * .12, 1.45 * e, -d * .13], c:0xFFD700 }); break;
        default: rayon(-w * .1, -d * .25, [0xF2C230, 0x1B98E0, 0x2BA84A, 0xD7263D]);
      }
      p.push(...plante(w * .42, d / 2 + .9 * e, e));
    } else if(g === 'service'){
      p.push(...cloisons(w, d, 2.2 * e, coul, ['+z'], .4, 0xBFD9EA), ...enseigne(d / 2, w, 2.2 * e, coul, e));
      switch(type){
        case 'change': comptoir(0, -d * .2, w * .7, 0x2D6A4F); for(let k = 0; k < 3; k++) p.push({ f:'boite', d:[1.2 * e, .7 * e, .1], p:[-w * .25 + k * w * .25, 2.3 * e, -d * .45], c:0x0B1320 }, { f:'boite', d:[1 * e, .4 * e, .12], p:[-w * .25 + k * w * .25, 2.3 * e, -d * .45], c:0x51CF66 }); p.push(...agent(0, -d * .36, 0x2D6A4F, e)); break;
        case 'voiture': comptoir(0, -d * .25, w * .7, 0x0077B6); p.push({ f:'boite', d:[2.2 * e, .6 * e, 1 * e], p:[w * .15, 1.5 * e, -d * .25], c:0xE63946 }, { f:'boite', d:[1.2 * e, .45 * e, .9 * e], p:[w * .15, 2 * e, -d * .25], c:0xBFE3F0 }, ...agent(-w * .15, -d * .37, 0x0077B6, e)); break;
        case 'douches': for(let k = 0; k < 4; k++){ const x = -w * .33 + k * w * .22; p.push({ f:'boite', d:[1.7 * e, 2.6 * e, 1.7 * e], p:[x, 1.3 * e, -d * .1], c:0xBFE3F0 }, { f:'boite', d:[1 * e, 2.2 * e, .1], p:[x, 1.1 * e, -d * .1 + .9 * e], c:0x48CAE4 }); } break;
        case 'coworking': for(let k = 0; k < 4; k++){ const x = -w * .3 + (k % 2) * w * .5, z = -d * .15 + Math.floor(k / 2) * d * .38; p.push({ f:'boite', d:[2.2 * e, .12, 1.1 * e], p:[x, 1 * e, z], c:0xF4F1DE }, { f:'boite', d:[.9 * e, .5 * e, .6 * e], p:[x, 1.3 * e, z - .2 * e], c:0x1B1B1B }); chaise(x, z + 1 * e, 0x495057); } break;
        case 'repos': for(let k = 0; k < 4; k++){ const x = -w * .3 + k * w * .2; for(let lv = 0; lv < 2; lv++) p.push({ f:'boite', d:[1.6 * e, 1.1 * e, 2.6 * e], p:[x, .6 * e + lv * 1.3 * e, -d * .15], c:lv ? 0x6C757D : 0x3D405B }, { f:'boite', d:[1.3 * e, .15 * e, 1.5 * e], p:[x, .7 * e + lv * 1.3 * e, -d * .1], c:0xF4F1DE }); } break;
        case 'spa': for(let k = 0; k < 2; k++) p.push({ f:'boite', d:[1.1 * e, .8 * e, 2.4 * e], p:[-w * .15 + k * w * .35, .4 * e, -d * .1], c:0xF4F1DE }, { f:'boite', d:[1.1 * e, .1, 2.4 * e], p:[-w * .15 + k * w * .35, .85 * e, -d * .1], c:0x84A59D }); for(let k = 0; k < 4; k++) p.push({ f:'boule', d:[.2 * e, 0], p:[w * .3, .2 * e + k * .15, -d * .3 + k * .25], c:0x3D405B }); p.push(...plante(-w * .38, -d * .35, e), ...plante(w * .38, d * .2, e)); break;
        default: comptoir(0, -d * .2, w * .6, coul);
      }
    } else if(g === 'deco'){
      p.push({ f:'boite', d:[w * .85, .14, d * .85], p:[0, .07, 0], c:clr(coul) });
      switch(type){
        case 'jardin': for(let k = 0; k < 4; k++){ const x = (k % 2 ? 1 : -1) * w * .22, z = (k < 2 ? -1 : 1) * d * .22; p.push({ f:'cyl', d:[.35 * e, .45 * e, 3 * e, 7], p:[x, 1.7 * e, z], c:0x6B4A2F }, { f:'boule', d:[1.6 * e, 1], p:[x, 3.9 * e, z], c:0x4E8F3E }, { f:'boule', d:[1 * e, 1], p:[x + .6 * e, 4.5 * e, z], c:0x5FA35A }); } p.push({ f:'boite', d:[w * .85, .5 * e, .3], p:[0, .3 * e, d * .43], c:0x8B5A3C }); break;
        case 'murvegetal': p.push({ f:'boite', d:[w * .8, 4.2 * e, .6 * e], p:[0, 2.1 * e, -d * .3], c:0x40916C }); for(let k = 0; k < 14; k++) p.push({ f:'boule', d:[.5 * e, 0], p:[-w * .34 + (k % 7) * w * .11, 1 * e + Math.floor(k / 7) * 2 * e, -d * .3 + .4 * e], c:[0x74C69D, 0x52B788, 0x2D6A4F][k % 3] }); break;
        case 'statue': p.push({ f:'boite', d:[2.2 * e, 1.2 * e, 2.2 * e], p:[0, .6 * e, 0], c:0x8C949F }, { f:'boule', d:[1.3 * e, 1], p:[0, 2.4 * e, 0], s:[1, 1.4, 1], c:0xD4AF37 }, { f:'boite', d:[.5 * e, 2.4 * e, .5 * e], p:[.8 * e, 3.4 * e, 0], r:[0, .4, .5], c:0xD4AF37 }); break;
        case 'piano': p.push({ f:'boite', d:[2.4 * e, .9 * e, 3 * e], p:[0, 1.1 * e, 0], c:0x111111 }, { f:'boite', d:[2.4 * e, .1, 3 * e], p:[0, 1.75 * e, -.1], r:[0, 0, .35], c:0x1B1B1B }, ...[[-1, -1], [1, -1], [0, 1.2]].map(([dx, dz]) => ({ f:'cyl', d:[.1 * e, .1 * e, 1.1 * e, 6], p:[dx * e, .55 * e, dz * e], c:0x111111 })), { f:'boite', d:[1.4 * e, .5 * e, .6 * e], p:[0, .6 * e, 2 * e], c:0x3A3F47 }); break;
        case 'horloge': p.push({ f:'boite', d:[1.2 * e, 5 * e, 1.2 * e], p:[0, 2.5 * e, 0], c:0xB08968 }, { f:'cyl', d:[1.6 * e, 1.6 * e, .3 * e, 20], p:[0, 4.8 * e, .65 * e], r:[Math.PI / 2, 0, 0], c:0xFFFFFF }, { f:'boite', d:[.1, 1.1 * e, .1], p:[0, 5 * e, .85 * e], c:0x1B1B1B }, { f:'boite', d:[.8 * e, .1, .1], p:[.4 * e, 4.8 * e, .85 * e], c:0x1B1B1B }); break;
        case 'aquarium': p.push({ f:'boite', d:[w * .7, 3 * e, d * .45], p:[0, 1.5 * e, 0], c:0x4CC9F0 }, { f:'boite', d:[w * .74, .5 * e, d * .5], p:[0, .25 * e, 0], c:0x3A3F47 }, { f:'boite', d:[w * .74, .3 * e, d * .5], p:[0, 3.1 * e, 0], c:0x3A3F47 }); for(let k = 0; k < 8; k++) p.push({ f:'boule', d:[.2 * e, 0], p:[-w * .28 + k * w * .08, 1 * e + (k % 3) * .7 * e, (k % 2 ? 1 : -1) * d * .1], s:[1.6, 1, 1], c:[0xF18F01, 0xFFD60A, 0xE5383B][k % 3] }); break;
        case 'maquette': p.push({ f:'cyl', d:[.15 * e, .15 * e, 5 * e, 6], p:[0, 2.5 * e, 0], c:0x8C949F }, { f:'cyl', d:[.5 * e, .35 * e, 5 * e, 10], p:[0, 5.6 * e, 0], r:[Math.PI / 2, 0, 0], c:0xF4F6F8 }, { f:'boite', d:[6 * e, .12 * e, 1.2 * e], p:[0, 5.5 * e, .3 * e], c:0xC9CED6 }, { f:'boite', d:[1.6 * e, .12 * e, .7 * e], p:[0, 5.7 * e, -2.2 * e], c:0xC9CED6 }, { f:'boite', d:[.12 * e, 1.1 * e, .7 * e], p:[0, 6.1 * e, -2.2 * e], c:0x1B6EC2 }); break;
        default: p.push(...plante(0, 0, e));
      }
    }
  }
  function construireInterieur(A, Pl){
    const cle = A.terminal.l + 'x' + A.terminal.h + 'z' + A.terminal.la + 'r' + (A.terminal.cr || 0) + ':' + A.terminal.modules.map(m => m.type + m.x + m.y + m.niv + 'r' + (m.rot || 0)).join(',') + '|' + (A.terminal.petits || []).map(p => p.type + p.x + '.' + p.y + 'r' + (p.rot || 0)).join(',') + '|' + A.portes.map(g => g.nom + g.taille + (g.passerelle ? 'p' : '')).join(',');
    if(cle === cleInt && interieur) return;
    cleInt = cle;
    if(interieur){ monde.remove(interieur); interieur.traverse(o => { if(o.geometry) o.geometry.dispose(); }); }
    const G = grilleT(A, Pl), pieces = [], sol = [], interieur2 = [];
    // le carrelage, la ligne jaune de la sûreté (entre la rangée côté ville et le reste)
    // les allées (un sol clair et chaud) et le carrelage de chaque case
    sol.push({ f:'boite', d:[G.T.x1 - G.T.x0 - 2 * MARGE_X + 2, .08, G.pd * G.h + 2], p:[(G.T.x0 + G.T.x1) / 2, .52, G.T.z1 - MARGE_Z - G.pd * G.h / 2], c:0xF1ECE2 });
    for(let x = 0; x < G.l; x++) for(let y = 0; y < G.h; y++){ const c = G.centre(x, y); sol.push({ f:'boite', d:[G.pw - .05, .1, G.pd - .05], p:[c.x, .55, c.z], c:(COUL_SOL[G.zone(x, y)])[(x + y) % 2] }); }
    // les zones : un cadre de leur couleur au sol, des murs vitrés avec des portes (une réserve vide est fermée par une séparation)
    const X = i => G.T.x1 - MARGE_X - i * G.pw, Zr = jj => G.T.z1 - MARGE_Z - jj * G.pd, largP = G.pw / 4, colsP = M.colonnesPortes(A);
    const cadre = (x0, x1, z0, z1, coul, pointille) => {                      // x0 < x1 et z0 < z1 (monde)
      const ep = .8, seg = (xa, za, xb, zb) => {
        const horiz = Math.abs(zb - za) < .01, lg = horiz ? xb - xa : zb - za;
        if(!pointille){ sol.push({ f:'boite', d:horiz ? [lg, .1, ep] : [ep, .1, lg], p:[(xa + xb) / 2, .66, (za + zb) / 2], c:coul }); return; }
        for(let t = 0; t < lg; t += 6){ const l2 = Math.min(3.5, lg - t); sol.push({ f:'boite', d:horiz ? [l2, .1, ep] : [ep, .1, l2], p:horiz ? [xa + t + l2 / 2, .66, za] : [xa, .66, za + t + l2 / 2], c:coul }); }
      };
      seg(x0, z0 + ep / 2, x1, z0 + ep / 2); seg(x0, z1 - ep / 2, x1, z1 - ep / 2); seg(x0 + ep / 2, z0, x0 + ep / 2, z1); seg(x1 - ep / 2, z0, x1 - ep / 2, z1);
    };
    const mur = (xa, za, xb, zb, coul) => {                                    // un mur : soubassement de la couleur de la zone, vitre, liseré
      const horiz = Math.abs(zb - za) < .01, lg = Math.hypot(xb - xa, zb - za), cx = (xa + xb) / 2, cz = (za + zb) / 2, hm = 4.2;
      if(lg < .5) return;
      pieces.push({ f:'boite', d:horiz ? [lg, 1.2, .4] : [.4, 1.2, lg], p:[cx, .6 + .6, cz], c:coul }, { f:'boite', d:horiz ? [lg, hm - 1.2, .14] : [.14, hm - 1.2, lg], p:[cx, .6 + 1.2 + (hm - 1.2) / 2, cz], c:0xBFE3F0 },
        { f:'boite', d:horiz ? [lg, .2, .55] : [.55, .2, lg], p:[cx, .6 + hm, cz], c:0x5C6672 });
    };
    // le mur entre le hall (rangée 0) et les commerces, avec une porte devant chaque contrôle et chaque poste d'arrivée
    { let xs = [[X(G.l), X(0)]];
      for(const c of colsP){ const xc = (X(c) + X(c + 1)) / 2, a0 = xc - largP / 2, b0 = xc + largP / 2, nx = [];
        for(const [lo, hi] of xs){ if(b0 <= lo || a0 >= hi){ nx.push([lo, hi]); continue; } if(a0 > lo) nx.push([lo, a0]); if(b0 < hi) nx.push([b0, hi]); }
        xs = nx;
        const zn = G.zone(c, 0), pc = COUL_ZONE[zn] || 0x2A9D8F;
        pieces.push({ f:'boite', d:[.5, 3.6, .6], p:[a0, .6 + 1.8, Zr(1)], c:pc }, { f:'boite', d:[.5, 3.6, .6], p:[b0, .6 + 1.8, Zr(1)], c:pc }, { f:'boite', d:[largP + 1, .5, .6], p:[xc, .6 + 3.8, Zr(1)], c:pc });   // le chambranle de la porte
      }
      for(const [lo, hi] of xs){ const col = Math.max(0, Math.min(G.l - 1, Math.floor((X(0) - (lo + hi) / 2) / G.pw))); mur(lo, Zr(1), hi, Zr(1), COUL_ZONE[G.zone(col, 0)] || 0x8C949F); }
    }
    // les murs verticaux du hall entre les zones (Départs | réserve | Arrivées)
    for(const i2 of G.cr > 0 ? [G.cd0, G.ca0] : (G.cd0 < G.l ? [G.cd0] : [])) mur(X(i2), Zr(1), X(i2), Zr(0), 0x8C949F);
    cadre(X(G.cd0), X(0), Zr(1), Zr(0), COUL_ZONE.dep, false);
    if(G.cr > 0) cadre(X(G.ca0), X(G.cd0), Zr(1), Zr(0), COUL_ZONE.res, true);
    if(G.ca0 < G.l) cadre(X(G.l), X(G.ca0), Zr(1), Zr(0), COUL_ZONE.arr, false);
    cadre(X(G.l), X(0), Zr(G.h), Zr(1), COUL_ZONE.com, false);
    if(G.cr > 0){ const xr = (X(G.cd0) + X(G.ca0)) / 2, tr = new T3.Mesh(new T3.PlaneGeometry(Math.min(G.cr * G.pw * .8, 26), Math.min(G.cr * G.pw * .8, 26) * .24), new T3.MeshBasicMaterial({ map:texteCache('RÉSERVE · agrandissement', '#2F6FE0', '#FFFFFF', 1024), transparent:true })); tr.rotation.x = -Math.PI / 2; tr.rotation.z = Math.PI; tr.position.set(xr, .72, Zr(.5)); interieur2.push(tr); }
    // les petits objets, dans leur petite case
    for(const q of A.terminal.petits || []){ const c = G.sub(q.x, q.y); for(const o of tournerPieces(petitObjet(q.type, G.epetit), q.rot || 0)){ o.p = [o.p[0] + c.x, o.p[1] + .6, o.p[2] + c.z]; pieces.push(o); } }
    for(const m of A.terminal.modules){
      const c = G.centre(m.x, m.y);
      sol.push({ f:'boite', d:[G.cw - 1.2, .12, G.cd - 1.2], p:[c.x, .64, c.z], c:clair(M.MODULES[m.type].coul) });
      const rot = m.rot || 0, imp = rot % 2;
      for(const q of tournerPieces(mobilier(m.type, m.niv, imp ? G.cd : G.cw, imp ? G.cw : G.cd), rot)){ q.p = [q.p[0] + c.x, q.p[1] + .65, q.p[2] + c.z]; pieces.push(q); }
    }
    interieur = new T3.Group(); for(const m of interieur2) interieur.add(m);
    // la jetée : les portes d'embarquement le long de la façade côté pistes
    const T = G.T, e = ECH_P;
    sol.push({ f:'boite', d:[T.x1 - T.x0 - 2, .1, JETEE - 1], p:[(T.x0 + T.x1) / 2, .55, T.z0 + JETEE / 2], c:0xD3DAE3 });
    sol.push({ f:'boite', d:[T.x1 - T.x0 - 2, .12, .5], p:[(T.x0 + T.x1) / 2, .62, T.z0 + JETEE], c:0x8C949F });
    Pl.postes.forEach((po, i) => {
      const g = A.portes[i], gx = clamp(po.cx + 6, T.x0 + 9, T.x1 - 9), lz = Math.min(po.w - 6, 30), z0 = T.z0 + 1.2, zc = T.z0 + JETEE / 2;
      sol.push({ f:'boite', d:[lz, .13, JETEE - 2.5], p:[gx, .63, zc], c:g.passerelle ? 0x274C77 : 0x4A6FA5 });
      // la porte dans la façade (cadre jaune), le comptoir d'embarquement avec son agent et son écran
      pieces.push({ f:'boite', d:[.4, 3.2 * e, .5], p:[gx - 1.6 * e, 1.6 * e + .6, z0], c:0xFFB703 }, { f:'boite', d:[.4, 3.2 * e, .5], p:[gx + 1.6 * e, 1.6 * e + .6, z0], c:0xFFB703 }, { f:'boite', d:[3.6 * e, .4, .5], p:[gx, 3.2 * e + .6, z0], c:0xFFB703 });
      pieces.push({ f:'boite', d:[3 * e, 2.9 * e, .2], p:[gx, 1.5 * e + .6, z0 - .3], c:g.passerelle ? 0x3A3F47 : 0x6B7785 });
      const dx = gx + 4.5 * e;
      pieces.push({ f:'boite', d:[2.6 * e, 1.1 * e, 1 * e], p:[dx, .55 * e + .6, z0 + 2.6 * e], c:0xE9EDF2 }, { f:'boite', d:[2.6 * e, .15, 1.1 * e], p:[dx, 1.12 * e + .6, z0 + 2.6 * e], c:0x1B4E8C });
      for(const q of agent(dx, z0 + 1.5 * e, 0x1B4E8C, e)){ q.p[1] += .6; pieces.push(q); }
      pieces.push({ f:'cyl', d:[.1 * e, .1 * e, 2.4 * e, 6], p:[dx - 1.6 * e, 1.2 * e + .6, z0 + 2.6 * e], c:0x8C949F }, { f:'boite', d:[1.6 * e, 1 * e, .15], p:[dx - 1.6 * e, 2.6 * e + .6, z0 + 2.6 * e], c:0x14233A });
      // les sièges de la porte, tournés vers les avions, et les barrières de l'embarquement
      const nbS = Math.max(3, Math.floor(lz / (1.3 * e)) - 2);
      for(let r = 0; r < 2; r++) for(let k = 0; k < nbS; k++){
        const x = gx - (nbS - 1) * .65 * e + k * 1.3 * e, z = T.z0 + JETEE - 3 - r * 2.6 * e;
        pieces.push({ f:'boite', d:[1.1 * e, .45 * e, .8 * e], p:[x, .45 * e + .6, z], c:0x2F6FB5 }, { f:'boite', d:[1.1 * e, .7 * e, .18 * e], p:[x, .95 * e + .6, z + .45 * e], c:0x24558C });
      }
      for(const q of [...poteau(gx - 3.2 * e, z0 + 3.2 * e, e), ...poteau(gx - 3.2 * e, z0 + 6 * e, e), sangle(gx - 3.2 * e - .02, gx - 3.2 * e + .02, z0 + 4.6 * e, e)]){ q.p[1] += .6; pieces.push(q); }
      pieces.push({ f:'boite', d:[.15, 2.6 * e, 2.6 * e], p:[gx - 3.2 * e, .6 + .9 * e, z0 + 4.6 * e], c:0x1B4E8C, s:[1, .25, 1] });
      // une cloison basse entre deux portes
      pieces.push({ f:'boite', d:[.3, 1.2 * e, JETEE * .5], p:[gx + lz / 2 + 1, .6 + .6 * e, T.z0 + JETEE * .3], c:0xBFC5CC });
      // le numéro : peint au sol, et sur un panneau suspendu
      const num = new T3.Mesh(new T3.PlaneGeometry(6, 3), new T3.MeshBasicMaterial({ map:texteCache(g.nom, '#FFB703', '#14233A'), transparent:true }));
      num.rotation.x = -Math.PI / 2; num.rotation.z = Math.PI; num.position.set(gx - 1, .72, z0 + 4.2); interieur.add(num);
      const pan = new T3.Mesh(new T3.PlaneGeometry(6.5, 2.6), new T3.MeshBasicMaterial({ map:texteCache(`Porte ${g.nom}${g.passerelle ? '' : ' · bus'}`, '#14233A', '#FFB703'), side:T3.DoubleSide }));
      pan.position.set(gx, 7, z0 + 4.5); pan.lookAt(gx, 13, z0 - 4.5); interieur.add(pan);
    });
    // les grands panneaux « Départs » et « Arrivées » au-dessus des espaces de chaque côté
    for(const m of A.terminal.modules){
      const Mo = M.MODULES[m.type], dep = ['comptoir', 'securite', 'passeports'].includes(m.type), arr = ['tapis', 'douane'].includes(m.type);
      if(!dep && !arr) continue;
      const c = G.centre(m.x, m.y), txt = dep ? `DÉPARTS · ${Mo.nom}` : `ARRIVÉES · ${Mo.nom}`;
      const pan = new T3.Mesh(new T3.PlaneGeometry(Math.min(G.cw * .6, 12), 2.2), new T3.MeshBasicMaterial({ map:texteCache(txt, dep ? '#FFB703' : '#2A9D8F', dep ? '#14233A' : '#FFFFFF', 1024), side:T3.DoubleSide }));
      pan.position.set(c.x, 8, c.z); pan.lookAt(c.x, 14, c.z - 9); interieur.add(pan);
      pieces.push({ f:'cyl', d:[.06, .06, 3, 4], p:[c.x - Math.min(G.cw * .6, 12) * .4, 10.4, c.z], c:0x5C6672 }, { f:'cyl', d:[.06, .06, 3, 4], p:[c.x + Math.min(G.cw * .6, 12) * .4, 10.4, c.z], c:0x5C6672 });
    }
    // les portiques d'enseignes, comme dans un vrai aéroport : deux poteaux, une poutre, et le panneau suspendu (Départs, Arrivées au hall ; Duty-free et commerces côté pistes)
    for(const [i0, i1, fond, coul, txt, zb] of [[0, G.cd0, '#E5383B', '#FFFFFF', 'DÉPARTS ✈', Zr(1) + 2.6], [G.ca0, G.l, '#2A9D8F', '#FFFFFF', 'ARRIVÉES 🛬', Zr(1) + 2.6], [0, G.l, '#FFB703', '#14233A', 'DUTY-FREE · COMMERCES 🛍️', T.z0 + JETEE + 2.2]]){
      if(i1 <= i0) continue;
      const xa = X(i1) + 2.5, xb = X(i0) - 2.5, xm = (xa + xb) / 2, hp = 8.6, lg = Math.min(i0 === 0 && i1 === G.l ? 22 : 13, (xb - xa) * .5);
      for(const xp of [xa, xb]) pieces.push({ f:'cyl', d:[.28, .32, hp, 8], p:[xp, .6 + hp / 2, zb], c:0x5C6672 }, { f:'boite', d:[1.3, .2, 1.3], p:[xp, .7, zb], c:0x3A3F47 });
      pieces.push({ f:'boite', d:[xb - xa + .8, .5, .6], p:[xm, .6 + hp, zb], c:0x5C6672 });                                    // la poutre
      for(const dx of [-lg * .42, lg * .42]) pieces.push({ f:'boite', d:[.14, .9, .14], p:[xm + dx, .6 + hp - .65, zb], c:0x3A3F47 });   // les suspentes
      pieces.push({ f:'boite', d:[lg + .5, lg * .16 + .4, .3], p:[xm, .6 + hp - 1.9 - lg * .08, zb], c:0x1E2430 });                // le caisson du panneau
      for(const sg of [1, -1]){ const pan = new T3.Mesh(new T3.PlaneGeometry(lg, lg * .16), new T3.MeshBasicMaterial({ map:texteCache(txt, fond, coul, 1024) })); pan.position.set(xm, .6 + hp - 1.9 - lg * .08, zb + sg * .17); if(sg < 0) pan.rotation.y = Math.PI; interieur.add(pan); }
    }
    interieur.add(new T3.Mesh(fusion(sol), MAT));
    if(pieces.length) interieur.add(objet(pieces, .08));
    monde.add(interieur);
  }
  // les textes des panneaux (gardés une fois dessinés)
  const TEXTES = new Map();
  function texteCache(txt, fond, coul, w = 512){
    const cle = txt + fond + coul + w; if(TEXTES.has(cle)) return TEXTES.get(cle);
    const c = document.createElement('canvas'); c.width = w; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = fond; x.beginPath(); x.roundRect ? x.roundRect(4, 4, w - 8, 120, 18) : x.rect(4, 4, w - 8, 120); x.fill();
    x.fillStyle = coul; let taillePx = 80; x.font = `900 ${taillePx}px "Bricolage Grotesque", system-ui, sans-serif`;
    while(x.measureText(txt).width > w - 40 && taillePx > 24){ taillePx -= 4; x.font = `900 ${taillePx}px "Bricolage Grotesque", system-ui, sans-serif`; }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, 68);
    const t = new T3.CanvasTexture(c); t.anisotropy = 4; TEXTES.set(cle, t); return t;
  }
  // les passagers : une foule (des silhouettes instanciées) qui reflète les files et la salle d'attente de la simulation
  const MAX_AG = 420, COUL_P = [0xE5383B, 0x1B6EC2, 0x2BA84A, 0xFB8500, 0x6A4C93, 0x14233A, 0xF2C230, 0x8D99AE, 0xC1121F, 0x0B6E4F];
  const PEAUX = [0xF1C27D, 0xE0AC69, 0xC68642, 0x8D5524, 0xFFDBAC];
  const PANTALONS = [0x1F2A44, 0x3A3F47, 0x5B4636, 0x2D3A55, 0x14233A, 0x6B5B45], CHEVEUX = [0x2A1B12, 0x5A3825, 0xC9A66B, 0x111111, 0x8A8A8A, 0xA23B1E, 0x3B2A1E], BAGAGES = [0xD7263D, 0x1B6EC2, 0x14233A, 0xF2C230, 0x2BA84A, 0x8D99AE];
  const lotFoule = () => [foule, tetes, jambes, cheveux, sacs];
  function preparerFoule(){
    if(foule) return;
    // un passager : torse et bras (la couleur du haut), jambes et chaussures (le pantalon), la tête, les cheveux, et pour la plupart un bagage (valise ou sac à dos)
    const corps = fusion([{ f:'cyl', d:[.3, .38, .82, 8], p:[0, 1.28, 0] }, { f:'cyl', d:[.1, .09, .78, 5], p:[-.43, 1.22, 0], r:[0, 0, .08] }, { f:'cyl', d:[.1, .09, .78, 5], p:[.43, 1.22, 0], r:[0, 0, -.08] },
      { f:'cyl', d:[.14, .17, .12, 6], p:[0, 1.74, 0] }]);
    const bas = fusion([{ f:'cyl', d:[.15, .13, .8, 6], p:[-.16, .42, 0] }, { f:'cyl', d:[.15, .13, .8, 6], p:[.16, .42, 0] }, { f:'boite', d:[.22, .1, .36], p:[-.16, .05, .05] }, { f:'boite', d:[.22, .1, .36], p:[.16, .05, .05] }]);
    const tete = fusion([{ f:'boule', d:[.25, 1], p:[0, 1.98, 0] }]);
    const poil = fusion([{ f:'boule', d:[.27, 1], p:[0, 2.05, -.04] }]);
    const sac = fusion([{ f:'boite', d:[.3, .46, .2], p:[.5, .42, .1] }, { f:'boite', d:[.2, .05, .05], p:[.5, .7, .1] }, { f:'boite', d:[.3, .46, .16], p:[0, 1.3, -.3] }]);
    foule = new T3.InstancedMesh(corps, toon({}), MAX_AG); jambes = new T3.InstancedMesh(bas, toon({}), MAX_AG); tetes = new T3.InstancedMesh(tete, toon({}), MAX_AG);
    cheveux = new T3.InstancedMesh(poil, toon({}), MAX_AG); sacs = new T3.InstancedMesh(sac, toon({}), MAX_AG);
    const c = new T3.Color();
    for(const m of lotFoule()) m.instanceMatrix.setUsage(T3.DynamicDrawUsage);
    for(let i = 0; i < MAX_AG; i++){
      foule.setColorAt(i, c.set(COUL_P[i % COUL_P.length])); tetes.setColorAt(i, c.set(PEAUX[(i * 7) % PEAUX.length]));
      jambes.setColorAt(i, c.set(PANTALONS[(i * 5) % PANTALONS.length])); cheveux.setColorAt(i, c.set(CHEVEUX[(i * 3) % CHEVEUX.length])); sacs.setColorAt(i, c.set(BAGAGES[(i * 11) % BAGAGES.length]));
    }
    for(const m of lotFoule()){ m.count = 0; m.frustumCulled = false; scene.add(m); }
  }

  /* ---------- Les routes des passagers : une grille de navigation (les petits carrés 8 × 8) avec les murs, les portes et la réserve ----------
     Les passagers marchent le long des allées, passent par les portes des murs et ne traversent plus les constructions. */
  let nav = null, cleNav = '', Gc = null;
  function grilleNav(A, G){
    const cle = [A.terminal.l, A.terminal.la, A.terminal.cr || 0, A.terminal.h, A.terminal.modules.map(m => m.type + m.x + m.y).join(',')].join('|');
    if(nav && cle === cleNav) return nav; cleNav = cle;
    const N = G.N, W = G.l * N, H = G.h * N, libre = new Uint8Array(W * H), mod = new Set(A.terminal.modules.map(m => m.x + ':' + m.y));
    for(let py = 0; py < H; py++) for(let px = 0; px < W; px++){
      const cx = px >> 3, cy = py >> 3; let ok = 1;
      if(cy === 0 && G.zone(cx, 0) === 'res') ok = 0;
      else if(mod.has(cx + ':' + cy)){ const lx = px & 7, ly = py & 7; if(lx > 0 && lx < 7 && ly > 0 && ly < 7) ok = 0; }
      libre[py * W + px] = ok;
    }
    nav = { W, H, libre, N, portes:new Set(M.colonnesPortes(A)), zone:G.zone, champs:new Map() };
    return nav;
  }
  // peut-on passer d'un petit carré à son voisin (4 directions) ? (murs entre le hall et les commerces, entre les zones du hall)
  function passe(nv, px, py, qx, qy){
    if(qx < 0 || qy < 0 || qx >= nv.W || qy >= nv.H || !nv.libre[qy * nv.W + qx]) return false;
    if(py !== qy && (py >> 3) !== (qy >> 3) && (Math.min(py, qy) >> 3) === 0) return nv.portes.has(px >> 3) && ((px & 7) === 3 || (px & 7) === 4);
    if(px !== qx && (px >> 3) !== (qx >> 3) && (py >> 3) === 0) return nv.zone(px >> 3, 0) === nv.zone(qx >> 3, 0);
    return true;
  }
  const VOIS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // la distance (en petits carrés) de chaque carré jusqu'au but
  function champ(nv, gx, gy){
    const cle = gy * nv.W + gx; let d = nv.champs.get(cle); if(d) return d;
    if(nv.champs.size > 160) nv.champs.clear();
    d = new Int16Array(nv.W * nv.H).fill(-1); const q = [cle]; d[cle] = 0;
    for(let i = 0; i < q.length; i++){
      const c = q[i], px = c % nv.W, py = (c / nv.W) | 0;
      for(const [dx, dy] of VOIS){ const qx = px + dx, qy = py + dy; if(!passe(nv, px, py, qx, qy)) continue; const k = qy * nv.W + qx; if(d[k] >= 0) continue; d[k] = d[c] + 1; q.push(k); }
    }
    nv.champs.set(cle, d); return d;
  }
  const sousDe = (G, nv, x, z) => ({ px:clamp(Math.floor((G.T.x1 - MARGE_X - x) / (G.pw / nv.N)), 0, nv.W - 1), py:clamp(Math.floor((G.T.z1 - MARGE_Z - z) / (G.pd / nv.N)), 0, nv.H - 1) });
  function procheLibre(nv, px, py){
    if(nv.libre[py * nv.W + px]) return { px, py };
    for(let r = 1; r <= 12; r++) for(let dx = -r; dx <= r; dx++) for(let dy = -r; dy <= r; dy++){
      if(Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const qx = px + dx, qy = py + dy;
      if(qx >= 0 && qy >= 0 && qx < nv.W && qy < nv.H && nv.libre[qy * nv.W + qx]) return { px:qx, py:qy };
    }
    return { px, py };
  }
  // le chemin d'un point à un autre : les coins du trajet dans les allées (puis le point d'arrivée exact)
  function chemin(G, nv, x0, z0, x1, z1){
    const s = (() => { const a = sousDe(G, nv, x0, z0); return procheLibre(nv, a.px, a.py); })(), g = (() => { const a = sousDe(G, nv, x1, z1); return procheLibre(nv, a.px, a.py); })();
    const d = champ(nv, g.px, g.py); if(d[s.py * nv.W + s.px] < 0) return [];
    const pts = [], c = (px, py) => G.sub(px, py); let px = s.px, py = s.py, dirP = null, garde = 0;
    pts.push(c(px, py));
    while(d[py * nv.W + px] > 0 && garde++ < 500){
      const dc = d[py * nv.W + px]; let pick = null;
      if(dirP){ const qx = px + dirP[0], qy = py + dirP[1]; if(passe(nv, px, py, qx, qy) && d[qy * nv.W + qx] === dc - 1) pick = dirP; }
      if(!pick) for(const v of VOIS){ const qx = px + v[0], qy = py + v[1]; if(passe(nv, px, py, qx, qy) && d[qy * nv.W + qx] === dc - 1){ pick = v; break; } }
      if(!pick) break;
      if(dirP && (pick[0] !== dirP[0] || pick[1] !== dirP[1])) pts.push(c(px, py));
      dirP = pick; px += pick[0]; py += pick[1];
    }
    pts.push(c(px, py));
    return pts;
  }
  // envoyer un passager quelque part : il suit la route (les coins) puis rejoint le point exact
  function diriger(a, x, z){
    if(a.dx != null && Math.abs(a.dx - x) < .35 && Math.abs(a.dz - z) < .35) return;
    a.dx = x; a.dz = z;
    const r = Gc && nav ? chemin(Gc, nav, a.x, a.z, x, z) : [];
    a.route = r.map(p => ({ x:p.x + a.ox, z:p.z + a.oz })); a.route.push({ x, z });
    const n = a.route.shift(); a.tx = n.x; a.tz = n.z;
  }
  const AIRSIDE = ['salle', 'cafe', 'boutique', 'restaurant', 'salon', 'jeux', 'fontaine', 'plantes', 'toilettes'];
  function nouvelAgent(role, x, z){ const a = { role, x, z, tx:x, tz:z, attente:0, pas:Math.random() * 6, id:Math.floor(Math.random() * MAX_AG), ox:(Math.random() - .5) * 1.4, oz:(Math.random() - .5) * 1.4, route:[] }; agents.push(a); return a; }
  // l'entrée côté ville : les départs entrent par la zone Départs, les arrivées sortent par la zone Arrivées
  function entree(G, zone = 'dep'){
    const a = zone === 'arr' ? G.ca0 : 0, b = zone === 'arr' ? G.l : G.cd0, xa = G.T.x1 - MARGE_X - b * G.pw + 4, xb = G.T.x1 - MARGE_X - a * G.pw - 4;
    return { x:xa + Math.random() * Math.max(1, xb - xa), z:G.T.z1 - 1.5 };
  }
  function placeFile(A, G, type, rang){
    const ms = A.terminal.modules.filter(m => m.type === type);
    if(!ms.length){
      // pas de guichet : on attend en paquet, juste après la sûreté (ou près de l'entrée)
      const sec = A.terminal.modules.find(m => m.type === 'securite'), c = sec ? G.centre(sec.x, sec.y) : { x:(G.T.x0 + G.T.x1) / 2, z:G.T.z1 - 8 };
      return { x:c.x + ((rang % 8) - 3.5) * 1.6, z:c.z - G.cd * .5 - 1.5 - Math.floor(rang / 8) * 1.6 };
    }
    const m = ms[rang % ms.length], j = Math.floor(rang / ms.length), c = G.centre(m.x, m.y), rot = m.rot || 0;
    // la file part du comptoir (ou du portique) vers l'avant de la construction (vers la ville quand elle n'est pas tournée), en serpentin entre les sangles
    // quand la file est trop longue pour la place qu'il y a (jusqu'au mur), un deuxième serpentin s'ouvre à côté
    const dir = tournerXZ(0, 1, rot), b0 = baseFile(type, G.cd), w0 = { x:c.x + dir.x * b0, z:c.z + dir.z * b0 };
    const lim = [dir.z > 0 ? (G.T.z1 - 3 - w0.z) / dir.z : dir.z < 0 ? (w0.z - (G.T.z0 + JETEE + 2)) / -dir.z : 1e9, dir.x > 0 ? (G.T.x1 - 3 - w0.x) / dir.x : dir.x < 0 ? (w0.x - (G.T.x0 + 3)) / -dir.x : 1e9];
    const maxR = Math.max(2, Math.floor(Math.min(lim[0], lim[1]) / FILE_PAS_Z) + 1);
    const rangee = Math.floor(j / 5), k = j % 5, bloc = Math.floor(rangee / maxR), q = posFile(type, G.cd, rangee % maxR, k);
    const dx = bloc ? Math.ceil(bloc / 2) * (bloc % 2 ? 1 : -1) * (5 * FILE_PAS_X + 1.2) : 0, o = tournerXZ(q.x + dx, q.z, rot);
    return { x:clamp(c.x + o.x, G.T.x0 + 2, G.T.x1 - 2), z:clamp(c.z + o.z, G.T.z0 + JETEE + 1, G.T.z1 - 1) };
  }
  function placeAttente(A, G){
    const ms = A.terminal.modules.filter(m => m.y >= 1);
    if(!ms.length){ const y = G.h - 1 - Math.floor(Math.random() * Math.max(1, G.h - 1)); const c = G.centre(Math.floor(Math.random() * Math.max(1, G.l)), y); return { x:c.x + (Math.random() - .5) * G.cw * .8, z:c.z + (Math.random() - .5) * G.cd * .8 }; }
    const m = ms[Math.floor(Math.random() * ms.length)], c = G.centre(m.x, m.y);
    return { x:c.x + (Math.random() - .5) * G.cw * .75, z:c.z + (Math.random() - .5) * G.cd * .75 };
  }
  // un point au hasard dans une construction de ce type (de l'autre côté de la file)
  function placeModule(A, G, type, frac){
    const ms = A.terminal.modules.filter(m => m.type === type); if(!ms.length) return entree(G, 'arr');
    const m = ms[Math.floor(Math.random() * ms.length)], c = G.centre(m.x, m.y);
    return { x:c.x + (Math.random() - .5) * G.cw * .6, z:c.z - G.cd * frac + (Math.random() - .5) * 2 };
  }
  function placeTapis(A, G){
    const ms = A.terminal.modules.filter(m => m.type === 'tapis'); if(!ms.length) return entree(G, 'arr');
    const m = ms[Math.floor(Math.random() * ms.length)], c = G.centre(m.x, m.y), a = Math.random() * Math.PI * 2, r = Math.min(G.cw, G.cd) * (.36 + Math.random() * .08);
    return { x:c.x + Math.cos(a) * r, z:c.z + Math.sin(a) * r };
  }
  const versPorte = (Pl, G, i) => ({ x:clamp(Pl.postes[i] ? Pl.postes[i].cx : (G.T.x0 + G.T.x1) / 2, G.T.x0 + 4, G.T.x1 - 4), z:G.T.z0 + 1.5 });
  function majFoule(A, Pl, dtReel){
    const G = grilleT(A, Pl); Gc = G; grilleNav(A, G); const ca = A.capAffiche || { check:0, secu:0, airside:0 };
    // un passager dessiné vaut k passagers de la simulation quand il y a foule
    const total = ca.check + ca.secu + ca.airside, k = Math.max(1, total / (MAX_AG * .78));
    const voulu = { check:Math.round(ca.check / k), secu:Math.round(ca.secu / k), pass:Math.round((ca.pass || 0) / k), attente:Math.round(ca.airside / k) };
    const compte = r => agents.filter(a => a.role === r).length;
    // la vitesse de marche suit la vitesse du temps (et s'arrête en pause)
    const dSim = tSim == null ? 0 : A.t - tSim; tSim = A.t;
    const ratio = dtReel > 0 ? dSim / dtReel : 0, vitesse = dSim > 0 ? clamp(5 + 9 * ratio, 5, 70) : 0;
    // les files avancent : les premiers de l'enregistrement passent au contrôle, les premiers du contrôle vont en salle d'attente
    while(files.check.length > voulu.check){ const a = files.check.shift(); a.role = 'secu'; files.secu.push(a); }
    // après la sûreté : les passeports (vols internationaux), puis la salle d'attente
    while(files.secu.length > voulu.secu){ const a = files.secu.shift(); if(files.pass.length < voulu.pass){ a.role = 'pass'; files.pass.push(a); } else { a.role = 'attente'; const p = placeAttente(A, G); diriger(a, p.x, p.z); } }
    while(files.pass.length > voulu.pass){ const a = files.pass.shift(); a.role = 'attente'; const p = placeAttente(A, G); diriger(a, p.x, p.z); }
    let n = compte('attente');
    // des nouveaux arrivent par les portes côté ville
    while(files.check.length < voulu.check && agents.length < MAX_AG){ const e = entree(G), a = nouvelAgent('check', e.x, e.z); files.check.push(a); }
    while(files.secu.length < voulu.secu && agents.length < MAX_AG){ const e = entree(G), a = nouvelAgent('secu', e.x, e.z); files.secu.push(a); }
    while(files.pass.length < voulu.pass && agents.length < MAX_AG){ const e = entree(G), a = nouvelAgent('pass', e.x, e.z); files.pass.push(a); }
    while(n < voulu.attente && agents.length < MAX_AG){ const e = entree(G), a = nouvelAgent('attente', e.x, e.z); const p = placeAttente(A, G); diriger(a, p.x, p.z); n++; }
    // l'embarquement : ceux en trop partent vers la porte de l'avion qui embarque
    if(n > voulu.attente){
      const emb = A.vols.filter(v => v.etat === 'escale' && v.taches && v.taches.embarquement && v.taches.embarquement.etat === 'encours');
      let trop = n - voulu.attente;
      for(const a of agents){ if(trop <= 0) break; if(a.role !== 'attente') continue; a.role = 'part'; const v = emb.length ? emb[Math.floor(Math.random() * emb.length)] : null; const p = versPorte(Pl, G, v ? v.porte : Math.floor(Math.random() * Pl.postes.length)); diriger(a, p.x + (Math.random() - .5) * 4, p.z); trop--; }
    }
    // l'arrivée : les passagers qui débarquent entrent par leur porte et vont chercher leurs bagages
    for(const v of A.vols){
      if(v.etat !== 'escale' || !v.taches || !v.taches.debarquement) continue;
      const voulus = Math.round((v.taches.debarquement.fait || 0) / k / 1.5);
      v._vus = v._vus || 0;
      while(v._vus < voulus && agents.length < MAX_AG){ const p = versPorte(Pl, G, v.porte), dou = v.intl && A.terminal.modules.some(m => m.type === 'douane'), a = nouvelAgent(dou ? 'douane' : 'arrivee', p.x + (Math.random() - .5) * 4, p.z); const t = dou ? placeModule(A, G, 'douane', .3) : placeTapis(A, G); diriger(a, t.x, t.z); a.attente = dou ? .8 + Math.random() * 1.5 : 2 + Math.random() * 5; v._vus++; }
    }
    // les files se rangent
    files.check.forEach((a, i) => { const p = placeFile(A, G, 'comptoir', i); diriger(a, p.x, p.z); });
    files.secu.forEach((a, i) => { const p = placeFile(A, G, 'securite', i); diriger(a, p.x, p.z); });
    files.pass.forEach((a, i) => { const p = placeFile(A, G, 'passeports', i); diriger(a, p.x, p.z); });
    // marcher
    for(let i = agents.length - 1; i >= 0; i--){
      const a = agents[i], dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz), pas = vitesse * dtReel;
      if(d > pas){ a.x += dx / d * pas; a.z += dz / d * pas; a.cap = Math.atan2(dx, dz); a.pas += dtReel * 9; a.marche = true; continue; }
      a.x = a.tx; a.z = a.tz;
      if(a.route && a.route.length){ const nx = a.route.shift(); a.tx = nx.x; a.tz = nx.z; continue; }
      a.marche = false;
      if(a.role === 'part' || a.role === 'sortie'){ agents.splice(i, 1); continue; }
      // l'arrivée : la douane (pour les vols internationaux), puis le tapis à bagages, puis la sortie
      if(a.role === 'douane'){ a.attente -= dtReel * Math.max(.3, ratio); if(a.attente <= 0){ a.role = 'arrivee'; const t = placeTapis(A, G); diriger(a, t.x, t.z); a.attente = 2 + Math.random() * 5; } continue; }
      if(a.role === 'arrivee'){ a.attente -= dtReel * Math.max(.3, ratio); if(a.attente <= 0){ a.role = 'sortie'; const e = entree(G, 'arr'); diriger(a, e.x, e.z + 2); } continue; }
      // dans la salle d'attente, on se promène un peu (boutiques, café)
      if(a.role === 'attente' && vitesse > 0 && Math.random() < dtReel * .08){ const p = placeAttente(A, G); diriger(a, p.x, p.z); }
    }
    // dessiner
    const zero = new T3.Matrix4().makeScale(0, 0, 0), m = new T3.Matrix4(), q = new T3.Quaternion(), sc = new T3.Vector3(ECH_P, ECH_P, ECH_P), pos = new T3.Vector3(), eY = new T3.Euler();
    let c = 0;
    for(const a of agents){
      if(c >= MAX_AG) break;
      const saut = a.marche ? Math.abs(Math.sin(a.pas)) * .25 : 0;
      pos.set(a.x, .65 + saut, a.z); eY.set(0, a.cap || 0, 0); q.setFromEuler(eY); m.compose(pos, q, sc);
      foule.setMatrixAt(c, m); tetes.setMatrixAt(c, m); jambes.setMatrixAt(c, m); cheveux.setMatrixAt(c, m);
      // trois passagers sur quatre ont un bagage : une valise à la main, ou un sac à dos
      sacs.setMatrixAt(c, (c * 7 + 3) % 4 ? m : zero); c++;
    }
    for(const f of lotFoule()){ f.count = c; f.instanceMatrix.needsUpdate = true; }
  }
  // regarder dans l'aérogare : quand on zoome assez, le toit s'enlève et la foule apparaît
  function majInterieur(A, Pl, dtReel){
    preparerFoule(); construireInterieur(A, Pl);
    const T = Pl.terminal, dedans = vue.dist < 470 && vue.x > T.x0 - 260 && vue.x < T.x1 + 260;
    if(dedans !== coupe){ coupe = dedans; toit.visible = !dedans; vitres.opacity = dedans ? .28 : 1; vitres.depthWrite = !dedans; }
    interieur.visible = dedans; for(const f of lotFoule()) f.visible = dedans;
    if(plafonniers) plafonniers.visible = dedans;                    // sous le toit, ils seraient cachés
    // la simulation des passagers tourne toujours (pour que la foule soit prête quand on regarde)
    majFoule(A, Pl, dtReel);
  }

  /* ---------- La lumière du jour et de la nuit ---------- */
  const CIELS = [[0, 0x0B1530], [300, 0x0F1D3D], [360, 0xF2A97E], [450, 0x8FCBF3], [1050, 0x8FCBF3], [1140, 0xF0956A], [1200, 0x1A2650], [1440, 0x0B1530]];
  function couleurCiel(m){ for(let i = 1; i < CIELS.length; i++) if(m <= CIELS[i][0]){ const [a, ca] = CIELS[i - 1], [b, cb] = CIELS[i]; return new T3.Color(ca).lerp(new T3.Color(cb), (m - a) / (b - a)); } return new T3.Color(CIELS[0][1]); }
  function lumiere(m, meteo){
    const jour = clamp(Math.sin((m - 330) / (1200 - 330) * Math.PI) * 1.4, 0, 1);
    const c = couleurCiel(m); if(meteo === 'neige' || meteo === 'nuages') c.lerp(new T3.Color(0xB9C3CE), .5 * jour);
    ciel.copy(c); scene.fog.color.copy(c).lerp(new T3.Color(0xFFFFFF), .25 * jour);
    hemi.intensity = .22 + .36 * jour; soleil.intensity = .08 + .42 * jour * (meteo === 'beau' ? 1 : .7);
    const a = (m - 720) / 720 * Math.PI; soleil.position.set(Math.sin(a), Math.max(.2, Math.cos(a)), .35);
    const nuit = 1 - jour;
    if(vitres){ vitres.emissive.setRGB(.9 * nuit, .75 * nuit, .4 * nuit); }
    if(lampes) lampes.material.opacity = .15 + .85 * nuit;
    // l'aérogare : les bandeaux s'allument au crépuscule, les lampes avec eux
    if(plafonniers) plafonniers.material.opacity = .18 + .8 * nuit;
    // assez pour lire le terminal, pas assez pour effacer la nuit : minuit ne doit pas ressembler à midi
    for(const pl of lampesTerm) pl.intensity = .8 * nuit;
  }

  /* ---------- La caméra ---------- */
  function camera(A, Pl, dt = .016){
    if(vue.suivi){
      const a = avions.get(vue.suivi);
      const k = 1 - Math.exp(-dt * 5);
      if(a){ vue.x += (a.obj.position.x - vue.x) * k; vue.z += (a.obj.position.z - vue.z) * k; } else vue.suivi = null;
    }
    const lim = Pl.piste.x1 - Pl.piste.x0;
    vue.x = clamp(vue.x, Pl.piste.x0 - 300, Pl.piste.x1 + 300); vue.z = clamp(vue.z, Pl.pistes[Pl.pistes.length - 1].z - 300, 200);
    vue.dist = clamp(vue.dist, 70, Math.max(900, lim * 1.15));
    const incl = clamp(vue.incl - (520 - vue.dist) / 2600, .55, 1.25);
    cam.position.set(vue.x + Math.sin(vue.cap) * Math.cos(incl) * vue.dist, Math.sin(incl) * vue.dist, vue.z + Math.cos(vue.cap) * Math.cos(incl) * vue.dist);
    cam.lookAt(vue.x, 0, vue.z);
  }
  function deplacer(dxPx, dyPx){
    const k = vue.dist / H * 1.1, c = Math.cos(vue.cap), sn = Math.sin(vue.cap);
    vue.x += -c * dxPx * k - sn * dyPx * k; vue.z += sn * dxPx * k - c * dyPx * k; vue.suivi = null;
  }
  const zoomer = f => { vue.dist *= f; };
  const tourner = da => { vue.cap += da; };
  function centrer(A){ const Pl = M.plan(A), util = Pl.postes.filter((p, i) => A.contrats.some(c => c.porte === i)), l = util.length ? util : Pl.postes; vue.x = l.reduce((t, p) => t + p.cx, 0) / l.length; vue.z = -95; vue.dist = H > L ? 380 : 330; vue.cap = Math.PI + .45; vue.suivi = null; }
  // toucher l'écran : quel avion ?
  const rc = () => new T3.Raycaster();
  function choisir(sx, sy){
    if(!ok) return null;
    const r = rc(); r.setFromCamera(new T3.Vector2(sx / L * 2 - 1, -(sy / H) * 2 + 1), cam);
    let best = null, bd = 1e9;
    for(const [id, a] of avions){
      // un avion est touché si le rayon passe près de son centre (plus facile au doigt)
      const c = a.obj.position.clone(); c.y += a.md.pieds;
      const d = r.ray.distanceToPoint(c), rayon = Math.max(14, a.md.lg * .55);
      if(d < rayon && d < bd){ bd = d; best = id; }
    }
    return best;
  }
  // toucher l'écran : quel poste du terminal (seulement quand on voit l'intérieur) ?
  function choisirModule(sx, sy, A){
    if(!ok || !coupe) return null;
    const r = rc(); r.setFromCamera(new T3.Vector2(sx / L * 2 - 1, -(sy / H) * 2 + 1), cam);
    const pt = new T3.Vector3(); if(!r.ray.intersectPlane(new T3.Plane(new T3.Vector3(0, 1, 0), -.7), pt)) return null;
    const G = grilleT(A, M.plan(A));
    return A.terminal.modules.find(m => { const c = G.centre(m.x, m.y); return Math.abs(pt.x - c.x) < G.pw / 2 && Math.abs(pt.z - c.z) < G.pd / 2; }) || null;
  }
  // toucher l'écran : quel endroit de l'aéroport ? (une case ou une petite case du terminal, une porte, les cuves, le dépôt…)
  function cibler(sx, sy, A){
    if(!ok) return null;
    const r = rc(); r.setFromCamera(new T3.Vector2(sx / L * 2 - 1, -(sy / H) * 2 + 1), cam);
    const Pl = M.plan(A), T = Pl.terminal, pt = new T3.Vector3();
    if(r.ray.intersectPlane(new T3.Plane(new T3.Vector3(0, 1, 0), coupe ? -.7 : -14), pt) && pt.x > T.x0 && pt.x < T.x1 && pt.z > T.z0 && pt.z < T.z1){
      if(!coupe) return { zone:'terminal' };
      const G = grilleT(A, Pl), fx = (T.x1 - MARGE_X - pt.x) / G.pw, fy = (T.z1 - MARGE_Z - pt.z) / G.pd;
      if(pt.z < T.z0 + JETEE){ let best = 0; Pl.postes.forEach((p, i) => { if(Math.abs(p.cx - pt.x) < Math.abs(Pl.postes[best].cx - pt.x)) best = i; }); return { zone:'jetee', porte:best }; }
      if(fx < 0 || fy < 0 || fx >= G.l || fy >= G.h) return { zone:'terminal' };
      return { zone:'case', x:Math.floor(fx), y:Math.floor(fy), qx:Math.floor(fx * G.N), qy:Math.floor(fy * G.N) };
    }
    if(!r.ray.intersectPlane(new T3.Plane(new T3.Vector3(0, 1, 0), 0), pt)) return null;
    const D = Pl.depot, Cb = Pl.carburant, n = A.carbu ? A.carbu.niv + 1 : 3;
    if(Math.abs(pt.x - D.x) < 30 && Math.abs(pt.z - (D.z + 28)) < 24) return { zone:'depot' };
    for(const hg of Pl.hangars || []) if(Math.abs(pt.x - hg.x) < 24 && Math.abs(pt.z - hg.z) < 16) return { zone:'hangar', hangar:hg.k };
    if(pt.x > Cb.x - 22 && pt.x < Cb.x + (n - 1) * 17 + 14 && Math.abs(pt.z - (Cb.z + 42)) < 22) return { zone:'carburant' };
    if(Math.hypot(pt.x - Pl.tour.x, pt.z - Pl.tour.z) < 14) return { zone:'tour' };
    for(let i = 0; i < Pl.postes.length; i++){ const p = Pl.postes[i]; if(Math.abs(pt.x - p.cx) < p.w / 2 && pt.z < T.z0 && pt.z > p.nezZ - 80) return { zone:'porte', porte:i }; }
    for(let k = 0; k < M.nbPistes(A); k++) if(Math.abs(pt.z - Pl.pistes[k].z) < 40 && pt.x > Pl.piste.x0 - 20 && pt.x < Pl.piste.x1 + 20) return { zone:'piste' };
    return { zone:'sol' };
  }
  // l'aperçu transparent de ce qu'on va poser (déjà tourné), vert si c'est possible, rouge sinon
  let fant = null, cleFant = '';
  function fantome(A, f){
    const cle = f ? [f.mode, f.type, f.x, f.y, f.rot, f.ok, A.terminal.l, A.terminal.h].join('|') : '';
    if(cle === cleFant) return; cleFant = cle;
    if(fant){ scene.remove(fant); fant.traverse(o => { if(o.geometry) o.geometry.dispose(); }); fant = null; }
    if(!f || !ok) return;
    const G = grilleT(A, M.plan(A)), rot = f.rot || 0; let c, pieces, dim;
    if(f.mode === 'module'){ c = G.centre(f.x, f.y); const imp = rot % 2; pieces = tournerPieces(mobilier(f.type, 1, imp ? G.cd : G.cw, imp ? G.cw : G.cd), rot); dim = [G.cw, G.cd]; }
    else { c = G.sub(f.x, f.y); pieces = tournerPieces(petitObjet(f.type, G.epetit), rot); dim = [G.pw / G.N - .3, G.pd / G.N - .3]; }
    pieces = [...pieces, { f:'boite', d:[dim[0], .12, dim[1]], p:[0, .08, 0], c:f.ok ? 0x51CF66 : 0xE5383B }];
    fant = new T3.Mesh(fusion(pieces), new T3.MeshBasicMaterial({ vertexColors:true, transparent:true, opacity:.62, depthWrite:false }));
    fant.position.set(c.x, .65, c.z); fant.renderOrder = 6; scene.add(fant);
  }
  // pendant un placement : les cases (ou petites cases) libres s'allument en vert
  let surb = null, cleSurb = '';
  function surbrillance(A, mode, type){
    const cle = mode ? mode + (type || '') + ':' + A.terminal.la + 'r' + (A.terminal.cr || 0) + ':' + A.terminal.l + ':' + A.terminal.modules.map(m => m.x + '.' + m.y).join(',') + ':' + (A.terminal.petits || []).map(p => p.x + '.' + p.y).join(',') : '';
    if(cle === cleSurb) return; cleSurb = cle;
    if(surb){ scene.remove(surb); surb.geometry.dispose(); surb = null; }
    if(!mode || !ok) return;
    const G = grilleT(A, M.plan(A)), rects = [];
    if(mode === 'module'){ for(let x = 0; x < G.l; x++) for(let y = 0; y < G.h; y++) if(!M.erreurPose({ xp:1e9 }, A, x, y, type || 'plantes')){ const c = G.centre(x, y); rects.push({ f:'boite', d:[G.cw, .1, G.cd], p:[c.x, 1, c.z], c:0x51CF66 }); } }
    else for(let x = 0; x < G.l * G.N; x++) for(let y = 0; y < G.h * G.N; y++) if(!M.libreQuart(A, x, y)){ const c = G.sub(x, y); rects.push({ f:'boite', d:[G.pw / G.N - .4, .1, G.pd / G.N - .4], p:[c.x, 1, c.z], c:0x51CF66 }); }
    if(!rects.length) return;
    surb = new T3.Mesh(fusion(rects), new T3.MeshBasicMaterial({ vertexColors:true, transparent:true, opacity:.38, depthWrite:false })); surb.renderOrder = 5; scene.add(surb);
  }
  // les outils de dessin, prêtés aux mini-jeux de contrôle (même moteur, même style)
  const kit = () => ok ? { T3, R, objet, fusion, MAT, CONTOUR, avion:(type, comp, livree) => { const md = modeleAvion(type, comp, livree), g = new T3.Group(), corps = new T3.Mesh(md.geo, MAT); g.add(corps, new T3.Mesh(md.geoC, CONTOUR)); const h = creerHelices(md); if(h) g.add(h); return { g, corps, md, r:RAYON[type] }; }, get L(){ return L; }, get H(){ return H; } } : null;
  function suivre(id){ vue.suivi = id; if(id) vue.dist = Math.min(vue.dist, 300); }
  function rendu(){ if(ok) R.render(scene, cam); }

  /* ---------- L'aperçu d'un avion (le hangar) ---------- */
  let RA = null, SA = null, CA = null, objA = null, cleA = '';
  function apercu(canvas, type, comp, livree, angle){
    if(!ok) return;
    if(!RA || RA.domElement !== canvas){
      RA = new T3.WebGLRenderer({ canvas, antialias:true, alpha:true }); RA.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      SA = new T3.Scene(); SA.add(new T3.HemisphereLight(0xFFFFFF, 0x8090A0, .8)); const d = new T3.DirectionalLight(0xFFFFFF, .6); d.position.set(.4, 1, .6); SA.add(d);
      const solA = new T3.Mesh(new T3.CircleGeometry(60, 40), new T3.MeshToonMaterial({ color:0x5C6672, gradientMap:DEGRADE })); solA.rotation.x = -Math.PI / 2; SA.add(solA);
      const ligne = new T3.Mesh(new T3.PlaneGeometry(1, 120), new T3.MeshBasicMaterial({ color:0xF2C230 })); ligne.rotation.x = -Math.PI / 2; ligne.position.y = .05; SA.add(ligne);
      CA = new T3.PerspectiveCamera(32, 1, 1, 1000); cleA = '';
    }
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 180; RA.setSize(w, h, false); CA.aspect = w / h; CA.updateProjectionMatrix();
    const cle = type + comp + livree;
    if(cle !== cleA){
      if(objA) SA.remove(objA);
      const md = modeleAvion(type, comp, livree); objA = new T3.Group(); const c = new T3.Group(); c.add(new T3.Mesh(md.geo, MAT), new T3.Mesh(md.geoC, CONTOUR)); if(md.helices) c.add(creerHelices(md)); c.position.y = md.pieds; objA.add(c); SA.add(objA); cleA = cle;
      objA.userData.lg = md.lg;
    }
    objA.rotation.y = angle;
    const d = objA.userData.lg * 1.05 + 8; CA.position.set(d * .8, d * .38, d * .75); CA.lookAt(0, 2.5, 0);
    RA.render(SA, CA);
  }

  return { init, taille, maj, rendu, choisir, choisirModule, cibler, surbrillance, fantome, get coupe(){ return coupe; }, kit, suivre, deplacer, zoomer, tourner, centrer, apercu, vue, get ok(){ return ok; }, get agents(){ return agents.length; }, _debug:() => ({ avions:[...avions].map(([id, a]) => ({ id, x:Math.round(a.obj.position.x), y:Math.round(a.obj.position.y), z:Math.round(a.obj.position.z), vis:a.obj.visible, enfants:a.corps.children.length, dansScene:!!a.obj.parent })), cam:cam.position.toArray().map(Math.round), vue:{ ...vue } }) };
})();
