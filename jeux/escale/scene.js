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
  let interieur = null, cleInt = '', foule = null, tetes = null, tSim = null, coupe = false;
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
      + '|' + (P.hangars || []).map(x => x.k + ((A.hangars || {})[x.k] ? '1' : '0')).join(',');
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
    const aire = plat(P.piste.x1 - P.piste.x0 + 500, 700, decor === 'montagne' ? 0x9CC484 : 0xA7CB86, -.1); aire.position.set(0, -.1, -130); monde.add(aire);
    // la piste
    const piste = new T3.Mesh(new T3.PlaneGeometry(P.piste.x1 - P.piste.x0, P.piste.largeur), new T3.MeshToonMaterial({ map:texturePiste(P.piste.x1 - P.piste.x0), gradientMap:DEGRADE }));
    piste.rotation.x = -Math.PI / 2; piste.position.set(0, .05, P.piste.z); monde.add(piste);
    // les voies de circulation (asphalte) et leurs lignes jaunes
    const asphalte = [], jaune = [];
    const voie = (x1, z1, x2, z2, l = 23) => { const dx = x2 - x1, dz = z2 - z1, lg = Math.hypot(dx, dz), a = Math.atan2(dx, dz); asphalte.push({ f:'boite', d:[l, .1, lg + l], p:[(x1 + x2) / 2, .02, (z1 + z2) / 2], r:[0, a, 0], c:0x50555E }); jaune.push({ f:'boite', d:[.5, .02, lg], p:[(x1 + x2) / 2, .1, (z1 + z2) / 2], r:[0, a, 0], c:0xF2C230 }); };
    voie(P.piste.x0 + 20, M.TAXI_Z, P.piste.x1 - 20, M.TAXI_Z);
    for(const b of P.bretelles) voie(b, P.piste.z + 10, b, M.TAXI_Z);
    voie(P.piste.x0 + 20, P.piste.z + 10, P.piste.x0 + 20, M.TAXI_Z);
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
    for(let x = P.piste.x0; x <= P.piste.x1; x += 30){ pts.push(x, .6, P.piste.z - 23, x, .6, P.piste.z + 23); }
    for(let x = P.piste.x0 + 20; x <= P.piste.x1 - 20; x += 25) pts.push(x, .4, M.TAXI_Z - 12, x, .4, M.TAXI_Z + 12);
    const gl = new T3.BufferGeometry(); gl.setAttribute('position', new T3.Float32BufferAttribute(pts, 3));
    const colL = []; for(let k = 0; k < pts.length / 3; k++){ const piste_ = pts[k * 3 + 2] < M.TAXI_Z - 20; colL.push(piste_ ? 1 : .2, piste_ ? .95 : .45, piste_ ? .8 : 1); }
    gl.setAttribute('color', new T3.Float32BufferAttribute(colL, 3));
    lampes = new T3.Points(gl, new T3.PointsMaterial({ size:2.4, vertexColors:true, transparent:true, opacity:.2, sizeAttenuation:true, depthWrite:false })); monde.add(lampes);
    // le décor autour
    decorer(D.decor, P, rnd);
    // la neige qui tombe
    const ng = new T3.BufferGeometry(), np = []; for(let k = 0; k < 2500; k++) np.push((Math.random() - .5) * 1600, Math.random() * 300, (Math.random() - .5) * 1600 - 120);
    ng.setAttribute('position', new T3.Float32BufferAttribute(np, 3));
    neige = new T3.Points(ng, new T3.PointsMaterial({ color:0xFFFFFF, size:1.6, transparent:true, opacity:.9, depthWrite:false })); neige.visible = false; monde.add(neige);
  }
  function decorer(decor, P, rnd){
    const arbres = [], loin = [];
    const arbre = (x, z, s, sapin) => sapin ? arbres.push({ f:'cone', d:[3 * s, 11 * s, 7], p:[x, 6 * s, z], c:0x2F6B3F }, { f:'cyl', d:[.6 * s, .6 * s, 2 * s, 5], p:[x, .8 * s, z], c:0x6B4A2F })
      : arbres.push({ f:'boule', d:[4 * s, 0], p:[x, 5 * s, z], c:0x4E8F3E }, { f:'cyl', d:[.6 * s, .7 * s, 3 * s, 5], p:[x, 1.5 * s, z], c:0x6B4A2F });
    const libre = (x, z) => !(z > P.piste.z - 60 && z < 160 && x > P.piste.x0 - 120 && x < P.piste.x1 + 120);
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
  function couleursLivree(comp, livree){
    const C = M.COMPAGNIES[comp], c1 = new T3.Color(C.c1), c2 = new T3.Color(C.c2), c3 = new T3.Color(C.c3), blanc = new T3.Color(0xF4F6F8), or = new T3.Color(0xD4AF37);
    return { c1, c2, c3, blanc, or, livree };
  }
  // le fuselage : un tour (lathe) avec des couleurs selon la livrée (bandes, ventre, hublots)
  function fuselage(type, comp, livree, lg, r){
    const prof = [], n = 26;
    for(let k = 0; k <= n; k++){
      const u = k / n, z = u * lg;
      let rr = r;
      if(u < .12) rr = r * Math.pow(u / .12, .55);               // le nez arrondi
      else if(u > .74) rr = r * (1 - Math.pow((u - .74) / .26, 1.6) * .82);   // la queue qui s'affine
      prof.push(new T3.Vector2(Math.max(.05, rr), z));
    }
    const g = new T3.LatheGeometry(prof, 20);
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
      if(livree === 'base' && y > -.42 && y < -.28 && u > .1) c = L.c1;
      // les hublots (une bande sombre), le poste de pilotage
      if(y > .2 && y < .34 && u > .15 && u < .82) c = cc.set(0x2A3442);
      if(u < .1 && u > .045 && y > .2 && y < .55) c = cc.set(0x1E2A38);
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
    const L = couleursLivree(comp, livree), c1 = L.c1.getHex(), c2 = L.c2.getHex(), c3 = livree === 'or' ? 0xD4AF37 : L.c3.getHex(), gris = 0xC9CED6;
    const p = [];
    p.push({ g:fuselage(type, comp, livree, lg, r) });
    const haute = A.aile === 'haute', yAile = haute ? r * .85 : -r * .45, zAile = haute ? lg * .02 : lg * .06;
    const corde = haute ? lg * .12 : lg * (A.taille === 'S' ? .17 : .2), fleche = haute ? 0 : corde * (A.taille === 'L' || A.taille === 'XL' ? 1.2 : .9);
    for(const s of [1, -1]){
      const ga = aile(env / 2 - r * .6, corde, corde * .35, fleche, r * .16);
      p.push({ g:ga, p:[s * r * .6, yAile, zAile + corde / 2], s:[s, 1, 1], c:gris });
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
          const re = r * (A.gros ? .55 : .42);
          p.push({ f:'cyl', d:[re, re * .85, re * 3.3, 14], p:[ex, yAile - re * 1.05, ez], r:[Math.PI / 2, 0, 0], c:c3 });
          p.push({ f:'cyl', d:[re * .8, re * .8, .2, 14], p:[ex, yAile - re * 1.05, ez + re * 1.66], r:[Math.PI / 2, 0, 0], c:0x1E2430 });
          p.push({ f:'boite', d:[.35, re * .9, re * 2], p:[ex, yAile - re * .2, ez - re * .2], c:gris });
        }
      }
    }
    // la dérive (aux couleurs de la compagnie)
    const hD = r * (A.taille === 'S' ? 2.6 : 2.2), cD = lg * .16;
    const sD = new T3.Shape(); sD.moveTo(0, 0); sD.lineTo(cD, 0); sD.lineTo(cD * 1.25, hD); sD.lineTo(cD * .75, hD); sD.lineTo(0, 0);
    const gD = new T3.ExtrudeGeometry(sD, { depth:r * .14, bevelEnabled:false }); gD.translate(0, 0, -r * .07); gD.rotateY(Math.PI / 2); gD.computeVertexNormals();
    p.push({ g:gD, p:[0, r * .55, -lg / 2 + lg * .05 + cD], c:livree === 'or' ? 0xD4AF37 : c1 });
    p.push({ f:'boite', d:[r * .17, hD * .2, cD * .55], p:[0, r * .55 + hD * .55, -lg / 2 + lg * .05 + cD * .35], c:c2 });
    // le train d'atterrissage
    p.push({ f:'cyl', d:[.35, .35, r * 1.2, 6], p:[0, -r * 1.2, lg * .38], c:0x2A3442 });
    for(const s of [1, -1]) p.push({ f:'cyl', d:[.55, .55, .9, 8], p:[s * r * .7, -r * 1.35, -lg * .02], r:[0, 0, Math.PI / 2], c:0x1E2430 });
    const geo = fusion(p), geoC = fusion(p.filter(x => !x.f || x.f !== 'cyl' || true), .09);
    // les hélices (elles tournent)
    let helices = null;
    if(A.moteurs === 'helices'){
      // une hélice centrée sur son moyeu (elle tourne sur elle-même), posée devant chaque moteur
      const hp = []; for(let b = 0; b < 6; b++) hp.push({ f:'boite', d:[.25, r * 1.5, .08], p:[0, 0, 0], r:[0, 0, b * Math.PI / 3], c:0x22262E });
      helices = { geo:fusion(hp), pos:[1, -1].map(s => [s * (r + (env / 2) * .22), yAile - r * .15, zAile + corde / 2 + corde * .55 + corde * .52]) };
    }
    const m = { geo, geoC, helices, r, lg };
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
    corps.position.y = md.r * 1.5;
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
  const geoVeh = {};
  function creerVehicule(u){
    if(!geoVeh[u.type]){ const pc = MODELES_V[u.type](); pc.push({ f:'cyl', d:[.45, .45, 2.6, 8], p:[0, .45, 2], r:[0, 0, Math.PI / 2], c:0x1E2430 }, { f:'cyl', d:[.45, .45, 2.6, 8], p:[0, .45, -1.6], r:[0, 0, Math.PI / 2], c:0x1E2430 }); geoVeh[u.type] = { g:fusion(pc), c:fusion(pc, .07) }; }
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
    const tr = Pl.trajets[v.porte], u = v.duree > 0 ? clamp((t - v.t0) / v.duree, 0, 1) : 1;
    // au poste, le nez touche la ligne d'arrêt quelle que soit la longueur de l'avion
    const g = A.portes[v.porte], dNez = ({ S:36, M:45, L:67, XL:74 })[g.taille] / 2 - M.AVIONS[v.avion].longueur / 2;
    const sur = (trj, s) => M.surTrajet(trj, s);
    switch(v.etat){
      case 'approche': {
        // la descente vers la piste (pente d'environ 4°), d'autant plus loin qu'il reste du temps
        const reste = Math.max(0, v.t0 + v.duree - t), d = reste * 420, x = tr.toucher - d;
        return { x, y:d * .07, z:Pl.piste.z, cap:0, tangage:.05 };
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
        return { x:p0.x + dist, y, z:Pl.piste.z, cap:0, tangage:tt > .85 ? Math.min(.2, (tt - .85) * .45) : 0 };
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
  function grilleT(A, Pl){
    const T = Pl.terminal, l = A.terminal.l, h = A.terminal.h, pw = (T.x1 - T.x0 - 2 * MARGE_X) / l, pd = (T.z1 - T.z0 - MARGE_Z - JETEE) / h;
    return { T, l, h, pw, pd, cw:pw - ALLEE, cd:pd - ALLEE, centre:(x, y) => ({ x:T.x1 - MARGE_X - (x + .5) * pw, z:T.z1 - MARGE_Z - (y + .5) * pd }),
      quart:(x, y) => ({ x:T.x1 - MARGE_X - (x + .5) * pw / 2, z:T.z1 - MARGE_Z - (y + .5) * pd / 2 }) };
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
  const agent = (x, z, c, e) => [{ f:'cyl', d:[.32 * e, .4 * e, 1.25 * e, 8], p:[x, .95 * e, z], c }, { f:'boule', d:[.27 * e, 1], p:[x, 1.85 * e, z], c:PEAU }, { f:'cyl', d:[.3 * e, .3 * e, .12 * e, 8], p:[x, 2.1 * e, z], c }];
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
    }
    return p;
  }
  function construireInterieur(A, Pl){
    const cle = A.terminal.l + 'x' + A.terminal.h + ':' + A.terminal.modules.map(m => m.type + m.x + m.y + m.niv).join(',') + '|' + (A.terminal.petits || []).map(p => p.type + p.x + '.' + p.y).join(',') + '|' + A.portes.map(g => g.nom + g.taille + (g.passerelle ? 'p' : '')).join(',');
    if(cle === cleInt && interieur) return;
    cleInt = cle;
    if(interieur){ monde.remove(interieur); interieur.traverse(o => { if(o.geometry) o.geometry.dispose(); }); }
    const G = grilleT(A, Pl), pieces = [], sol = [];
    // le carrelage, la ligne jaune de la sûreté (entre la rangée côté ville et le reste)
    // les allées (un sol clair et chaud) et le carrelage de chaque case
    sol.push({ f:'boite', d:[G.T.x1 - G.T.x0 - 2 * MARGE_X + 2, .08, G.pd * G.h + 2], p:[(G.T.x0 + G.T.x1) / 2, .52, G.T.z1 - MARGE_Z - G.pd * G.h / 2], c:0xF1ECE2 });
    for(let x = 0; x < G.l; x++) for(let y = 0; y < G.h; y++){ const c = G.centre(x, y); sol.push({ f:'boite', d:[G.cw + .6, .1, G.cd + .6], p:[c.x, .55, c.z], c:(x + y) % 2 ? 0xE9EDF2 : 0xDDE3EA }); }
    sol.push({ f:'boite', d:[G.T.x1 - G.T.x0 - 2 * MARGE_X, .12, .6], p:[(G.T.x0 + G.T.x1) / 2, .62, G.T.z1 - MARGE_Z - G.pd], c:0xFFB703 });
    // les petits objets, dans leur petite case
    for(const q of A.terminal.petits || []){ const c = G.quart(q.x, q.y); for(const o of petitObjet(q.type, ECH_P)){ o.p = [o.p[0] + c.x, o.p[1] + .6, o.p[2] + c.z]; pieces.push(o); } }
    for(const m of A.terminal.modules){
      const c = G.centre(m.x, m.y);
      sol.push({ f:'boite', d:[G.cw - 1.2, .12, G.cd - 1.2], p:[c.x, .64, c.z], c:clair(M.MODULES[m.type].coul) });
      for(const q of mobilier(m.type, m.niv, G.cw, G.cd)){ q.p = [q.p[0] + c.x, q.p[1] + .65, q.p[2] + c.z]; pieces.push(q); }
    }
    interieur = new T3.Group();
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
  function preparerFoule(){
    if(foule) return;
    const corps = fusion([{ f:'cyl', d:[.32, .42, 1.25, 8], p:[0, .95, 0] }, { f:'cyl', d:[.14, .14, .7, 5], p:[-.16, .35, 0] }, { f:'cyl', d:[.14, .14, .7, 5], p:[.16, .35, 0] }]);
    const tete = fusion([{ f:'boule', d:[.27, 1], p:[0, 1.85, 0] }]);
    foule = new T3.InstancedMesh(corps, toon({}), MAX_AG); tetes = new T3.InstancedMesh(tete, toon({}), MAX_AG);
    foule.instanceMatrix.setUsage(T3.DynamicDrawUsage); tetes.instanceMatrix.setUsage(T3.DynamicDrawUsage);
    const c = new T3.Color();
    for(let i = 0; i < MAX_AG; i++){ foule.setColorAt(i, c.set(COUL_P[i % COUL_P.length])); tetes.setColorAt(i, c.set(PEAUX[(i * 7) % PEAUX.length])); }
    foule.count = tetes.count = 0; foule.frustumCulled = tetes.frustumCulled = false;
    scene.add(foule, tetes);
  }
  const AIRSIDE = ['salle', 'cafe', 'boutique', 'restaurant', 'salon', 'jeux', 'fontaine', 'plantes', 'toilettes'];
  function nouvelAgent(role, x, z){ const a = { role, x, z, tx:x, tz:z, attente:0, pas:Math.random() * 6, id:Math.floor(Math.random() * MAX_AG) }; agents.push(a); return a; }
  function entree(G){ return { x:G.T.x0 + 12 + Math.random() * (G.T.x1 - G.T.x0 - 24), z:G.T.z1 - 1.5 }; }
  function placeFile(A, G, type, rang){
    const ms = A.terminal.modules.filter(m => m.type === type);
    if(!ms.length){
      // pas de guichet : on attend en paquet, juste après la sûreté (ou près de l'entrée)
      const sec = A.terminal.modules.find(m => m.type === 'securite'), c = sec ? G.centre(sec.x, sec.y) : { x:(G.T.x0 + G.T.x1) / 2, z:G.T.z1 - 8 };
      return { x:c.x + ((rang % 8) - 3.5) * 1.6, z:c.z - G.cd * .5 - 1.5 - Math.floor(rang / 8) * 1.6 };
    }
    const m = ms[rang % ms.length], j = Math.floor(rang / ms.length), c = G.centre(m.x, m.y);
    // la file part du comptoir (ou du portique) vers le côté ville, en serpentin entre les sangles
    // quand la file est trop longue pour la place qu'il y a (jusqu'aux portes côté ville), un deuxième serpentin s'ouvre à côté
    const base = c.z + baseFile(type, G.cd), maxR = Math.max(2, Math.floor((G.T.z1 - 3 - base) / FILE_PAS_Z) + 1);
    const rangee = Math.floor(j / 5), k = j % 5, bloc = Math.floor(rangee / maxR), q = posFile(type, G.cd, rangee % maxR, k);
    const dx = bloc ? Math.ceil(bloc / 2) * (bloc % 2 ? 1 : -1) * (5 * FILE_PAS_X + 1.2) : 0;
    return { x:c.x + q.x + dx, z:c.z + q.z };
  }
  function placeAttente(A, G){
    const ms = A.terminal.modules.filter(m => AIRSIDE.includes(m.type));
    if(!ms.length){ const y = G.h - 1 - Math.floor(Math.random() * Math.max(1, G.h - 1)); const c = G.centre(Math.floor(Math.random() * G.l), y); return { x:c.x + (Math.random() - .5) * G.cw * .8, z:c.z + (Math.random() - .5) * G.cd * .8 }; }
    const m = ms[Math.floor(Math.random() * ms.length)], c = G.centre(m.x, m.y);
    return { x:c.x + (Math.random() - .5) * G.cw * .75, z:c.z + (Math.random() - .5) * G.cd * .75 };
  }
  // un point au hasard dans une construction de ce type (de l'autre côté de la file)
  function placeModule(A, G, type, frac){
    const ms = A.terminal.modules.filter(m => m.type === type); if(!ms.length) return entree(G);
    const m = ms[Math.floor(Math.random() * ms.length)], c = G.centre(m.x, m.y);
    return { x:c.x + (Math.random() - .5) * G.cw * .6, z:c.z - G.cd * frac + (Math.random() - .5) * 2 };
  }
  function placeTapis(A, G){
    const ms = A.terminal.modules.filter(m => m.type === 'tapis'); if(!ms.length) return entree(G);
    const m = ms[Math.floor(Math.random() * ms.length)], c = G.centre(m.x, m.y), a = Math.random() * Math.PI * 2, r = Math.min(G.cw, G.cd) * (.36 + Math.random() * .08);
    return { x:c.x + Math.cos(a) * r, z:c.z + Math.sin(a) * r };
  }
  const versPorte = (Pl, G, i) => ({ x:clamp(Pl.postes[i] ? Pl.postes[i].cx : (G.T.x0 + G.T.x1) / 2, G.T.x0 + 4, G.T.x1 - 4), z:G.T.z0 + 1.5 });
  function majFoule(A, Pl, dtReel){
    const G = grilleT(A, Pl), ca = A.capAffiche || { check:0, secu:0, airside:0 };
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
    while(files.secu.length > voulu.secu){ const a = files.secu.shift(); if(files.pass.length < voulu.pass){ a.role = 'pass'; files.pass.push(a); } else { a.role = 'attente'; const p = placeAttente(A, G); a.tx = p.x; a.tz = p.z; } }
    while(files.pass.length > voulu.pass){ const a = files.pass.shift(); a.role = 'attente'; const p = placeAttente(A, G); a.tx = p.x; a.tz = p.z; }
    let n = compte('attente');
    // des nouveaux arrivent par les portes côté ville
    while(files.check.length < voulu.check && agents.length < MAX_AG){ const e = entree(G), a = nouvelAgent('check', e.x, e.z); files.check.push(a); }
    while(files.secu.length < voulu.secu && agents.length < MAX_AG){ const e = entree(G), a = nouvelAgent('secu', e.x, e.z); files.secu.push(a); }
    while(files.pass.length < voulu.pass && agents.length < MAX_AG){ const e = entree(G), a = nouvelAgent('pass', e.x, e.z); files.pass.push(a); }
    while(n < voulu.attente && agents.length < MAX_AG){ const e = entree(G), a = nouvelAgent('attente', e.x, e.z); const p = placeAttente(A, G); a.tx = p.x; a.tz = p.z; n++; }
    // l'embarquement : ceux en trop partent vers la porte de l'avion qui embarque
    if(n > voulu.attente){
      const emb = A.vols.filter(v => v.etat === 'escale' && v.taches && v.taches.embarquement && v.taches.embarquement.etat === 'encours');
      let trop = n - voulu.attente;
      for(const a of agents){ if(trop <= 0) break; if(a.role !== 'attente') continue; a.role = 'part'; const v = emb.length ? emb[Math.floor(Math.random() * emb.length)] : null; const p = versPorte(Pl, G, v ? v.porte : Math.floor(Math.random() * Pl.postes.length)); a.tx = p.x + (Math.random() - .5) * 4; a.tz = p.z; trop--; }
    }
    // l'arrivée : les passagers qui débarquent entrent par leur porte et vont chercher leurs bagages
    for(const v of A.vols){
      if(v.etat !== 'escale' || !v.taches || !v.taches.debarquement) continue;
      const voulus = Math.round((v.taches.debarquement.fait || 0) / k / 1.5);
      v._vus = v._vus || 0;
      while(v._vus < voulus && agents.length < MAX_AG){ const p = versPorte(Pl, G, v.porte), dou = v.intl && A.terminal.modules.some(m => m.type === 'douane'), a = nouvelAgent(dou ? 'douane' : 'arrivee', p.x + (Math.random() - .5) * 4, p.z); const t = dou ? placeModule(A, G, 'douane', .3) : placeTapis(A, G); a.tx = t.x; a.tz = t.z; a.attente = dou ? .8 + Math.random() * 1.5 : 2 + Math.random() * 5; v._vus++; }
    }
    // les files se rangent
    files.check.forEach((a, i) => { const p = placeFile(A, G, 'comptoir', i); a.tx = p.x; a.tz = p.z; });
    files.secu.forEach((a, i) => { const p = placeFile(A, G, 'securite', i); a.tx = p.x; a.tz = p.z; });
    files.pass.forEach((a, i) => { const p = placeFile(A, G, 'passeports', i); a.tx = p.x; a.tz = p.z; });
    // marcher
    for(let i = agents.length - 1; i >= 0; i--){
      const a = agents[i], dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz), pas = vitesse * dtReel;
      if(d > pas){ a.x += dx / d * pas; a.z += dz / d * pas; a.cap = Math.atan2(dx, dz); a.pas += dtReel * 9; a.marche = true; continue; }
      a.x = a.tx; a.z = a.tz; a.marche = false;
      if(a.role === 'part' || a.role === 'sortie'){ agents.splice(i, 1); continue; }
      // l'arrivée : la douane (pour les vols internationaux), puis le tapis à bagages, puis la sortie
      if(a.role === 'douane'){ a.attente -= dtReel * Math.max(.3, ratio); if(a.attente <= 0){ a.role = 'arrivee'; const t = placeTapis(A, G); a.tx = t.x; a.tz = t.z; a.attente = 2 + Math.random() * 5; } continue; }
      if(a.role === 'arrivee'){ a.attente -= dtReel * Math.max(.3, ratio); if(a.attente <= 0){ a.role = 'sortie'; const e = entree(G); a.tx = e.x; a.tz = e.z + 2; } continue; }
      // dans la salle d'attente, on se promène un peu (boutiques, café)
      if(a.role === 'attente' && vitesse > 0 && Math.random() < dtReel * .08){ const p = placeAttente(A, G); a.tx = p.x; a.tz = p.z; }
    }
    // dessiner
    const m = new T3.Matrix4(), q = new T3.Quaternion(), sc = new T3.Vector3(ECH_P, ECH_P, ECH_P), pos = new T3.Vector3(), eY = new T3.Euler();
    let c = 0;
    for(const a of agents){
      if(c >= MAX_AG) break;
      const saut = a.marche ? Math.abs(Math.sin(a.pas)) * .25 : 0;
      pos.set(a.x, .65 + saut, a.z); eY.set(0, a.cap || 0, 0); q.setFromEuler(eY); m.compose(pos, q, sc);
      foule.setMatrixAt(c, m); tetes.setMatrixAt(c, m); c++;
    }
    foule.count = tetes.count = c;
    foule.instanceMatrix.needsUpdate = tetes.instanceMatrix.needsUpdate = true;
  }
  // regarder dans l'aérogare : quand on zoome assez, le toit s'enlève et la foule apparaît
  function majInterieur(A, Pl, dtReel){
    preparerFoule(); construireInterieur(A, Pl);
    const T = Pl.terminal, dedans = vue.dist < 470 && vue.x > T.x0 - 260 && vue.x < T.x1 + 260;
    if(dedans !== coupe){ coupe = dedans; toit.visible = !dedans; vitres.opacity = dedans ? .28 : 1; vitres.depthWrite = !dedans; }
    interieur.visible = foule.visible = tetes.visible = dedans;
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
  }

  /* ---------- La caméra ---------- */
  function camera(A, Pl, dt = .016){
    if(vue.suivi){
      const a = avions.get(vue.suivi);
      const k = 1 - Math.exp(-dt * 5);
      if(a){ vue.x += (a.obj.position.x - vue.x) * k; vue.z += (a.obj.position.z - vue.z) * k; } else vue.suivi = null;
    }
    const lim = Pl.piste.x1 - Pl.piste.x0;
    vue.x = clamp(vue.x, Pl.piste.x0 - 300, Pl.piste.x1 + 300); vue.z = clamp(vue.z, Pl.piste.z - 300, 200);
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
      const c = a.obj.position.clone(); c.y += a.md.r * 1.5;
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
      return { zone:'case', x:Math.floor(fx), y:Math.floor(fy), qx:Math.floor(fx * 2), qy:Math.floor(fy * 2) };
    }
    if(!r.ray.intersectPlane(new T3.Plane(new T3.Vector3(0, 1, 0), 0), pt)) return null;
    const D = Pl.depot, Cb = Pl.carburant, n = A.carbu ? A.carbu.niv + 1 : 3;
    if(Math.abs(pt.x - D.x) < 30 && Math.abs(pt.z - (D.z + 28)) < 24) return { zone:'depot' };
    for(const hg of Pl.hangars || []) if(Math.abs(pt.x - hg.x) < 24 && Math.abs(pt.z - hg.z) < 16) return { zone:'hangar', hangar:hg.k };
    if(pt.x > Cb.x - 22 && pt.x < Cb.x + (n - 1) * 17 + 14 && Math.abs(pt.z - (Cb.z + 42)) < 22) return { zone:'carburant' };
    if(Math.hypot(pt.x - Pl.tour.x, pt.z - Pl.tour.z) < 14) return { zone:'tour' };
    for(let i = 0; i < Pl.postes.length; i++){ const p = Pl.postes[i]; if(Math.abs(pt.x - p.cx) < p.w / 2 && pt.z < T.z0 && pt.z > p.nezZ - 80) return { zone:'porte', porte:i }; }
    if(Math.abs(pt.z - Pl.piste.z) < 40 && pt.x > Pl.piste.x0 - 20 && pt.x < Pl.piste.x1 + 20) return { zone:'piste' };
    return { zone:'sol' };
  }
  // pendant un placement : les cases (ou petites cases) libres s'allument en vert
  let surb = null, cleSurb = '';
  function surbrillance(A, mode){
    const cle = mode ? mode + ':' + A.terminal.l + ':' + A.terminal.modules.map(m => m.x + '.' + m.y).join(',') + ':' + (A.terminal.petits || []).map(p => p.x + '.' + p.y).join(',') : '';
    if(cle === cleSurb) return; cleSurb = cle;
    if(surb){ scene.remove(surb); surb.geometry.dispose(); surb = null; }
    if(!mode || !ok) return;
    const G = grilleT(A, M.plan(A)), rects = [];
    if(mode === 'module'){ for(let x = 0; x < G.l; x++) for(let y = 0; y < G.h; y++) if(!A.terminal.modules.some(m => m.x === x && m.y === y) && !M.petitsDansCase(A, x, y).length){ const c = G.centre(x, y); rects.push({ f:'boite', d:[G.cw, .1, G.cd], p:[c.x, 1, c.z], c:0x51CF66 }); } }
    else for(let x = 0; x < G.l * 2; x++) for(let y = 0; y < G.h * 2; y++) if(!M.libreQuart(A, x, y)){ const c = G.quart(x, y); rects.push({ f:'boite', d:[G.pw / 2 - .9, .1, G.pd / 2 - .9], p:[c.x, 1, c.z], c:0x51CF66 }); }
    if(!rects.length) return;
    surb = new T3.Mesh(fusion(rects), new T3.MeshBasicMaterial({ vertexColors:true, transparent:true, opacity:.38, depthWrite:false })); surb.renderOrder = 5; scene.add(surb);
  }
  // les outils de dessin, prêtés aux mini-jeux de contrôle (même moteur, même style)
  const kit = () => ok ? { T3, R, objet, fusion, MAT, CONTOUR, get L(){ return L; }, get H(){ return H; } } : null;
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
      const md = modeleAvion(type, comp, livree); objA = new T3.Group(); const c = new T3.Group(); c.add(new T3.Mesh(md.geo, MAT), new T3.Mesh(md.geoC, CONTOUR)); if(md.helices) c.add(creerHelices(md)); c.position.y = md.r * 1.5; objA.add(c); SA.add(objA); cleA = cle;
      objA.userData.lg = md.lg;
    }
    objA.rotation.y = angle;
    const d = objA.userData.lg * 1.05 + 8; CA.position.set(d * .8, d * .38, d * .75); CA.lookAt(0, 2.5, 0);
    RA.render(SA, CA);
  }

  return { init, taille, maj, rendu, choisir, choisirModule, cibler, surbrillance, get coupe(){ return coupe; }, kit, suivre, deplacer, zoomer, tourner, centrer, apercu, vue, get ok(){ return ok; }, get agents(){ return agents.length; }, _debug:() => ({ avions:[...avions].map(([id, a]) => ({ id, x:Math.round(a.obj.position.x), y:Math.round(a.obj.position.y), z:Math.round(a.obj.position.z), vis:a.obj.visible, enfants:a.corps.children.length, dansScene:!!a.obj.parent })), cam:cam.position.toArray().map(Math.round), vue:{ ...vue } }) };
})();
