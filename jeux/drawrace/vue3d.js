/* Draw Race : la course en 3D (Three.js), en style « dessin animé » (ombrage en tons, contours noirs), comme les autres jeux.
   Un petit diorama vivant : la piste, le décor (arbres, immeubles, eau, tribunes qui s'agitent, drapeaux, nuages, grande roue…),
   des voitures à l'échelle de la piste (une par catégorie), et une caméra qui suit un véhicule toujours de trois quarts.
   Deux vues : « suivi » (caméra de course) et « dessus » (la vue d'ensemble, qui se superpose exactement au dessin du tracé en 2D).
   Repère : x, z = les coordonnées du jeu (x vers la droite, y du jeu vers z) multipliées par S (mètres par unité du jeu) ; y = la hauteur. */
window.DRAWRACE_3D = (() => {
  'use strict';
  const S = .16, LARG = 80 * S, W = 1000 * S, H = 600 * S;       // 1 unité du jeu = 16 cm : la piste fait 12,8 m, une monoplace 4,8 m
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
  let T3 = null, R = null, scene = null, cam = null, ok = false, cv3 = null, DEGRADE = null, CONTOUR = null;
  let monde = null, vue = 'dessus', preset = 0, cw = 1, ch = 1, actif = false, raf = 0, dernier = 0, temps = 0;
  const cam0 = { x:0, z:0, yaw:0, init:true, fov:50 };
  let voitures = new Map(), tags = new Map(), conteneurTags = null, E = { voitures:[], fumee:[], w:0, feux:0, suivre:null, t:0 };
  let anim = { drapeaux:[], nuages:[], roues:[], bateaux:[], foule:null, eau:null, lampes:[], feux:[], pluie:null, particules:null };

  /* ---------- Les formes (comme un dessin) ---------- */
  const toon = o => new T3.MeshToonMaterial(Object.assign({ gradientMap:DEGRADE }, o));
  function geom(f, d, e = 0){
    switch(f){
      case 'boite': return new T3.BoxGeometry(d[0] + 2 * e, d[1] + 2 * e, d[2] + 2 * e);
      case 'cyl': return new T3.CylinderGeometry(d[0] + e, d[1] + e, d[2] + 2 * e, d[3] || 10);
      case 'cone': return new T3.ConeGeometry(d[0] + e, d[1] + 2 * e, d[2] || 8);
      case 'boule': return new T3.IcosahedronGeometry(d[0] + e, d[1] || 0);
      case 'tore': return new T3.TorusGeometry(d[0], d[1] + e, 6, d[2] || 14);
    }
  }
  function matrice(p){
    const q = new T3.Quaternion().setFromEuler(new T3.Euler(...(p.r || [0, 0, 0]), 'YXZ'));
    return new T3.Matrix4().compose(new T3.Vector3(...(p.p || [0, 0, 0])), q, new T3.Vector3(...(p.s || [1, 1, 1])));
  }
  function fusion(pieces, e = 0){
    const pos = [], nor = [], col = [], c = new T3.Color();
    for(const p of pieces){
      let g = geom(p.f, p.d, e); g = g.index ? g.toNonIndexed() : g; g.applyMatrix4(matrice(p));
      const a = g.attributes.position.array, n = g.attributes.normal.array; c.set(p.c ?? 0xffffff);
      for(let i = 0; i < a.length; i += 3){ pos.push(a[i], a[i + 1], a[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]); col.push(c.r, c.g, c.b); }
      g.dispose();
    }
    const out = new T3.BufferGeometry();
    out.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new T3.Float32BufferAttribute(nor, 3)); out.setAttribute('color', new T3.Float32BufferAttribute(col, 3));
    return out;
  }
  // un objet : sa forme colorée et son contour noir (la même forme, un peu plus grosse, vue de l'intérieur)
  function objet(pieces, e = .05, mat = null){
    const gr = new T3.Group();
    gr.add(new T3.Mesh(fusion(pieces), mat || toon({ vertexColors:true })), new T3.Mesh(fusion(pieces, e), CONTOUR));
    return gr;
  }
  const nu = (hex, f) => { const c = new T3.Color(hex); if(f > 0) c.lerp(new T3.Color(0xffffff), f); else c.lerp(new T3.Color(0x000000), -f); return c.getHex(); };

  /* ---------- Les voitures : une par catégorie ---------- */
  const MODELES = {
    f1(c){
      const d = nu(c, -.4), K = 0x1B1B1F, Wh = 0xFFFFFF, P = [];
      P.push({ f:'boite', d:[4.0, .08, 1.5], p:[0, .12, 0], c:K }, { f:'boite', d:[2.4, .46, .62], p:[-.1, .38, 0], c }, { f:'cone', d:[.3, 1.5, 10], p:[1.75, .34, 0], r:[0, 0, -Math.PI / 2], c },
        { f:'boite', d:[1.1, .5, .38], p:[-1.2, .5, 0], c }, { f:'boite', d:[.5, .34, .3], p:[-.05, .78, 0], c:K }, { f:'boule', d:[.19, 1], p:[-.12, .66, 0], c:Wh },
        { f:'tore', d:[.25, .03, 10], p:[.08, .7, 0], r:[Math.PI / 2, 0, 0], c:K }, { f:'boite', d:[2.0, .02, .2], p:[-.1, .62, 0], c:Wh },
        { f:'boite', d:[.55, .07, 1.45], p:[-2.15, .98, 0], c }, { f:'boite', d:[.4, .07, 1.45], p:[-2.05, .82, 0], c:d }, { f:'boite', d:[.12, .5, .1], p:[-2.05, .6, 0], c:K },
        { f:'boite', d:[.5, .06, 1.9], p:[2.2, .14, 0], c }, { f:'boite', d:[.2, .2, .1], p:[1.2, .3, 0], c:K });
      for(const s of [-1, 1]) P.push({ f:'boite', d:[1.5, .4, .5], p:[-.45, .36, .66 * s], c:d }, { f:'boite', d:[.7, .5, .05], p:[-2.15, .75, .74 * s], c:d }, { f:'boite', d:[.55, .2, .05], p:[2.2, .2, .93 * s], c:d },
        { f:'boite', d:[.08, .06, .55], p:[1.55, .3, .7 * s], c:K }, { f:'boite', d:[.08, .06, .55], p:[-1.45, .32, .72 * s], c:K });
      return { L:4.8, pieces:P, roues:[{ x:1.55, z:.98, r:.34, w:.38, av:1 }, { x:1.55, z:-.98, r:.34, w:.38, av:1 }, { x:-1.45, z:1.02, r:.4, w:.5 }, { x:-1.45, z:-1.02, r:.4, w:.5 }], flamme:[-2.35, .55, 0], frein:[-2.45, .85, 0, .9], phares:null };
    },
    rallye(c){
      const d = nu(c, -.4), K = 0x1B1B1F, V = 0x2E3D52, Wh = 0xFFFFFF, J = 0xFFE27A, P = [];
      P.push({ f:'boite', d:[3.9, .6, 1.8], p:[0, .6, 0], c }, { f:'boite', d:[2.0, .5, 1.58], p:[-.15, 1.1, 0], c }, { f:'boite', d:[2.04, .34, 1.6], p:[-.15, 1.1, 0], c:V },
        { f:'boite', d:[1.9, .06, 1.5], p:[-.15, 1.4, 0], c:d }, { f:'boite', d:[.5, .08, 1.7], p:[-1.95, 1.2, 0], c:d }, { f:'boite', d:[.1, .45, .1], p:[-1.9, 1.0, .6], c:K }, { f:'boite', d:[.1, .45, .1], p:[-1.9, 1.0, -.6], c:K },
        { f:'boite', d:[.3, .3, 1.84], p:[1.95, .36, 0], c:K }, { f:'boite', d:[.2, .3, 1.84], p:[-1.95, .36, 0], c:K }, { f:'boite', d:[.3, .02, 1.2], p:[.9, .92, 0], c:d },
        { f:'boite', d:[.1, .16, .34], p:[1.95, .66, .6], c:J }, { f:'boite', d:[.1, .16, .34], p:[1.95, .66, -.6], c:J }, { f:'cyl', d:[.1, .1, .1, 8], p:[.5, 1.5, .5], c:J }, { f:'cyl', d:[.1, .1, .1, 8], p:[.5, 1.5, -.5], c:J }, { f:'cyl', d:[.1, .1, .1, 8], p:[.5, 1.5, .15], c:J }, { f:'cyl', d:[.1, .1, .1, 8], p:[.5, 1.5, -.15], c:J });
      for(const s of [-1, 1]) P.push({ f:'cyl', d:[.28, .28, .03, 12], p:[-.2, .78, .92 * s], r:[Math.PI / 2, 0, 0], c:Wh }, { f:'boite', d:[1.0, .12, .08], p:[1.25, .55, .93 * s], c:d }, { f:'boite', d:[1.0, .12, .08], p:[-1.3, .55, .93 * s], c:d });
      return { L:3.9, pieces:P, roues:[{ x:1.25, z:.88, r:.34, w:.3, av:1 }, { x:1.25, z:-.88, r:.34, w:.3, av:1 }, { x:-1.3, z:.88, r:.34, w:.3 }, { x:-1.3, z:-.88, r:.34, w:.3 }], flamme:[-2.0, .45, 0], frein:[-1.96, .66, 0, 1.5] };
    },
    endurance(c){
      const d = nu(c, -.4), K = 0x1B1B1F, V = 0x25323F, Wh = 0xFFFFFF, P = [];
      P.push({ f:'boite', d:[4.6, .3, 1.7], p:[0, .26, 0], c }, { f:'boite', d:[1.5, .22, 1.3], p:[2.2, .2, 0], c:d }, { f:'boite', d:[2.2, .3, 1.0], p:[-.5, .56, 0], c },
        { f:'boule', d:[.55, 1], p:[.4, .68, 0], s:[1.5, .75, 1.1], c:V }, { f:'boite', d:[1.5, .52, .06], p:[-1.9, .72, 0], c:d }, { f:'boite', d:[.5, .06, 1.9], p:[-2.2, 1.0, 0], c }, { f:'boite', d:[.5, .06, 1.9], p:[2.45, .1, 0], c:K },
        { f:'boite', d:[.8, .1, .9], p:[-.05, .45, 0], c:Wh }, { f:'boite', d:[2.4, .02, .22], p:[-.3, .76, 0], c:Wh });
      for(const s of [-1, 1]) P.push({ f:'boite', d:[1.1, .38, .56], p:[1.5, .42, .98 * s], c:d }, { f:'boite', d:[1.3, .46, .62], p:[-1.55, .48, 1.0 * s], c:d }, { f:'boite', d:[.5, .5, .05], p:[-2.2, .8, .94 * s], c:d });
      return { L:4.9, pieces:P, roues:[{ x:1.5, z:.98, r:.37, w:.4, av:1 }, { x:1.5, z:-.98, r:.37, w:.4, av:1 }, { x:-1.55, z:1.0, r:.4, w:.48 }, { x:-1.55, z:-1.0, r:.4, w:.48 }], flamme:[-2.35, .5, 0], frein:[-2.3, .62, 0, 1.4] };
    },
    tourisme(c){
      const d = nu(c, -.4), K = 0x1B1B1F, V = 0x2B3C52, Wh = 0xFFFFFF, J = 0xFFF1B0, P = [];
      P.push({ f:'boite', d:[4.5, .56, 1.85], p:[0, .5, 0], c }, { f:'boite', d:[2.2, .52, 1.55], p:[-.3, 1.02, 0], c }, { f:'boite', d:[2.25, .34, 1.58], p:[-.3, 1.04, 0], c:V },
        { f:'boite', d:[2.0, .04, 1.5], p:[-.3, 1.3, 0], c:Wh }, { f:'boite', d:[.35, .08, 1.7], p:[-2.2, 1.0, 0], c:d }, { f:'boite', d:[.1, .3, .1], p:[-2.15, .85, .6], c:K }, { f:'boite', d:[.1, .3, .1], p:[-2.15, .85, -.6], c:K },
        { f:'boite', d:[.3, .24, 1.9], p:[2.2, .3, 0], c:K }, { f:'boite', d:[.2, .3, 1.9], p:[-2.2, .34, 0], c:K }, { f:'boite', d:[1.6, .03, .3], p:[1.3, .8, 0], c:Wh });
      for(const s of [-1, 1]) P.push({ f:'boite', d:[.1, .14, .4], p:[2.25, .6, .65 * s], c:J }, { f:'boite', d:[.1, .14, .4], p:[-2.25, .62, .65 * s], c:0xD7263D }, { f:'cyl', d:[.25, .25, .03, 12], p:[-.2, .78, .94 * s], r:[Math.PI / 2, 0, 0], c:Wh });
      return { L:4.5, pieces:P, roues:[{ x:1.4, z:.9, r:.33, w:.27, av:1 }, { x:1.4, z:-.9, r:.33, w:.27, av:1 }, { x:-1.4, z:.9, r:.33, w:.27 }, { x:-1.4, z:-.9, r:.33, w:.27 }], flamme:[-2.35, .4, 0], frein:[-2.26, .64, 0, 1.4] };
    },
  };
  function roue(r, w){
    return objet([{ f:'cyl', d:[r, r, w, 14], r:[Math.PI / 2, 0, 0], c:0x17181C }, { f:'cyl', d:[r * .62, r * .62, w + .03, 12], r:[Math.PI / 2, 0, 0], c:0xB9C0CB }, { f:'cyl', d:[r * .2, r * .2, w + .06, 6], r:[Math.PI / 2, 0, 0], c:0x6F7783 }, { f:'boite', d:[r * 1.1, r * .12, w + .05], c:0x8A919C }], .03);
  }
  function creerVoiture(cat, couleur, fantome){
    const def = (MODELES[cat] || MODELES.f1)(new T3.Color(couleur).getHex());
    const gr = new T3.Group(), corps = new T3.Group();
    const mat = toon({ vertexColors:true });
    const o = objet(def.pieces, .05, mat);
    corps.add(o);
    const roues = def.roues.map(rr => { const g = new T3.Group(), m = roue(rr.r, rr.w); g.add(m); g.position.set(rr.x, rr.r, rr.z); corps.add(g); return { g, m, av:rr.av, r:rr.r }; });
    // l'ombre au sol, la flamme du boost, le feu de freinage
    const ombre = new T3.Mesh(new T3.CircleGeometry(1, 20), new T3.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:.3, depthWrite:false })); ombre.rotation.set(-Math.PI / 2, 0, 0); ombre.scale.set(def.L * .6, def.L * .6 * .42, 1); ombre.position.y = .08;
    const flamme = new T3.Mesh(new T3.ConeGeometry(.28, 1.8, 8), new T3.MeshBasicMaterial({ color:0xFFB020 })); flamme.rotation.z = Math.PI / 2; flamme.position.set(def.flamme[0] - .9, def.flamme[1], 0); flamme.visible = false;
    const frein = new T3.Mesh(new T3.BoxGeometry(.06, .12, def.frein[3] * .4), new T3.MeshBasicMaterial({ color:0x4A0A0A })); frein.position.set(def.frein[0], def.frein[1], 0);
    corps.add(flamme, frein);
    if(fantome){ corps.traverse(m => { if(m.material){ m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = .4; } }); }
    gr.add(ombre, corps);
    // l'équipe du stand (quatre mécaniciens, un cric) : visible pendant l'arrêt
    const equipe = new T3.Group();
    for(let k = 0; k < 4; k++){ const m = objet([{ f:'cyl', d:[.2, .22, .9, 8], p:[0, .45, 0], c:0xD7263D }, { f:'boule', d:[.2, 1], p:[0, 1.05, 0], c:0xFFFFFF }], .03); const sx = k < 2 ? 1 : -1, sz = k % 2 ? 1 : -1; m.position.set(sx * 1.55, 0, sz * 1.55); m.rotation.y = Math.atan2(-sz, -sx); equipe.add(m); }
    equipe.visible = false; gr.add(equipe);
    return { gr, corps, roues, flamme, frein, ombre, equipe, def, cat, couleur, px:null, pz:null, pa:null, vit:0, roulis:0, tangage:0, rot:0, braquage:0 };
  }

  /* ---------- Démarrage ---------- */
  function init(canvas){
    if(ok) return true;
    try{
      T3 = window.THREE; if(!T3) return false;
      cv3 = canvas;
      R = new T3.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance', alpha:false });
      R.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
      const d = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
      DEGRADE = new T3.DataTexture(d, 3, 1, T3.RGBAFormat); DEGRADE.minFilter = DEGRADE.magFilter = T3.NearestFilter; DEGRADE.needsUpdate = true;
      CONTOUR = new T3.MeshBasicMaterial({ color:0x15121F, side:T3.BackSide });
      cam = new T3.PerspectiveCamera(30, 1, .3, 900);
      ok = true;
    }catch(e){ ok = false; }
    return ok;
  }
  function taille(w, h){ if(!ok) return; cw = Math.max(2, w); ch = Math.max(2, h); R.setSize(cw, ch, false); cam.aspect = cw / ch; cam.updateProjectionMatrix(); }

  /* ---------- Le monde : le sol, la piste, le décor ---------- */
  const SOL3D = { parc:0x8CCB5A, campagne:0xA2CE5C, collines:0xBDB45E, foret:0x6DB35A, sapins:0x66A862, desert:0xD9B66A, dunes:0xD8BB78, ville:0x8E947F, nuit:0x2C3758, japon:0x92D26C, fleuve:0x88C95F, lac:0x8ECC63, mer:0xD6C792, montagne:0x7DAF6E, prairie:0xC9B85C, neige:0xDCE6F5, savane:0xCBA55A };
  function ruban(pts, nor, o0, o1, y, couleur, n){          // une bande le long de la piste (de o0 à o1 de chaque côté de la ligne centrale)
    const pos = [], col = [], idx = [], c = new T3.Color();
    for(let i = 0; i <= n; i++){
      const k = i % n, p = pts[k], v = nor[k]; c.set(typeof couleur === 'function' ? couleur(k) : couleur);
      pos.push((p[0] + v[0] * o0) * S, y, (p[1] + v[1] * o0) * S, (p[0] + v[0] * o1) * S, y, (p[1] + v[1] * o1) * S); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if(i < n){ const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T3.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    for(let i = 0; i < g.attributes.normal.count; i++) g.attributes.normal.setXYZ(i, 0, 1, 0);
    return g;
  }
  function bandeSeg(pts, nor, i0, i1, o0, o1, y, couleur, n, hauteur){   // un morceau (vibreur, mur) entre deux indices
    const pos = [], col = [], idx = [], c = new T3.Color(); let k = 0;
    for(let i = i0; i <= i1; i++){
      const m = ((i % n) + n) % n, p = pts[m], v = nor[m]; c.set(typeof couleur === 'function' ? couleur(i - i0) : couleur);
      pos.push((p[0] + v[0] * o0) * S, y, (p[1] + v[1] * o0) * S, (p[0] + v[0] * o1) * S, y, (p[1] + v[1] * o1) * S); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if(i < i1){ const a = k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } k++;
    }
    const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T3.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  const meshV = (g, o = {}) => new T3.Mesh(g, toon(Object.assign({ vertexColors:true, side:T3.DoubleSide }, o)));
  function charger(D){
    if(!ok) return;
    if(scene){ scene.traverse(o => { if(o.geometry) o.geometry.dispose(); }); }
    scene = new T3.Scene(); monde = D; voitures = new Map(); tags.forEach(t => t.remove()); tags = new Map(); cam0.init = true;
    anim = { drapeaux:[], nuages:[], roues:[], bateaux:[], foule:null, eau:null, lampes:[], feux:[], pluie:null, particules:null, vibre:[] };
    const nuit = !!D.nuit, n = D.pts.length;
    // le ciel, le brouillard, les lumières
    const dome = new T3.Mesh(new T3.SphereGeometry(420, 24, 12), new T3.MeshBasicMaterial({ vertexColors:true, side:T3.BackSide, fog:false }));
    { const p = dome.geometry.attributes.position, c = []; const haut = new T3.Color(nuit ? 0x0B1230 : 0x4FA2EE), bas = new T3.Color(nuit ? 0x2A3566 : 0xD6EEFF), tmp = new T3.Color();
      for(let i = 0; i < p.count; i++){ tmp.copy(bas).lerp(haut, clamp(p.getY(i) / 260, 0, 1)); c.push(tmp.r, tmp.g, tmp.b); } dome.geometry.setAttribute('color', new T3.Float32BufferAttribute(c, 3)); }
    scene.add(dome); anim.dome = dome;
    scene.fog = new T3.Fog(nuit ? 0x1B2448 : 0xCBE6FF, 140, 420); anim.fog = scene.fog;
    anim.hemi = new T3.HemisphereLight(nuit ? 0x8FA2E0 : 0xFFFFFF, nuit ? 0x1C2240 : 0xA89C70, nuit ? .55 : .8); scene.add(anim.hemi);
    anim.soleil = new T3.DirectionalLight(nuit ? 0x9FB4FF : 0xFFF2D6, nuit ? .35 : .85); anim.soleil.position.set(-60, 120, 40); scene.add(anim.soleil);
    // le diorama : un bloc de terrain posé sur un socle
    const sol = SOL3D[D.decor] || 0x8CCB5A, plan = new T3.PlaneGeometry(W, H, 50, 30); plan.rotateX(-Math.PI / 2); plan.translate(W / 2, 0, H / 2);
    { const p = plan.attributes.position, c = [], base = new T3.Color(sol), t = new T3.Color(); for(let i = 0; i < p.count; i++){ const x = p.getX(i), z = p.getZ(i), v = Math.sin(x * .21) * Math.sin(z * .17) + Math.sin(x * .07 + z * .09) * .8; t.copy(base).offsetHSL(0, 0, v * .018); c.push(t.r, t.g, t.b); } plan.setAttribute('color', new T3.Float32BufferAttribute(c, 3)); }
    anim.sol = new T3.Mesh(plan, toon({ vertexColors:true })); scene.add(anim.sol);
    const cote = new T3.Mesh(new T3.BoxGeometry(W + 1.6, 7, H + 1.6), toon({ color:nu(sol, -.45) })); cote.position.set(W / 2, -3.58, H / 2); scene.add(cote);
    const strate = new T3.Mesh(new T3.BoxGeometry(W + 2.2, 2.2, H + 2.2), toon({ color:0x6B4A2E })); strate.position.set(W / 2, -2.1, H / 2); scene.add(strate);
    const socle = new T3.Mesh(new T3.CylinderGeometry(300, 300, 4, 40), toon({ color:nuit ? 0x20294A : 0x9FCBF2 })); socle.position.set(W / 2, -10, H / 2); scene.add(socle);
    // la piste : bord foncé, revêtement (par sol au rallye), marquages
    const nor = D.nor, pts = D.pts;
    scene.add(meshV(ruban(pts, nor, -(80 + 12) / 2, (80 + 12) / 2, .03, D.rallye ? (i => D.solBord[i]) : 0x232328, n)));
    const bit = new T3.Color(D.bitume || 0x77757A);
    scene.add(meshV(ruban(pts, nor, -40, 40, .045, D.rallye ? (i => D.solCoul[i]) : (i => { const t = bit.clone(); t.offsetHSL(0, 0, Math.sin(i * .45) * .006); return t; }), n)));
    if(D.rallye){ for(const d of [-15, 15]) scene.add(meshV(ruban(pts, nor, d - 4.5, d + 4.5, .05, i => D.solOrn[i], n))); }
    else { for(const d of [-37, 37]) scene.add(meshV(ruban(pts, nor, d - .7, d + .7, .055, 0xF2F2F2, n))); }
    if(!D.rallye){ const dash = []; for(let i = 0; i < n; i += 5) dash.push(bandeSeg(pts, nor, i, Math.min(i + 2, n), -1, 1, .056, 0xF2F2F2, n)); const gg = new T3.BufferGeometry(); const parts = dash; // fusion simple
      const pos = [], col = [], idx = []; let off = 0; for(const g of parts){ const p = g.attributes.position.array, c = g.attributes.color.array, ix = g.index.array; for(let i = 0; i < p.length; i++){ pos.push(p[i]); col.push(c[i]); } for(const k of ix) idx.push(k + off); off += p.length / 3; }
      gg.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); gg.setAttribute('color', new T3.Float32BufferAttribute(col, 3)); gg.setIndex(idx); gg.computeVertexNormals(); scene.add(meshV(gg)); }
    // les vibreurs rouge et blanc, des deux côtés des virages
    for(const cotePiste of [-1, 1]){
      const bit2 = cotePiste > 0 ? 2 : 1; let deb = -1;
      for(let i = 0; i <= n; i++){
        const ok2 = i < n && (D.vibC[i] & bit2);
        if(ok2 && deb < 0) deb = i; else if(!ok2 && deb >= 0){ if(i - deb > 3){ const dk = (80 / 2 - 2) * cotePiste; scene.add(meshV(bandeSeg(pts, nor, deb, i - 1, dk - 5, dk + 5, .07, k => (Math.floor(k / 3) % 2 ? 0xD7263D : 0xFFFFFF), n))); } deb = -1; }
      }
    }
    // la ligne de départ en damier
    { const [sx, sy] = pts[0], a = D.cap[0], nx = -Math.sin(a), ny = Math.cos(a), dx = Math.cos(a), dy = Math.sin(a), cases = 8, t = 80 / cases, pos = [], col = [], idx = [], c = new T3.Color(); let k = 0;
      for(let r = 0; r < 2; r++) for(let q = 0; q < cases; q++){ const o2 = -40 + q * t; c.set((q + r) % 2 ? 0x1F1F1F : 0xFFFFFF);
        const x0 = sx + nx * o2 + dx * (r - 1) * t, y0 = sy + ny * o2 + dy * (r - 1) * t;
        [[0, 0], [t, 0], [t, t], [0, t]].forEach(([u, v]) => { pos.push((x0 + nx * u + dx * v) * S, .075, (y0 + ny * u + dy * v) * S); col.push(c.r, c.g, c.b); }); idx.push(k, k + 1, k + 2, k, k + 2, k + 3); k += 4; }
      const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T3.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); scene.add(meshV(g)); }
    // le rallye : talus de terre ou murs de neige le long de la piste
    if(D.rallye){ const hauts = []; for(const cp of [-1, 1]){ const dk = 40 * cp; scene.add(meshV(ruban(pts, nor, dk + 1 * cp, dk + 7 * cp, .1, i => D.solTalus[i], n)));
      let deb = 0; for(let i = 1; i <= n; i++){ if(i === n || D.sol[i] !== D.sol[deb]){ if(D.sol[deb] === 'neige' || D.sol[deb] === 'terre') hauts.push([deb, i - 1, cp, D.sol[deb]]); deb = i; } } }
      for(const [a, b, cp, s] of hauts){ const dk = 42 * cp; scene.add(meshV(bandeSeg(pts, nor, a, b, dk, dk + 5 * cp, s === 'neige' ? .9 : .6, s === 'neige' ? 0xF4F9FF : 0x8A6238, n))); } }
    // l'eau, avec sa plage
    if(D.eau.length){ const sab = [], eau = []; const e1 = (PAS * .95 + 5) * S, e2 = PAS * .8 * S;     // des disques qui se recouvrent : un bord arrondi, pas des carrés
      for(const [x, y] of D.eau){ sab.push({ f:'cyl', d:[e1, e1, .04, 10], p:[x * S, .02, y * S], c:D.eauType === 'lac' || D.eauType === 'autour' ? 0x9FBF74 : 0xE3D49C }); eau.push({ f:'cyl', d:[e2, e2, .07, 10], p:[x * S, .04, y * S], c:0x4CA4D6 }); }
      scene.add(new T3.Mesh(fusion(sab), toon({ vertexColors:true }))); anim.eau = new T3.Mesh(fusion(eau), toon({ vertexColors:true })); scene.add(anim.eau); }
    // le décor : tous les objets fusionnés en un seul maillage
    const pieces = [], rnd = alea(D.id || 'x');
    const poser = (o, tx, tz, sc, rot, list) => { for(const p of list){ const q = Object.assign({}, p); q.p = [tx + (p.p[0] * Math.cos(rot) + p.p[2] * Math.sin(rot)) * sc, p.p[1] * sc, tz + (-p.p[0] * Math.sin(rot) + p.p[2] * Math.cos(rot)) * sc];
        q.s = [(p.s ? p.s[0] : 1) * sc, (p.s ? p.s[1] : 1) * sc, (p.s ? p.s[2] : 1) * sc]; q.r = [(p.r ? p.r[0] : 0), (p.r ? p.r[1] : 0) + rot, (p.r ? p.r[2] : 0)]; pieces.push(q); } };
    const ENV = 2.1;
    for(const ob of D.objets){
      const x = ob.x * S, z = ob.y * S, r = ob.r * S * ENV, rot = rnd() * 6.28;
      if(ob.t === 'bateau'){ const b = objet(BAT(), .05); b.position.set(x, 0, z); b.rotation.y = rot; b.scale.setScalar(1.6); scene.add(b); anim.bateaux.push({ g:b, ph:rnd() * 6 }); continue; }
      if(ob.t === 'roue'){ const gr = new T3.Group(), fixe = objet(ROUE_PIED(), .05), tourne = objet(ROUE_TOUR(), .05); gr.add(fixe); tourne.position.y = 10.5; gr.add(tourne); gr.position.set(x, 0, z); gr.rotation.y = rot; gr.scale.setScalar(1.2); scene.add(gr); anim.roues.push(tourne); continue; }
      const f = FORMES[ob.t]; if(!f) continue; poser(ob, x, z, r, rot, f(rnd, D));
    }
    for(const ch of D.champs){ pieces.push({ f:'boite', d:[ch.w * S, .12, ch.h * S], p:[ch.x * S, .06, ch.y * S], r:[0, -ch.rot, 0], c:ch.col }); for(let l = -ch.w / 2 + 5; l < ch.w / 2 - 2; l += 7) pieces.push({ f:'boite', d:[.25, .16, (ch.h - 4) * S], p:[ch.x * S + Math.cos(ch.rot) * l * S, .08, ch.y * S + Math.sin(ch.rot) * l * S], r:[0, -ch.rot, 0], c:nu(ch.col, -.18) }); }
    // les tribunes, les stands, les lampadaires, l'arche de départ, les barrières
    construireTribunes(D, pieces, rnd); construireLampes(D, pieces); construireDepart(D, pieces);
    if(pieces.length){ const g1 = fusion(pieces), g2 = fusion(pieces, .09); scene.add(new T3.Mesh(g1, toon({ vertexColors:true })), new T3.Mesh(g2, CONTOUR)); }
    // les nuages
    for(let k = 0; k < 9 && !nuit; k++){ const nug = objet([0, 1, 2].map(j => ({ f:'boule', d:[5 + rnd() * 4, 1], p:[(j - 1) * 6, rnd() * 2, rnd() * 3], s:[1.3, .7, 1], c:0xFFFFFF })), .1, toon({ vertexColors:true, fog:false })); nug.position.set(rnd() * W, 48 + rnd() * 25, rnd() * H); scene.add(nug); anim.nuages.push({ g:nug, v:1.2 + rnd() * 1.5 }); }
    // les particules (fumée, poussière) et la pluie
    anim.pool = []; const part = new T3.InstancedMesh(new T3.IcosahedronGeometry(1, 1), new T3.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:.6, depthWrite:false }), 160); part.frustumCulled = false; part.count = 0; scene.add(part); anim.particules = part;
    { const N = 700, pos = new Float32Array(N * 6); const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.BufferAttribute(pos, 3)); const l = new T3.LineSegments(g, new T3.LineBasicMaterial({ color:0xDCE8F8, transparent:true, opacity:.7, fog:false })); l.frustumCulled = false; l.visible = false; scene.add(l); anim.pluie = l; anim.pluieN = N; anim.gouttes = Array.from({ length:N }, () => [rnd() * 60 - 30, rnd() * 30, rnd() * 60 - 30]); }
  }
  const PAS = 10;
  function alea(txt){ let h = 2166136261; for(const c of String(txt)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ h >>> 15, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
  // les arbres et le reste : des listes de pièces en unités locales (le rayon vaut 1), posées par charger()
  const BAT = () => [{ f:'boite', d:[3, .5, 1.1], p:[0, .25, 0], c:0xFFFFFF }, { f:'cone', d:[.6, 1.4, 4], p:[1.8, .25, 0], r:[0, 0, -Math.PI / 2], c:0xFFFFFF }, { f:'boite', d:[1, .6, .8], p:[-.3, .8, 0], c:0x3B8FD6 }, { f:'cyl', d:[.04, .04, 2.2, 5], p:[.5, 1.7, 0], c:0x6B4A2E }, { f:'boite', d:[.05, 1.5, 1], p:[.55, 1.9, 0], c:0xFFF3D6 }];
  const ROUE_PIED = () => [{ f:'boite', d:[.5, 10, .5], p:[-3, 5, 2.2], r:[0, 0, .3], c:0x666C78 }, { f:'boite', d:[.5, 10, .5], p:[3, 5, 2.2], r:[0, 0, -.3], c:0x666C78 }, { f:'boite', d:[.5, 10, .5], p:[-3, 5, -2.2], r:[0, 0, .3], c:0x666C78 }, { f:'boite', d:[.5, 10, .5], p:[3, 5, -2.2], r:[0, 0, -.3], c:0x666C78 }];
  const ROUE_TOUR = () => { const P = [{ f:'tore', d:[8, .35, 28], c:0xEEEEEE }, { f:'tore', d:[8, .35, 28], p:[0, 0, 1.2], c:0xEEEEEE }, { f:'cyl', d:[.8, .8, 1.6, 10], r:[Math.PI / 2, 0, 0], p:[0, 0, .6], c:0xF2C230 }];
    for(let k = 0; k < 12; k++){ const a = k / 12 * Math.PI * 2; P.push({ f:'boite', d:[16, .2, .2], p:[0, 0, .6], r:[0, 0, a], c:0xDDDDDD }, { f:'boite', d:[1.4, 1.2, 1.6], p:[Math.cos(a) * 8, Math.sin(a) * 8 - .8, .6], c:[0xE3242B, 0xF2C230, 0x1B6FD8][k % 3] }); } return P; };
  const arbreCouleurs = [0x5FB04B, 0x6CBF55, 0x4FA044, 0x78C95A];
  const FORMES = {
    arbre:(rnd) => { const c = arbreCouleurs[Math.floor(rnd() * 4)]; return [{ f:'cyl', d:[.14, .2, 1.0, 6], p:[0, .5, 0], c:0x7A5230 }, { f:'boule', d:[.8, 1], p:[0, 1.5, 0], s:[1, 1.05, 1], c }, { f:'boule', d:[.5, 1], p:[.3, 2.0, .1], c:nu(c, .12) }]; },
    buisson:(rnd) => [{ f:'boule', d:[.7, 1], p:[0, .45, 0], s:[1, .7, 1], c:0x7FBF55 }, { f:'boule', d:[.45, 1], p:[.5, .3, .2], c:0x91CC66 }],
    acacia:() => [{ f:'cyl', d:[.1, .16, 1.3, 6], p:[0, .65, 0], c:0x7A5230 }, { f:'boule', d:[1.1, 1], p:[0, 1.5, 0], s:[1.2, .34, 1.2], c:0x8CA84A }],
    olivier:() => [{ f:'cyl', d:[.12, .18, .7, 6], p:[0, .35, 0], c:0x7A5230 }, { f:'boule', d:[.8, 1], p:[0, 1.05, 0], s:[1.1, .8, 1.1], c:0x9FB372 }],
    cerisier:() => [{ f:'cyl', d:[.12, .18, .9, 6], p:[0, .45, 0], c:0x6B4A2E }, { f:'boule', d:[.9, 1], p:[0, 1.4, 0], c:0xF6B1C9 }, { f:'boule', d:[.5, 1], p:[.4, 1.8, 0], c:0xFFD0E1 }],
    sapin:() => [{ f:'cyl', d:[.1, .14, .5, 6], p:[0, .25, 0], c:0x6B4A2E }, { f:'cone', d:[.7, .9, 8], p:[0, .85, 0], c:0x3F8A52 }, { f:'cone', d:[.55, .8, 8], p:[0, 1.35, 0], c:0x4A9A5C }, { f:'cone', d:[.38, .7, 8], p:[0, 1.8, 0], c:0x56AA66 }],
    palmier:() => { const P = [{ f:'cyl', d:[.07, .12, 1.7, 6], p:[0, .85, 0], r:[0, 0, .15], c:0x9A6A3A }]; for(let k = 0; k < 6; k++){ const a = k / 6 * Math.PI * 2; P.push({ f:'cone', d:[.12, 1.0, 4], p:[.15 + Math.cos(a) * .45, 1.65, Math.sin(a) * .45], r:[0, -a, -1.2], s:[1, 1, 2.2], c:0x4FA63E }); } return P; },
    dune:() => [{ f:'boule', d:[1, 1], p:[0, .05, 0], s:[1.4, .36, 1.1], c:0xD9B96E }],
    rocher:(rnd) => [{ f:'boule', d:[.8, 0], p:[0, .25, 0], s:[1.1 + rnd() * .3, .6, .9 + rnd() * .3], r:[0, rnd() * 3, 0], c:0xA9A79F }, { f:'boule', d:[.4, 0], p:[.7, .15, .2], c:0xBDBAB0 }],
    cactus:() => [{ f:'cyl', d:[.14, .14, 1.4, 8], p:[0, .7, 0], c:0x5FA14F }, { f:'cyl', d:[.1, .1, .6, 8], p:[.35, .8, 0], c:0x5FA14F }, { f:'cyl', d:[.1, .1, .5, 8], p:[.5, 1.0, 0], r:[0, 0, 0], c:0x5FA14F }],
    neige:() => [{ f:'boule', d:[1, 1], p:[0, .1, 0], s:[1.2, .5, 1], c:0xFFFFFF }, { f:'boule', d:[.6, 1], p:[.6, .05, .3], s:[1, .6, 1], c:0xE8F1FF }],
    botte:() => [{ f:'cyl', d:[.6, .6, .8, 12], p:[0, .6, 0], r:[Math.PI / 2, 0, 0], c:0xE8C766 }, { f:'cyl', d:[.4, .4, .82, 12], p:[0, .6, 0], r:[Math.PI / 2, 0, 0], c:0xD9B24F }],
    maison:() => [{ f:'boite', d:[1.7, .9, 1.2], p:[0, .45, 0], c:0xF3E6C8 }, { f:'cone', d:[1.45, .7, 4], p:[0, 1.2, 0], r:[0, Math.PI / 4, 0], s:[1.05, 1, .75], c:0xC8553D }, { f:'boite', d:[.25, .5, .05], p:[0, .25, .62], c:0x6B4A2E }, { f:'boite', d:[.3, .25, .05], p:[.55, .55, .62], c:0x6FB2E0 }],
    immeuble:(rnd, D) => { const h = 1.4 + rnd() * 2.6, c = D.nuit ? [0x3A4766, 0x44507A, 0x323C58][Math.floor(rnd() * 3)] : [0xEDE4D3, 0xD8CCB6, 0xE3D1B6, 0xBFC8CF][Math.floor(rnd() * 4)]; const P = [{ f:'boite', d:[1.5, h, 1.2], p:[0, h / 2, 0], c }, { f:'boite', d:[1.1, .2, .8], p:[0, h + .1, 0], c:nu(c, -.2) }];
      for(let y = .4; y < h - .2; y += .45) for(let x = -.5; x <= .5; x += .5){ const lit = D.nuit && rnd() < .5; P.push({ f:'boite', d:[.28, .24, .04], p:[x, y, .62], c:lit ? 0xFFE38A : (D.nuit ? 0x1D2540 : 0x7FA6C9) }, { f:'boite', d:[.28, .24, .04], p:[x, y, -.62], c:lit ? 0xFFE38A : (D.nuit ? 0x1D2540 : 0x7FA6C9) }); } return P; },
    neon:(rnd) => { const c = [0xFF3EA5, 0x3EE6FF, 0xFFE03E, 0x7CFF4F][Math.floor(rnd() * 4)]; return [{ f:'cyl', d:[.06, .06, 1.2, 6], p:[0, .6, 0], c:0x555B66 }, { f:'boite', d:[1.5, .7, .1], p:[0, 1.3, 0], c }, { f:'boite', d:[1.3, .5, .12], p:[0, 1.3, 0], c:nu(c, .5) }]; },
  };
  // les tribunes, les garages (stands), le public, les drapeaux
  function construireTribunes(D, pieces, rnd){
    const t = D.tribunes.t, st = D.tribunes.st, sieges = [];
    const bandeau = (liste, couleur, h, rangs) => {
      for(let k = 0; k < liste.length - 1; k++){ const a = liste[k], b = liste[k + 1];
        for(let r = 0; r < rangs; r++){ const u0 = r / rangs, u1 = (r + 1) / rangs, mx = k => lerp(a[k], a[k + 2], (u0 + u1) / 2), mxb = k => lerp(b[k], b[k + 2], (u0 + u1) / 2);
          const cx = (mx(0) + mxb(0)) / 2, cy = (mx(1) + mxb(1)) / 2, dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), prof = Math.hypot(a[2] - a[0], a[3] - a[1]) / rangs;
          const rot = Math.atan2(dy, dx), hh = h * (r + 1) / rangs;
          pieces.push({ f:'boite', d:[len * S + .05, hh, prof * S], p:[cx * S, hh / 2, cy * S], r:[0, -rot, 0], c:r % 2 ? nu(couleur, .1) : couleur });
          if(k % 2 === 0 && sieges.length < 260 && r > 0) for(let q = 0; q < 2; q++) sieges.push([cx * S + dx * (q - .5) * .5 * S, hh + .35, cy * S + dy * (q - .5) * .5 * S, rnd()]);
        } }
    };
    bandeau(t, D.nuit ? 0x59638A : 0xCFC8B8, 3.2, 4);
    // le toit de la grande tribune
    if(t.length > 3){ for(let k = 0; k < t.length - 1; k += 1){ const a = t[k], b = t[k + 1], cx = (a[2] + b[2]) / 2 * S, cy = (a[3] + b[3]) / 2 * S; const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), rot = Math.atan2(dy, dx), mx = (a[0] + b[0]) / 2 * S, my = (a[1] + b[1]) / 2 * S;
        pieces.push({ f:'boite', d:[len * S + .05, .18, 3.9], p:[(cx + mx) / 2, 4.9, (cy + my) / 2], r:[0, -rot, 0], c:k % 6 < 3 ? 0xD7263D : 0xF2F2F2 }); if(k % 5 === 0) pieces.push({ f:'cyl', d:[.1, .1, 4.9, 6], p:[cx, 2.45, cy], c:0x777B85 }); } }
    // les stands : des garages alignés, avec leur porte colorée et le muret
    bandeau(st, D.nuit ? 0x6A7396 : 0xE9E4D8, 1.1, 1);
    for(let k = 0; k < st.length - 1; k += 3){ const a = st[k], b = st[Math.min(k + 2, st.length - 1)], mx = (a[2] + b[2]) / 2 * S, my = (a[3] + b[3]) / 2 * S, rot = Math.atan2(b[1] - a[1], b[0] - a[0]), len = Math.hypot(b[0] - a[0], b[1] - a[1]) * S;
      pieces.push({ f:'boite', d:[Math.max(2, len) - .2, 2.6, 2.4], p:[mx, 1.3, my], r:[0, -rot, 0], c:0xD9D4C8 }, { f:'boite', d:[Math.max(2, len) - .8, 1.8, .1], p:[mx + Math.sin(rot) * 1.25, 1.1, my + Math.cos(rot) * 1.25], r:[0, -rot, 0], c:[0xD7263D, 0x1B6FD8, 0xF2C230, 0x2E9E5B][(k / 3 | 0) % 4] }); }
    if(sieges.length){ D.sieges = sieges; const geo = new T3.BoxGeometry(.55, .7, .45), im = new T3.InstancedMesh(geo, toon({}), sieges.length), c = new T3.Color(), cols = [0xE3242B, 0x1B6FD8, 0xF2C230, 0xFFFFFF, 0x2E9E5B, 0xF28C28];
      sieges.forEach((s, i) => { c.set(cols[Math.floor(s[3] * cols.length)]); im.setColorAt(i, c); }); im.instanceColor.needsUpdate = true; im.frustumCulled = false; scene.add(im); anim.foule = im; }
    // les drapeaux des commissaires : au départ, sur de petits mâts
    const [sx, sy] = D.pts[0], a = D.cap[0], dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    for(const s of [-1, 1]){ const x = (sx + nx * (40 + 12) * s) * S, z = (sy + ny * (40 + 12) * s) * S; pieces.push({ f:'cyl', d:[.05, .06, 3.4, 6], p:[x, 1.7, z], c:0xDADDE3 });
      const fl = new T3.Mesh(new T3.PlaneGeometry(1.6, 1, 8, 1), new T3.MeshBasicMaterial({ color:s > 0 ? 0xF2C230 : 0x2E9E5B, side:T3.DoubleSide })); fl.position.set(x + .8, 3.0, z); scene.add(fl); anim.drapeaux.push(fl); }
  }
  function construireLampes(D, pieces){
    for(const [x, y] of D.lampes){ pieces.push({ f:'cyl', d:[.07, .09, 4.4, 6], p:[x * S, 2.2, y * S], c:0x4A505C }, { f:'boule', d:[.32, 1], p:[x * S, 4.5, y * S], c:0xFFEFB0 }); }
  }
  function construireDepart(D, pieces){
    const [sx, sy] = D.pts[0], a = D.cap[0], dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx, h = 5.2, rot = -a;
    for(const s of [-1, 1]) pieces.push({ f:'boite', d:[.5, h, .5], p:[(sx + nx * 47 * s) * S, h / 2, (sy + ny * 47 * s) * S], r:[0, rot, 0], c:0x30343D });
    pieces.push({ f:'boite', d:[.7, 1.3, 94 * S], p:[sx * S, h + .4, sy * S], r:[0, rot, 0], c:0x30343D }, { f:'boite', d:[.72, .5, 94 * S - 1.2], p:[sx * S - dx * .04, h + .4, sy * S - dy * .04], r:[0, rot, 0], c:0xF2F2F2 });
    // les cinq feux
    for(let k = 0; k < 5; k++){ const o = (k - 2) * 1.5, m = new T3.Mesh(new T3.SphereGeometry(.34, 10, 8), new T3.MeshBasicMaterial({ color:0x3A0A0A })); m.position.set((sx - dx * .5) * S + nx * o, h - .55, (sy - dy * .5) * S + ny * o); scene.add(m); anim.feux.push(m); }
  }

  /* ---------- La mise à jour à chaque image ---------- */
  function majVoitures(dt){
    const vus = new Set();
    for(const d of E.voitures){
      let v = voitures.get(d.id);
      if(!v || v.couleur !== d.couleur || v.cat !== d.cat){ if(v) scene.remove(v.gr); v = creerVoiture(d.cat, d.couleur, d.fantome); voitures.set(d.id, v); scene.add(v.gr); v.px = null; }
      vus.add(d.id);
      const x = d.x * S, z = d.y * S, a = d.a;
      if(v.px == null){ v.px = x; v.pz = z; v.pa = a; }
      const dist = Math.hypot(x - v.px, z - v.pz), vit = dt > 0 ? dist / dt : 0;
      v.vit += (vit - v.vit) * Math.min(1, dt * 8);
      let da = a - v.pa; while(da > Math.PI) da -= 2 * Math.PI; while(da < -Math.PI) da += 2 * Math.PI;
      const omega = dt > 0 ? da / dt : 0;
      v.px = x; v.pz = z; v.pa = a;
      v.gr.position.set(x, 0, z); v.gr.rotation.y = -a;
      v.gr.visible = !d.elimine;
      // l'effet de caisse : la voiture penche dans les virages et plonge au freinage ; les roues tournent, les roues avant braquent
      const roulisC = clamp(-omega * v.vit * .004, -.12, .12), acc = (vit - (v.vitPrec ?? vit)) / Math.max(dt, 1e-3); v.vitPrec = vit;
      const tangC = clamp(-acc * .0016, -.06, .06);
      v.roulis += (roulisC - v.roulis) * Math.min(1, dt * 6); v.tangage += (tangC - v.tangage) * Math.min(1, dt * 6);
      v.corps.rotation.x = v.roulis; v.corps.rotation.z = v.tangage;
      v.rot += v.vit / .36 * dt; v.braquage += (clamp(omega * .22, -.4, .4) - v.braquage) * Math.min(1, dt * 10);
      for(const r of v.roues){ r.m.rotation.z = -v.rot * (.36 / r.r) * 0 - v.rot; r.g.rotation.y = r.av ? -v.braquage : 0; }
      v.flamme.visible = !!d.boost; if(d.boost){ v.flamme.scale.set(.7 + Math.random() * .6, 1, 1); v.flamme.material.color.setHex(Math.random() < .5 ? 0xFFB020 : 0xFF6A1F); }
      v.frein.material.color.setHex(acc < -60 ? 0xFF2A2A : 0x4A0A0A);
      v.equipe.visible = d.arret > 0; if(d.arret > 0) v.equipe.children.forEach((m, i) => { m.position.y = Math.abs(Math.sin(temps * 9 + i * 1.7)) * .12; });
    }
    for(const [id, v] of voitures) if(!vus.has(id)) v.gr.visible = false;
  }
  function majParticules(dt){
    const P = anim.particules; if(!P) return; const m = new T3.Matrix4(), c = new T3.Color(), q = new T3.Quaternion(), s3 = new T3.Vector3(), p3 = new T3.Vector3(); let n = 0;
    for(const f of E.fumee){
      if(n >= 160) break;
      const col = f.sol ? `rgb(${f.sol})` : f.herbe ? '#8A6A3A' : f.vib ? '#666' : f.pneu ? '#EDEDED' : f.eau ? '#EAF2FA' : '#999'; c.set(col);
      const rr = ((f.herbe ? .3 : .4) + (1 - f.vie) * .6) * clamp(f.vie * 2.2, .2, 1);
      p3.set(f.x * S, .5 + (1 - f.vie) * 1.2, f.y * S); s3.set(rr, rr, rr); m.compose(p3, q, s3); P.setMatrixAt(n, m); P.setColorAt(n, c); n++;
    }
    P.count = n; P.instanceMatrix.needsUpdate = true; if(P.instanceColor) P.instanceColor.needsUpdate = true;
  }
  function majMonde(dt){
    // drapeaux qui flottent, nuages qui dérivent, grande roue, bateaux, eau, foule
    for(const f of anim.drapeaux){ const p = f.geometry.attributes.position; for(let i = 0; i < p.count; i++){ const x = p.getX(i) + .8; p.setZ(i, Math.sin(temps * 6 + x * 3) * .12 * (x / 1.6)); } p.needsUpdate = true; }
    for(const n of anim.nuages){ n.g.position.x += n.v * dt; if(n.g.position.x > W + 40) n.g.position.x = -40; n.g.visible = vue === 'suivi' && !!E.voitures.length; }
    for(const r of anim.roues) r.rotation.z += dt * .25;
    for(const b of anim.bateaux){ b.g.position.y = Math.sin(temps * 1.4 + b.ph) * .12; b.g.rotation.z = Math.sin(temps * 1.1 + b.ph) * .05; }
    if(anim.eau){ const k = .5 + .5 * Math.sin(temps * .9); anim.eau.material.color.setRGB(.85 + k * .15, .9 + k * .1, 1); }
    if(anim.foule && monde.sieges){ const im = anim.foule, m = new T3.Matrix4(), q = new T3.Quaternion(), sc = new T3.Vector3(1, 1, 1), p = new T3.Vector3(); const agite = clamp(E.agite || 0, 0, 1);
      for(let i = 0; i < monde.sieges.length; i++){ const s = monde.sieges[i]; const saut = Math.max(0, Math.sin(temps * (6 + s[3] * 4) + i)) * (.08 + agite * .35); p.set(s[0], s[1] + saut, s[2]); m.compose(p, q, sc); im.setMatrixAt(i, m); } im.instanceMatrix.needsUpdate = true; }
    // les feux du départ
    anim.feux.forEach((m, i) => m.material.color.setHex(i < E.feux ? 0xFF2A2A : 0x3A0A0A));
  }
  function majCiel(){
    const w = E.w || 0, nuit = monde && monde.nuit;
    if(anim.dome) anim.dome.material.color.setRGB(1 - w * .35, 1 - w * .33, 1 - w * .25);
    if(anim.fog){ anim.fog.color.setHex(nuit ? 0x1B2448 : 0xCBE6FF).lerp(new T3.Color(0x8794A8), w * .8); anim.fog.near = lerp(140, 25, w); anim.fog.far = lerp(420, 190, w); if(!nuit) scene.background = null; }
    if(anim.hemi) anim.hemi.intensity = (nuit ? .55 : .8) * (1 - w * .25);
    if(anim.soleil) anim.soleil.intensity = (nuit ? .35 : .85) * (1 - w * .5);
    if(anim.sol) anim.sol.material.color.setRGB(1 - w * .18, 1 - w * .16, 1 - w * .1);
  }
  function majPluie(dt, cx, cz){
    const l = anim.pluie; if(!l) return; l.visible = (E.w || 0) > .02; if(!l.visible) return;
    const N = Math.round(anim.pluieN * clamp(E.w, 0, 1)), pos = l.geometry.attributes.position.array;
    for(let i = 0; i < anim.pluieN; i++){ const g = anim.gouttes[i]; g[1] -= 38 * dt; if(g[1] < 0) g[1] += 30; const on = i < N; const x = cx + g[0], y = on ? g[1] : -50, z = cz + g[2]; pos.set([x, y, z, x - .15, y + .9, z - .1], i * 6); }
    l.geometry.attributes.position.needsUpdate = true;
  }
  // la caméra : de dessus (exactement le cadre du dessin du tracé) ou de suivi, toujours de trois quarts
  const PRESETS = [{ d:7.6, h:2.7, off:36, ahead:2.8, fov:54 }, { d:6.6, h:2.1, off:146, ahead:-1, fov:58 }, { d:18, h:12, off:30, ahead:5, fov:50 }];
  function majCamera(dt){
    if(vue === 'dessus' || !E.voitures.length){
      cam.fov = 30; const hh = (H / 2) / Math.tan(cam.fov * Math.PI / 360); cam.position.set(W / 2, hh, H / 2); cam.up.set(0, 0, -1); cam.lookAt(W / 2, 0, H / 2); cam.updateProjectionMatrix(); cam0.init = true; return;
    }
    const d = E.voitures.find(x => x.id === E.suivre) || E.voitures[0], v = voitures.get(d.id); if(!v) return;
    const p = PRESETS[preset % PRESETS.length], x = d.x * S, z = d.y * S, a = d.a;
    if(cam0.init){ cam0.x = x; cam0.z = z; cam0.yaw = a; cam0.init = false; cam0.vx = 0; cam0.vz = 0; }
    // le cap est lissé : la caméra balance un peu dans les virages, et la voiture reste de trois quarts
    let da = a - cam0.yaw; while(da > Math.PI) da -= 2 * Math.PI; while(da < -Math.PI) da += 2 * Math.PI;
    cam0.yaw += da * Math.min(1, dt * 5);
    cam0.x += (x - cam0.x) * Math.min(1, dt * 9); cam0.z += (z - cam0.z) * Math.min(1, dt * 9);
    const fx = Math.cos(cam0.yaw), fz = Math.sin(cam0.yaw), rx = -fz, rz = fx, off = p.off * Math.PI / 180, dist = p.d + v.vit * .035;
    const bx = -Math.cos(off) * dist, sx = Math.sin(off) * dist;
    cam.position.set(cam0.x + fx * bx + rx * sx, p.h + v.vit * .01, cam0.z + fz * bx + rz * sx);
    cam.up.set(0, 1, 0);
    cam.fov += ((p.fov + clamp(v.vit * .12, 0, 10)) - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix();
    cam.lookAt(cam0.x + fx * p.ahead, .9, cam0.z + fz * p.ahead);
  }
  function majEtiquettes(){
    if(!conteneurTags) return;
    const vus = new Set(), v3 = new T3.Vector3(), cvR = cv3.getBoundingClientRect(), cR = conteneurTags.getBoundingClientRect();
    for(const d of E.voitures){
      if(d.fantome || d.elimine || !d.nom) continue; vus.add(d.id);
      let t = tags.get(d.id); if(!t){ t = document.createElement('div'); t.className = 'tag3d'; conteneurTags.appendChild(t); tags.set(d.id, t); }
      const v = voitures.get(d.id); if(!v) continue;
      v3.set(d.x * S, 2.1, d.y * S).project(cam);
      const sx = (v3.x * .5 + .5) * cvR.width + cvR.left - cR.left, sy = (-v3.y * .5 + .5) * cvR.height + cvR.top - cR.top;
      const suivi = d.id === E.suivre && vue === 'suivi';
      t.style.display = v3.z > 1 || suivi ? 'none' : 'block'; t.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
      t.dataset.id = d.id; t.style.setProperty('--c', d.couleur); { const n = parseInt(d.couleur.slice(1), 16); t.style.color = ((n >> 16) * 299 + (n >> 8 & 255) * 587 + (n & 255) * 114) / 1000 > 150 ? '#15121F' : '#FFFFFF'; } const txt = `${d.rang ? d.rang + '. ' : ''}${d.nom}`; if(t.textContent !== txt) t.textContent = txt; t.classList.toggle('moi', !!d.humain);
    }
    for(const [id, t] of tags) if(!vus.has(id)){ t.remove(); tags.delete(id); }
  }
  function dessiner(dt){
    if(!ok || !scene || !actif) return;
    temps += dt;
    majVoitures(dt); majParticules(dt); majMonde(dt); majCiel(); majCamera(dt); majPluie(dt, cam.position.x, cam.position.z);
    R.render(scene, cam); majEtiquettes();
  }
  function boucle(now){
    raf = requestAnimationFrame(boucle);
    const dt = Math.min(.05, (now - dernier) / 1000); dernier = now;
    if(E.externe) return;                       // la course appelle elle-même dessiner() à chaque image
    dessiner(dt);
  }
  /* ---------- Les commandes de l'extérieur ---------- */
  function visible(b){ actif = !!b && ok; cancelAnimationFrame(raf); if(actif){ dernier = performance.now(); raf = requestAnimationFrame(boucle); } }
  function maj(e){ E = Object.assign(E, e); }
  return {
    S, init, charger, taille, visible, maj, dessiner,
    get ok(){ return ok; },
    get vue(){ return vue; }, set vue(v){ vue = v; cam0.init = true; },
    get preset(){ return preset; }, set preset(v){ preset = v; cam0.init = true; },
    nbPresets:PRESETS.length,
    etiquettes(el){ conteneurTags = el; },
    externe(b){ E.externe = !!b; },
  };
})();
