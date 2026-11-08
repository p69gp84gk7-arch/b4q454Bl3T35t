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
  let monde = null, cleMonde = '', ciel = null, soleil = null, hemi = null, vitres = null, lampes = null, neige = null;
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
    const P = M.plan(A), D = M.AEROPORTS[A.id], cle = A.id + ':' + A.portes.map(g => g.taille + (g.passerelle ? 'p' : '')).join(',');
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
    const ax0 = P.liens[0] - 30, ax1 = P.depot.x + 70;
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
    const bat = [
      { f:'boite', d:[tl, 15, tz], p:[cx, 7.5, cz], c:0xE6E8EC },
      { f:'boite', d:[tl + 4, 1.6, tz + 4], p:[cx, 15.6, cz], c:0x9AA2AE },
      { f:'boite', d:[tl * .6, 5, tz * .5], p:[cx - tl * .1, 18, cz + 4], c:0xD5D9DF },
      { f:'boite', d:[tl * .6 + 1.4, .9, tz * .5 + 1.4], p:[cx - tl * .1, 20.8, cz + 4], c:0x8C949F },
      { f:'boite', d:[tl, 2, 10], p:[cx, 4.5, T.z1 + 5], c:0xBFC5CC },                   // l'auvent côté ville
    ];
    for(let k = 0; k < Math.floor(tl / 40); k++) bat.push({ f:'boite', d:[6, 2.4, 5], p:[T.x0 + 20 + k * 40 + rnd() * 10, 17.6, cz + (rnd() - .5) * 20], c:0xB4BBC4 });
    monde.add(objet(bat, .25));
    // la façade vitrée (elle s'allume la nuit)
    vitres = new T3.MeshToonMaterial({ color:0x3E8EDB, gradientMap:DEGRADE, emissive:0x000000 });
    const ctex = document.createElement('canvas'); ctex.width = 512; ctex.height = 64; const xt = ctex.getContext('2d'); xt.fillStyle = '#fff'; xt.fillRect(0, 0, 512, 64); xt.fillStyle = 'rgba(30,50,80,.55)'; for(let k = 0; k < 512; k += 16) xt.fillRect(k, 0, 2, 64); xt.fillRect(0, 30, 512, 2);
    const tv = new T3.CanvasTexture(ctex); tv.wrapS = T3.RepeatWrapping; tv.repeat.set(tl / 60, 1); vitres.map = tv;
    const facade = new T3.Mesh(new T3.PlaneGeometry(tl - 2, 11), vitres); facade.rotation.y = Math.PI; facade.position.set(cx, 7, T.z0 - .1); monde.add(facade);
    const facade2 = new T3.Mesh(new T3.PlaneGeometry(tl - 2, 8), vitres); facade2.position.set(cx, 6, T.z1 + .1); monde.add(facade2);
    // le nom de l'aéroport sur le toit
    const nom = new T3.Mesh(new T3.PlaneGeometry(Math.min(tl * .55, 160), 18), new T3.MeshBasicMaterial({ map:texte(D.nom.toUpperCase(), 1024, 128, null, '#1B4E8C', 96), transparent:true }));
    nom.rotation.x = -Math.PI / 2; nom.rotation.z = Math.PI; nom.position.set(cx + tl * .18, 16.5, cz - 6); monde.add(nom);
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
    const cuves = []; for(let k = 0; k < 3; k++) cuves.push({ f:'cyl', d:[7, 7, 9, 16], p:[k * 17, 4.5, 0], c:0xF2F2EE }, { f:'cyl', d:[7.2, 7.2, .8, 16], p:[k * 17, 9.2, 0], c:0xC9CED6 });
    const cu = objet(cuves, .2); cu.position.set(P.carburant.x, 0, P.carburant.z + 40); monde.add(cu);
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
      const hp = [];
      for(const s of [1, -1]){ const ex = s * (r + (env / 2) * .22), ez = zAile + corde / 2 + corde * .55 + corde * .52; for(let b = 0; b < 6; b++) hp.push({ f:'boite', d:[.25, r * 1.5, .08], p:[ex, yAile - r * .15, ez], r:[0, 0, b * Math.PI / 3], c:0x22262E }); }
      helices = fusion(hp);
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
    let helices = null; if(md.helices){ helices = new T3.Mesh(md.helices, MAT); corps.add(helices); }
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

  /* ---------- Chaque image ---------- */
  function maj(A, P, dtReel){
    if(!ok) return;
    construire(A);
    const Pl = M.plan(A), t = A.t, mn = M.minuteDe(t);
    lumiere(mn, A.meteo);
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
    for(const [, a] of avions) if(a.helices) a.helices.rotation.z += dtReel * 30;
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
      const md = modeleAvion(type, comp, livree); objA = new T3.Group(); const c = new T3.Group(); c.add(new T3.Mesh(md.geo, MAT), new T3.Mesh(md.geoC, CONTOUR)); if(md.helices) c.add(new T3.Mesh(md.helices, MAT)); c.position.y = md.r * 1.5; objA.add(c); SA.add(objA); cleA = cle;
      objA.userData.lg = md.lg;
    }
    objA.rotation.y = angle;
    const d = objA.userData.lg * 1.05 + 8; CA.position.set(d * .8, d * .38, d * .75); CA.lookAt(0, 2.5, 0);
    RA.render(SA, CA);
  }

  return { init, taille, maj, rendu, choisir, suivre, deplacer, zoomer, tourner, centrer, apercu, vue, get ok(){ return ok; }, _debug:() => ({ avions:[...avions].map(([id, a]) => ({ id, x:Math.round(a.obj.position.x), y:Math.round(a.obj.position.y), z:Math.round(a.obj.position.z), vis:a.obj.visible, enfants:a.corps.children.length, dansScene:!!a.obj.parent })), cam:cam.position.toArray().map(Math.round), vue:{ ...vue } }) };
})();
