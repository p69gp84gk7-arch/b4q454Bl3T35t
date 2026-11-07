/* Freeride : la vue 3D (Three.js), en style « dessin animé » comme la Dameuse de nuit (ombrage en tons, contours foncés), mais de jour.
   Le monde du jeu ne change pas : x de gauche à droite, y vers le bas de la pente, en mètres. En 3D : X = x, Z = y, Y = l'altitude.
   La pente descend de PENTE m par mètre ; une barre rocheuse la fait tomber d'un coup de sa hauteur. Le sol où l'on glisse ajoute
   les bosses, les tremplins (et leur table dans les snowparks), les rampes des barres et des rails.
   La montagne est construite par tranches de CH m devant le skieur (et oubliée derrière), ce qui marche aussi pour les modes sans fin.
   La caméra suit le skieur de derrière, assez bas (vue rasante). */
window.FREERIDE_3D = (() => {
  'use strict';
  const PENTE = .3, CH = 32, DY = .8, DXF = .8, DXG = 3.2, ECH = 1.25;
  // le soleil (à gauche, un peu devant) ; la neige est ombrée en quatre tons, bleutés à l'ombre, comme un dessin
  const SOLEIL = (() => { const v = [-.7, .45, .55], l = Math.hypot(...v); return v.map(x => x / l); })();
  const ton = (nx, ny, nz) => { const d = nx * SOLEIL[0] + ny * SOLEIL[1] + nz * SOLEIL[2]; return d > .62 ? 1 : d > .42 ? .9 : d > .2 ? .8 : .7; };
  const teinte = (c, t, out, k) => { out[k] = c[0] * t ** 1.7; out[k + 1] = c[1] * t ** 1.25; out[k + 2] = c[2] * t ** .55; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lisse = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const alea = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const premier = (l, y) => { let a = 0, b = l.length; while(a < b){ const m = (a + b) >> 1; if(l[m].y < y) a = m + 1; else b = m; } return a; };
  let T3 = null, R = null, scene = null, cam = null, ok = false;
  let DEGRADE = null, DEGRADE_N = null, CONTOUR = null, matSol = null, matNeige = null, GEO = null, texFlocon = null;
  let M = null, J = null, chunks = new Map(), drops = [], dropsVus = new Set();
  let montagnes = null, skieur = null, ombre = null, traces = null, poudre = null, avalanche = null, flocons = [];
  const E = { vis:0, air:false, off:0, tOff:1, tAir:0, init:true, cx:0, cy:0, ch:0, yaw:0 };

  /* ---------- Les formes (comme un dessin) ---------- */
  const toon = o => new T3.MeshToonMaterial(Object.assign({ gradientMap:DEGRADE }, o));
  function geom(f, d, e = 0){
    switch(f){
      case 'boite': return new T3.BoxGeometry(d[0] + 2 * e, d[1] + 2 * e, d[2] + 2 * e);
      case 'cyl': return new T3.CylinderGeometry(d[0] + e, d[1] + e, d[2] + 2 * e, d[3] || 10);
      case 'cone': return new T3.ConeGeometry(d[0] + e, d[1] + 2 * e, d[2] || 8);
      case 'boule': return new T3.IcosahedronGeometry(d[0] + e, d[1] || 0);
    }
  }
  function matrice(p){
    if(p.m) return p.m;
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
  // un objet fait de pièces, avec son contour ; ses géométries sont notées dans la tranche (pour les libérer)
  function objet(ch, pieces, e = .05){
    const g1 = fusion(pieces), g2 = fusion(pieces, e); ch.geos.push(g1, g2);
    const gr = new T3.Group(); gr.add(new T3.Mesh(g1, GEO.matCouleurs), new T3.Mesh(g2, CONTOUR)); ch.gr.add(gr); return gr;
  }
  // un tube entre deux points (pour les rails, les piquets)
  function tube(a, b, r, c){
    const d = new T3.Vector3().subVectors(b, a), L = d.length(), q = new T3.Quaternion().setFromUnitVectors(new T3.Vector3(0, 1, 0), d.normalize());
    return { f:'cyl', d:[r, r, L, 8], c, m:new T3.Matrix4().compose(new T3.Vector3().addVectors(a, b).multiplyScalar(.5), q, new T3.Vector3(1, 1, 1)) };
  }

  /* ---------- Démarrage ---------- */
  function init(canvas){
    if(ok) return true;
    try{
      T3 = window.THREE; if(!T3) return false;
      R = new T3.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
      R.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
      const d = new Uint8Array([95, 95, 95, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
      DEGRADE = new T3.DataTexture(d, 3, 1, T3.RGBAFormat); DEGRADE.minFilter = DEGRADE.magFilter = T3.NearestFilter; DEGRADE.needsUpdate = true;
      // la neige : quatre tons clairs
      const dn = new Uint8Array([170, 170, 170, 255, 205, 205, 205, 255, 232, 232, 232, 255, 255, 255, 255, 255]);
      DEGRADE_N = new T3.DataTexture(dn, 4, 1, T3.RGBAFormat); DEGRADE_N.minFilter = DEGRADE_N.magFilter = T3.NearestFilter; DEGRADE_N.needsUpdate = true;
      CONTOUR = new T3.MeshBasicMaterial({ color:0x1B2A40, side:T3.BackSide });
      cam = new T3.PerspectiveCamera(66, 1, .2, 900);
      preparerFormes();
      ok = true;
    }catch(e){ ok = false; }
    return ok;
  }
  function taille(w, h){ if(!ok) return; R.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 72 : 58; cam.updateProjectionMatrix(); }

  // les formes qui servent partout (sapins, rochers…), faites une seule fois
  function preparerFormes(){
    GEO = { matCouleurs:toon({ vertexColors:true }) };
    matSol = new T3.MeshBasicMaterial({ vertexColors:true });
    matNeige = matSol;
    const sapin = [
      { f:'cyl', d:[.22, .3, 1.4, 6], c:0x4A3222, p:[0, .7, 0] },
      { f:'cone', d:[1.9, 2.8, 7], c:0x1F5A44, p:[0, 2.4, 0] }, { f:'cone', d:[1.5, 2.4, 7], c:0x24664D, p:[0, 3.7, 0] }, { f:'cone', d:[1, 2, 7], c:0x2B7558, p:[0, 4.9, 0] },
      { f:'cone', d:[.75, .7, 7], c:0xF2F6FB, p:[0, 5.7, 0] }, { f:'cyl', d:[1.25, 1.5, .25, 7], c:0xF2F6FB, p:[0, 3.05, 0] }, { f:'cyl', d:[.85, 1.15, .22, 7], c:0xF2F6FB, p:[0, 4.35, 0] },
    ];
    GEO.sapin = fusion(sapin); GEO.sapinC = fusion(sapin, .06);
    const rocher = [{ f:'boule', d:[1, 1], c:0x8A9099, s:[1, .7, .95], p:[0, .25, 0] }, { f:'boule', d:[.8, 1], c:0xF4F8FC, s:[1, .32, .95], p:[-.08, .62, -.05] }];
    GEO.rocher = fusion(rocher); GEO.rocherC = fusion(rocher, .05);
    const paroi = [{ f:'boule', d:[1, 1], c:0x7C838E, s:[1, 1, .8] }];
    GEO.paroi = fusion(paroi); GEO.paroiC = fusion(paroi, .05);
    const souche = [{ f:'cyl', d:[.42, .5, .55, 8], c:0x6B4A35, p:[0, .2, 0] }, { f:'cyl', d:[.46, .44, .12, 8], c:0xF4F8FC, p:[0, .52, 0] }];
    GEO.souche = fusion(souche); GEO.soucheC = fusion(souche, .05);
    GEO.flocon = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      x.translate(32, 32); x.lineCap = 'round';
      for(const [w, col] of [[9, 'rgba(255,255,255,.95)'], [4.5, '#2F8FD8']]){ x.strokeStyle = col; x.lineWidth = w;
        for(let k = 0; k < 3; k++){ x.rotate(Math.PI / 3); x.beginPath(); x.moveTo(-24, 0); x.lineTo(24, 0); for(const s of [-1, 1]){ x.moveTo(s * 13, 0); x.lineTo(s * 20, 7); x.moveTo(s * 13, 0); x.lineTo(s * 20, -7); } x.stroke(); } }
      const t = new T3.CanvasTexture(c); return new T3.SpriteMaterial({ map:t, depthWrite:false }); })();
    // le skieur : un tube et une boule qu'on recopie pour chaque morceau du corps
    const cyl = new T3.CylinderGeometry(1, 1, 1, 8, 1, true).toNonIndexed(), sph = new T3.SphereGeometry(1, 7, 5).toNonIndexed();
    GEO.tp = { cp:cyl.attributes.position.array, cn:cyl.attributes.normal.array, sp:sph.attributes.position.array, sn:sph.attributes.normal.array };
    cyl.dispose(); sph.dispose();
  }

  /* ---------- Le relief ---------- */
  // les barres rocheuses vues (gardées même quand le jeu les oublie derrière), et leur chute cumulée
  function syncDrops(){
    let neuf = false;
    for(const b of M.barres) if(!dropsVus.has(b)){ dropsVus.add(b); drops.push(b); neuf = true; }
    if(neuf){ drops.sort((a, b) => a.y - b.y); let s = 0; for(const b of drops){ s += b.h; b.cumul = s; } }
  }
  function chute(y){ let a = 0, b = drops.length; while(a < b){ const m = (a + b) >> 1; if(drops[m].y <= y) a = m + 1; else b = m; } return a ? drops[a - 1].cumul : 0; }
  const dur = y => -y * PENTE - chute(y);                                       // le sol « du jeu » (une marche à chaque barre)
  const rive = x => { const d = Math.abs(x) - (M.bord + 6); return d > 0 ? Math.pow(d, 1.5) * .22 : 0; };   // les côtés remontent
  // la neige n'est pas plate : de longues ondulations (presque rien sur une piste damée)
  const ondule = (x, y) => (Math.sin(x * .31 + y * .17) * .5 + Math.sin(x * .13 - y * .29 + 1.3) * .38 + Math.sin(y * .45 + x * .07 + 2.1) * .22) * (M.filet ? .25 : 1);
  const base = (x, y) => dur(y) + rive(x) + ondule(x, y);
  function wTrou(b, x){ let w = 0; for(const [a, c] of b.trous){ const d = x < a ? a - x : x > c ? x - c : 0; w = Math.max(w, 1 - d / 1.5); } return clamp(w, 0, 1); }
  // au bord d'une barre, la neige tombe sur 0,7 m ; dans un passage, une rampe descend doucement
  function corrBarre(b, x, y){
    if(y < b.y - 4 || y > b.y + 7) return 0;
    const marche = y >= b.y ? 1 : 0, bord = lisse((y - b.y) / .7), rampe = lisse((y - b.y + 4) / 11), w = wTrou(b, x);
    return b.h * (marche - (bord * (1 - w) + rampe * w));
  }
  function corrBarres(x, y){ let s = 0; for(let i = Math.max(0, premier(drops, y - 8)); i < drops.length && drops[i].y < y + 5; i++) s += corrBarre(drops[i], x, y); return s; }
  const bump = (o, x, y) => { const d2 = ((x - o.x) ** 2 + (y - o.y) ** 2) / (o.r * o.r); return d2 < 1 ? .55 * (1 - d2) ** 2 : 0; };
  function bosses(x, y){ let m = 0; const O = M.objets; for(let i = premier(O, y - 1.7); i < O.length && O[i].y < y + 1.7; i++){ const o = O[i]; if(o.t === 'bosse') m = Math.max(m, bump(o, x, y)); } return m; }
  const solT = (x, y) => base(x, y) + corrBarres(x, y) + bosses(x, y);         // la neige
  const hKick = o => .2 * o.l + .15;
  function kickH(o, x, y){
    const H = hKick(o), dx = Math.abs(x - o.x);
    if(y >= o.y - o.l && y <= o.y) return dx > o.w / 2 ? 0 : H * Math.pow(clamp((y - o.y + o.l) / o.l, 0, 1), 1.6);
    if(o.park && y > o.y){ if(dx > o.w / 2 + .3) return 0; const T = o.table, L = H * 2.6; if(y <= o.y + T) return H * .8; if(y <= o.y + T + L) return H * .8 * (1 - lisse((y - o.y - T) / L)); }
    return 0;
  }
  // le sol où l'on glisse : la neige, plus les tremplins et les rampes des modules
  function sol(x, y){
    let h = 0; const O = M.objets;
    for(let i = premier(O, y - 22); i < O.length && O[i].y < y + 9; i++){ const o = O[i]; if(o.t === 'kicker') h = Math.max(h, kickH(o, x, y)); }
    for(let i = premier(M.rails, y); i < M.rails.length && M.rails[i].y < y + 3; i++){ const o = M.rails[i]; if(y > o.y - 2.8 && Math.abs(x - o.x) < Math.max(.5, o.w / 2 + .1)) h = Math.max(h, J.hRail(o, 0) * (y - o.y + 2.8) / 2.8); }
    return solT(x, y) + h;
  }

  /* ---------- Une nouvelle partie ---------- */
  function nouvellePartie(monde, jeu){
    if(!ok) return;
    M = monde; J = jeu;
    for(const k of [...chunks.keys()]) oublier(k);
    if(scene) scene.traverse(o => { if(o.geometry && o.userData.propre) o.geometry.dispose(); });
    drops = []; dropsVus = new Set();
    scene = new T3.Scene();
    scene.background = new T3.Color(0xA9D3F5);
    scene.fog = new T3.Fog(0xE1EDF8, 80, 230);
    scene.add(new T3.HemisphereLight(0xEAF4FF, 0x8FA6C4, .58));
    const soleil = new T3.DirectionalLight(0xFFF6E6, .62); soleil.position.set(...SOLEIL); scene.add(soleil);
    decorFixe();
    syncDrops();
    E.init = true; flocons = [];
  }
  // ce qui suit le skieur : les montagnes au loin, son ombre, ses traces, la poudreuse, l'avalanche, le skieur
  function decorFixe(){
    montagnes = new T3.Group();
    const R0 = alea(7);
    for(let k = 0; k < 13; k++){
      const a = -1.35 + k * 2.7 / 12 + (R0() - .5) * .12, D = 430 + R0() * 120, H = 150 + R0() * 150, Rr = 110 + R0() * 90;
      const m = new T3.Mesh(new T3.ConeGeometry(Rr, H, 7), new T3.MeshBasicMaterial({ color:k % 2 ? 0xA3C1E3 : 0xB4CDEA, fog:false }));
      m.position.set(Math.sin(a) * D, H / 2, Math.cos(a) * D); m.rotation.y = R0() * 6;
      const c = new T3.Mesh(new T3.ConeGeometry(Rr * .36, H * .36, 7), new T3.MeshBasicMaterial({ color:0xF5F8FC, fog:false }));
      c.position.set(m.position.x, H * .82 + .5, m.position.z); c.rotation.y = m.rotation.y;
      m.userData.propre = c.userData.propre = true; montagnes.add(m, c);
    }
    scene.add(montagnes);
    ombre = new T3.Mesh(new T3.CircleGeometry(.75, 20), new T3.MeshBasicMaterial({ color:0x2A3F66, transparent:true, opacity:.28, depthWrite:false }));
    ombre.userData.propre = true; scene.add(ombre);
    // les traces : des rubans posés sur la neige
    const tg = new T3.BufferGeometry(); tg.setAttribute('position', new T3.BufferAttribute(new Float32Array(9000 * 3), 3)); tg.setDrawRange(0, 0);
    traces = new T3.Mesh(tg, new T3.MeshBasicMaterial({ color:0xA3B8D6, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 }));
    traces.frustumCulled = false; traces.userData.propre = true; scene.add(traces);
    poudre = new T3.InstancedMesh(new T3.IcosahedronGeometry(1, 0), toon({ color:0xFFFFFF }), 140);
    poudre.frustumCulled = false; poudre.count = 0; poudre.userData.propre = true; scene.add(poudre);
    // l'avalanche : une vague de grosses boules de neige
    const ag = new T3.IcosahedronGeometry(1, 1);
    avalanche = { m:new T3.InstancedMesh(ag, toon({ color:0xF8FBFF }), 60), c:new T3.InstancedMesh(new T3.IcosahedronGeometry(1.04, 1), CONTOUR, 60) };
    for(const x of [avalanche.m, avalanche.c]){ x.frustumCulled = false; x.count = 0; x.userData.propre = true; scene.add(x); }
    // le skieur : un seul maillage, refait à chaque image à partir de sa pose
    const MAX = 70 * 264, geo = () => { const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.BufferAttribute(new Float32Array(MAX * 3), 3)); g.setAttribute('normal', new T3.BufferAttribute(new Float32Array(MAX * 3), 3)); g.setAttribute('color', new T3.BufferAttribute(new Float32Array(MAX * 3), 3)); g.setDrawRange(0, 0); return g; };
    skieur = { m:new T3.Mesh(geo(), GEO.matCouleurs), c:new T3.Mesh(geo(), CONTOUR) };
    for(const x of [skieur.m, skieur.c]){ x.frustumCulled = false; x.userData.propre = true; scene.add(x); }
  }

  /* ---------- Une tranche de montagne ---------- */
  function oublier(k){
    const ch = chunks.get(k); if(!ch) return;
    scene.remove(ch.gr); for(const g of ch.geos) g.dispose(); for(const m of ch.inst) m.dispose(); for(const m of ch.mats){ if(m.map) m.map.dispose(); m.dispose(); }
    chunks.delete(k);
  }
  function serie(ch, g, gc, liste, regler, couleur){
    if(!liste.length) return;
    const im = new T3.InstancedMesh(g, GEO.matCouleurs, liste.length), ic = new T3.InstancedMesh(gc, CONTOUR, liste.length);
    const m = new T3.Matrix4(), q = new T3.Quaternion(), v = new T3.Vector3(), s = new T3.Vector3(), Y = new T3.Vector3(0, 1, 0), c = new T3.Color();
    liste.forEach((it, k) => { regler(it, v, q, s, Y); m.compose(v, q, s); im.setMatrixAt(k, m); ic.setMatrixAt(k, m); if(couleur){ c.set(couleur(it)); im.setColorAt(k, c); } });
    ch.gr.add(im, ic); ch.inst.push(im, ic);
  }
  // un bloc de neige (ou une box) posé sur la pente : dessus = sol + haut(y), sur toute la largeur [x0, x1]
  function bloc(ch, x0, x1, ya, yb, n, haut, couleur = [.96, .975, 1], devant = true){
    const pos = [], P = (x, y, h) => [x, h, y];
    const top = [], bas = [];
    for(let k = 0; k <= n; k++){ const y = ya + (yb - ya) * k / n; top.push([0, 1, 2].map(i => { const x = x0 + (x1 - x0) * i / 2; return P(x, y, solT(x, y) + haut(y)); })); bas.push([x0, x1].map(x => P(x, y, solT(x, y) - .3))); }
    const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for(let k = 0; k < n; k++){
      for(let i = 0; i < 2; i++) quad(top[k][i], top[k + 1][i], top[k + 1][i + 1], top[k][i + 1]);
      quad(bas[k][0], bas[k + 1][0], top[k + 1][0], top[k][0]);          // le côté gauche
      quad(top[k][2], top[k + 1][2], bas[k + 1][1], bas[k][1]);          // le côté droit
    }
    if(devant){ const t = top[n], b = bas[n]; quad(t[0], t[1], [t[1][0], b[0][1], t[1][2]], b[0]); quad(t[1], t[2], b[1], [t[1][0], b[1][1], t[1][2]]); }
    const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const nn = g.attributes.normal.array, col = new Float32Array(nn.length);
    for(let k = 0; k < nn.length; k += 3) teinte(couleur, ton(nn[k], nn[k + 1], nn[k + 2]), col, k);
    g.setAttribute('color', new T3.BufferAttribute(col, 3));
    ch.geos.push(g); const me = new T3.Mesh(g, matSol); ch.gr.add(me); return me;
  }
  function construire(k){
    const ch = { gr:new T3.Group(), geos:[], inst:[], mats:[] }, y0 = k * CH, y1 = y0 + CH, B = M.bord, XW = B + 46;
    // le terrain : une grille fine sur la piste, plus large sur les côtés
    const xs = [];
    for(let x = -XW; x < -(B + 8) - .01; x += DXG) xs.push(x);
    for(let x = -(B + 8); x < B + 8 - .01; x += DXF) xs.push(x);
    for(let x = B + 8; x <= XW + .01; x += DXG) xs.push(x);
    const nx = xs.length, ny = Math.round(CH / DY), H = new Float32Array(nx * (ny + 3)), BM = new Float32Array(nx * (ny + 3));
    const yj = j => y0 + j * DY;                                // j de -1 à ny + 1 (une rangée de plus de chaque côté, pour les normales)
    for(let j = -1; j <= ny + 1; j++) for(let i = 0; i < nx; i++) H[(j + 1) * nx + i] = base(xs[i], yj(j)) + corrBarres(xs[i], yj(j));
    const O = M.objets;
    for(let n = premier(O, y0 - 3); n < O.length && O[n].y < y1 + 3; n++){
      const o = O[n]; if(o.t !== 'bosse') continue;
      for(let j = Math.max(-1, Math.floor((o.y - o.r - y0) / DY)); j <= Math.min(ny + 1, Math.ceil((o.y + o.r - y0) / DY)); j++)
        for(let i = 0; i < nx; i++){ if(Math.abs(xs[i] - o.x) >= o.r) continue; const q = (j + 1) * nx + i; BM[q] = Math.max(BM[q], bump(o, xs[i], yj(j))); }
    }
    for(let q = 0; q < H.length; q++) H[q] += BM[q];
    const N = nx * (ny + 1), pos = new Float32Array(N * 3), nor = new Float32Array(N * 3), col = new Float32Array(N * 3), idx = [];
    const R0 = alea(k * 7919 + 13), glacier = !!(M.def && M.def.glacier);
    for(let j = 0; j <= ny; j++) for(let i = 0; i < nx; i++){
      const v = j * nx + i, q = (j + 1) * nx + i, x = xs[i], h = H[q];
      pos[v * 3] = x; pos[v * 3 + 1] = h; pos[v * 3 + 2] = yj(j);
      const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i + 1), dx = (H[(j + 1) * nx + i1] - H[(j + 1) * nx + i0]) / (xs[i1] - xs[i0]), dz = (H[(j + 2) * nx + i] - H[j * nx + i]) / (2 * DY);
      const l = Math.hypot(dx, 1, dz); nor[v * 3] = -dx / l; nor[v * 3 + 1] = 1 / l; nor[v * 3 + 2] = -dz / l;
      // la couleur : neige fraîche, piste damée (avec ses rainures), glacier bleuté
      let c = [.97, .985, 1];
      if(M.filet && Math.abs(x) < B) c = (i % 2) ? [.9, .93, .975] : [.93, .955, .99];
      if(glacier) c = [c[0] * .9, c[1] * .96, c[2]];
      teinte(c, ton(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]) * (1 - R0() * .015), col, v * 3);
    }
    for(let j = 0; j < ny; j++) for(let i = 0; i < nx - 1; i++){ const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.push(a, c, b, c, d, b); }
    const g = new T3.BufferGeometry();
    g.setAttribute('position', new T3.BufferAttribute(pos, 3)); g.setAttribute('normal', new T3.BufferAttribute(nor, 3)); g.setAttribute('color', new T3.BufferAttribute(col, 3)); g.setIndex(idx);
    g.computeBoundingSphere(); ch.geos.push(g); ch.gr.add(new T3.Mesh(g, matSol));
    // les objets de la tranche
    const sapins = [], rochers = [], souches = [];
    for(let n = premier(O, y0); n < O.length && O[n].y < y1; n++){
      const o = O[n];
      if(o.t === 'arbre') sapins.push(o);
      else if(o.t === 'rocher') rochers.push(o);
      else if(o.t === 'souche') souches.push(o);
      else if(o.t === 'kicker') tremplin(ch, o);
      else if(o.t === 'crevasse') crevasse(ch, o);
    }
    // des sapins en plus sur les côtés de la vallée (juste pour le décor)
    for(let n = 0; n < 34; n++){ const s = R0() < .5 ? -1 : 1, x = s * (B + 8 + R0() * 38), y = y0 + R0() * CH; sapins.push({ x, y, r:1 + R0() * 1.1, v:R0() }); }
    serie(ch, GEO.sapin, GEO.sapinC, sapins, (o, v, q, s, Y) => { v.set(o.x, solT(o.x, o.y) - .2, o.y); q.setFromAxisAngle(Y, o.v * 6.3); const t = o.r * .8; s.set(t, t * (1 + o.v * .3), t); });
    serie(ch, GEO.rocher, GEO.rocherC, rochers, (o, v, q, s, Y) => { v.set(o.x, solT(o.x, o.y) - .15 * o.r, o.y); q.setFromAxisAngle(Y, o.v * 6.3); s.set(o.r, o.r * (o.bas ? .8 : 1.15), o.r); }, o => o.glace ? 0xA9DDF5 : 0xFFFFFF);
    serie(ch, GEO.souche, GEO.soucheC, souches, (o, v, q, s, Y) => { v.set(o.x, solT(o.x, o.y), o.y); q.setFromAxisAngle(Y, o.v * 6); s.set(1, 1, 1); });
    // les barres rocheuses : une paroi de blocs, des fanions verts aux passages
    for(const b of drops){
      if(b.y < y0 || b.y >= y1) continue;
      const blocs = [];
      for(let x = -XW; x <= XW; x += 1.5){ if(wTrou(b, x) > .25) continue; blocs.push({ x:x + (R0() - .5) * .5, y:b.y + .4 + R0() * .3, h:b.h, v:R0() }); }
      serie(ch, GEO.paroi, GEO.paroiC, blocs, (o, v, q, s, Y) => { const haut = base(o.x, o.y - 1) + corrBarres(o.x, o.y - 1); v.set(o.x, haut - o.h * .5, o.y); q.setFromAxisAngle(Y, o.v * 6); s.set(1.15 + o.v * .4, o.h * .55, .9); });
      const fan = [];
      for(const [a, c] of b.trous) for(const x of [a, c]){ const y = b.y - 4.5, h = solT(x, y); fan.push({ f:'cyl', d:[.05, .05, 2, 6], c:0x30353E, p:[x, h + 1, y] }, { f:'boite', d:[.7, .45, .04], c:0x2E9E5B, p:[x + (x === a ? .35 : -.35), h + 1.75, y] }); }
      if(fan.length) objet(ch, fan, .03);
    }
    // les boxes et les rails
    for(let n = premier(M.rails, y0); n < M.rails.length && M.rails[n].y < y1; n++) module(ch, M.rails[n]);
    // les portes de slalom
    for(const pt of M.portes){
      if(pt.y < y0 || pt.y >= y1) continue;
      const c = pt.c === 'rouge' ? 0xE23B3B : 0x1F6FE0, pcs = [];
      for(const s of [-1, 1]){ const x = pt.x + s * pt.w / 2, h = solT(x, pt.y); pcs.push({ f:'cyl', d:[.05, .05, 1.8, 6], c, p:[x, h + .9, pt.y] }, { f:'boite', d:[1, .6, .03], c, p:[x - s * .5, h + 1.45, pt.y] }); }
      objet(ch, pcs, .03);
    }
    // les filets du slalom et des snowparks
    if(M.filet) for(const s of [-1, 1]){
      const x = s * B, p = [], pcs = [];
      for(let y = y0; y < y1; y += 2){ const a = solT(x, y), b = solT(x, y + 2); p.push(x, a, y, x, b, y + 2, x, b + 1.1, y + 2, x, a, y, x, b + 1.1, y + 2, x, a + 1.1, y); }
      for(let y = Math.ceil(y0 / 6) * 6; y < y1; y += 6) pcs.push({ f:'cyl', d:[.05, .05, 1.3, 6], c:0x30353E, p:[x, solT(x, y) + .65, y] });
      const gf = new T3.BufferGeometry(); gf.setAttribute('position', new T3.Float32BufferAttribute(p, 3)); ch.geos.push(gf);
      const mf = new T3.MeshBasicMaterial({ color:0xFF6A2B, transparent:true, opacity:.5, side:T3.DoubleSide, depthWrite:false }); ch.mats.push(mf);
      ch.gr.add(new T3.Mesh(gf, mf)); objet(ch, pcs, .03);
    }
    // l'arrivée : une arche et une ligne à damier
    if(M.fin >= y0 && M.fin < y1) arrivee(ch);
    scene.add(ch.gr); chunks.set(k, ch);
  }
  function tremplin(ch, o){
    const H = hKick(o), x0 = o.x - o.w / 2, x1 = o.x + o.w / 2;
    bloc(ch, x0, x1, o.y - o.l, o.y, 10, y => H * Math.pow(clamp((y - o.y + o.l) / o.l, 0, 1), 1.6));
    const lev = [{ f:'boite', d:[o.w, .1, .14], c:0xFF6A2B, p:[o.x, solT(o.x, o.y) + H + .03, o.y - .06] }];
    if(o.park){
      const T = o.table, L = H * 2.6;
      bloc(ch, x0 - .3, x1 + .3, o.y + .06, o.y + T + L, 12, y => y <= o.y + T ? H * .8 : H * .8 * (1 - lisse((y - o.y - T) / L)), undefined, false);
      lev.push({ f:'boite', d:[o.w + .6, .06, .14], c:0x1F6FE0, p:[o.x, solT(o.x, o.y + T) + H * .8 + .04, o.y + T] });
    }
    objet(ch, lev, .02);
  }
  function crevasse(ch, o){
    const h = solT(o.x, o.y) + .04;
    for(const [k, c, dz] of [[1, 0x0E3550, 0], [.62, 0x1F6E95, .1]]){
      const g = new T3.CircleGeometry(1, 24); ch.geos.push(g);
      const m = new T3.Mesh(g, new T3.MeshBasicMaterial({ color:c, polygonOffset:true, polygonOffsetFactor:-1 - k, polygonOffsetUnits:-2 })); ch.mats.push(m.material);
      m.scale.set(o.w / 2 * k, o.h / 2 * k, 1); m.rotation.x = Math.atan(PENTE) - Math.PI / 2; m.position.set(o.x, h + .01 * (1 - k), o.y + dz * o.h); ch.gr.add(m);
    }
  }
  function module(ch, o){
    const Hr = s => J.hRail(o, s), F = J.FORMES[o.forme], larg = Math.max(.5, o.w / 2 + .1);
    // la rampe de neige qui monte au module
    bloc(ch, o.x - larg, o.x + larg, o.y - 2.8, o.y, 3, y => Hr(0) * (y - o.y + 2.8) / 2.8, undefined, false);
    if(o.forme === 'box'){
      bloc(ch, o.x - o.w / 2, o.x + o.w / 2, o.y, o.y + o.l, 8, y => Hr((y - o.y) / o.l), [1, .45, .2]);
      const bandes = []; for(let y = o.y + 1; y < o.y + o.l - .5; y += 2.2) bandes.push({ f:'boite', d:[o.w + .02, .03, .5], c:0xFFFFFF, p:[o.x, base(o.x, y) + Hr((y - o.y) / o.l) + .01, y] });
      objet(ch, bandes, .01);
      return;
    }
    const c = o.forme === 'arc' ? 0xF2C230 : o.forme === 'kink' ? 0xE23B3B : 0xC9D2DE, n = 16, pts = [], pcs = [];
    for(let k = 0; k <= n; k++){ const s = k / n, y = o.y + s * o.l; pts.push(new T3.Vector3(o.x, base(o.x, y) + Hr(s), y)); }
    for(let k = 0; k < n; k++) pcs.push(tube(pts[k], pts[k + 1], .075, c));
    for(let k = 0; k <= n; k += 4){ const p = pts[k]; pcs.push(tube(new T3.Vector3(p.x, base(p.x, p.z) - .1, p.z), p, .045, 0x4E5868)); }
    objet(ch, pcs, .03);
  }
  function arrivee(ch){
    const y = M.fin, B = M.bord, pcs = [];
    for(const s of [-1, 1]){ const x = s * (B + .5); pcs.push({ f:'cyl', d:[.18, .18, 5.2, 8], c:0x30353E, p:[x, solT(x, y) + 2.6, y] }); }
    objet(ch, pcs, .04);
    const tx = (txt, w, h, fond, coul) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = fond; x.fillRect(0, 0, w, h);
      if(txt){ x.fillStyle = coul; x.font = `bold ${h * .7}px Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; for(let k = 0; k < 3; k++) x.fillText(txt, w * (k + .5) / 3, h * .54); }
      else { const n = 64; for(let i = 0; i < n; i++) for(let j = 0; j < 2; j++) if((i + j) % 2){ x.fillStyle = '#13233A'; x.fillRect(i * w / n, j * h / 2, w / n, h / 2); } }
      return new T3.CanvasTexture(c); };
    const hb = Math.max(solT(-B, y), solT(B, y));
    const m1 = new T3.MeshBasicMaterial({ map:tx('ARRIVÉE', 1024, 64, '#FF6A2B', '#FFFFFF') }); ch.mats.push(m1);
    const g1 = new T3.PlaneGeometry(2 * B + 1, 1.3); ch.geos.push(g1);
    const ban = new T3.Mesh(g1, m1); ban.position.set(0, hb + 4.4, y); ban.rotation.y = Math.PI; ch.gr.add(ban);
    const m2 = new T3.MeshBasicMaterial({ map:tx('', 1024, 32, '#FFFFFF'), polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 }); ch.mats.push(m2);
    const g2 = new T3.PlaneGeometry(2 * B, 1); ch.geos.push(g2);
    const lg = new T3.Mesh(g2, m2); lg.rotation.x = Math.atan(PENTE) - Math.PI / 2; lg.position.set(0, solT(0, y) + .05, y); ch.gr.add(lg);
  }
  // les tranches à garder : un peu derrière, beaucoup devant (une nouvelle par image au plus, sauf au départ)
  function majTranches(P){
    syncDrops();
    const k0 = Math.floor((P.y - 30) / CH), k1 = Math.floor((P.y + 170) / CH);
    for(const k of [...chunks.keys()]) if(k < k0 || k > k1 + 1) oublier(k);
    let faites = 0;
    for(let k = k0; k <= k1; k++){
      if(chunks.has(k)) continue;
      if((k + 1) * CH + 10 > M.genere && M.genere !== Infinity) break;      // pas encore généré (modes sans fin)
      construire(k); faites++;
      if(!E.init && faites >= 1) break;
    }
  }

  /* ---------- Le skieur ---------- */
  const couleurs = new Map();
  const couleur = s => { let c = couleurs.get(s); if(!c){ c = new T3.Color(s); couleurs.set(s, c); } return c; };
  // la pose du jeu (morceaux en repère du corps : X à sa droite, Y devant, Z en haut) → le monde 3D
  function dessinerSkieur(o, x, y, h){
    const S = { cf:Math.cos(o.flip), sf:Math.sin(o.flip), cs:Math.cos(o.tourne), ss:Math.sin(o.tourne), fx:Math.sin(o.th), fy:Math.cos(o.th), rx:-Math.cos(o.th), ry:Math.sin(o.th), ca:Math.cos(Math.atan(PENTE)), sa:Math.sin(Math.atan(PENTE)) };
    const placer = ([X, Y, Z]) => {
      const y1 = Y * S.cf + (Z - .8) * S.sf, z1 = .8 - Y * S.sf + (Z - .8) * S.cf;
      const x2 = X * S.cs - y1 * S.ss, y2 = X * S.ss + y1 * S.cs;
      const dx = (x2 * S.rx + y2 * S.fx) * ECH, dy = (x2 * S.ry + y2 * S.fy) * ECH, up = z1 * ECH;
      return [x + dx, h + up * S.ca - dy * S.sa, y + dy * S.ca + up * S.sa];
    };
    const morceaux = [];
    for(const p of o.pose){
      if(p.point){
        morceaux.push({ s:placer(p.point), r:p.r * ECH, c:couleur(p.c) });
        if(p.visiere) morceaux.push({ s:placer([p.point[0], p.point[1] + p.r * .45, p.point[2] - p.r * .05]), r:p.r * .72 * ECH, c:couleur('#13233A') });
      } else morceaux.push({ a:placer(p.a), b:placer(p.b), r:p.l / 2 * ECH, c:couleur(p.c) });
    }
    remplir(skieur.m.geometry, morceaux, 0, true); remplir(skieur.c.geometry, morceaux, .025, false);
  }
  // écrit les tubes (et une boule à chaque bout) dans le maillage du skieur
  function remplir(g, morceaux, e, avecCouleurs){
    const P = g.attributes.position.array, N = g.attributes.normal.array, C = g.attributes.color.array, tp = GEO.tp, max = P.length / 3;
    let n = 0;
    const boule = (s, r, c) => {
      const a = tp.sp, nn = tp.sn; if(n + a.length / 3 > max) return;
      for(let i = 0; i < a.length; i += 3){ const k = n * 3; P[k] = s[0] + a[i] * r; P[k + 1] = s[1] + a[i + 1] * r; P[k + 2] = s[2] + a[i + 2] * r; N[k] = nn[i]; N[k + 1] = nn[i + 1]; N[k + 2] = nn[i + 2]; if(avecCouleurs){ C[k] = c.r; C[k + 1] = c.g; C[k + 2] = c.b; } n++; }
    };
    for(const m of morceaux){
      const r = m.r + e;
      if(m.s){ boule(m.s, r, m.c); continue; }
      const dx = m.b[0] - m.a[0], dy = m.b[1] - m.a[1], dz = m.b[2] - m.a[2], L = Math.hypot(dx, dy, dz);
      boule(m.a, r, m.c); boule(m.b, r, m.c);
      if(L < 1e-4) continue;
      // une base (u, d, w) : d le long du morceau
      const d = [dx / L, dy / L, dz / L], t = Math.abs(d[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
      let u = [t[1] * d[2] - t[2] * d[1], t[2] * d[0] - t[0] * d[2], t[0] * d[1] - t[1] * d[0]]; const lu = Math.hypot(...u); u = u.map(v => v / lu);
      const w = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
      const mx = (m.a[0] + m.b[0]) / 2, my = (m.a[1] + m.b[1]) / 2, mz = (m.a[2] + m.b[2]) / 2, a = tp.cp, nn = tp.cn;
      if(n + a.length / 3 > max) break;
      for(let i = 0; i < a.length; i += 3){
        const k = n * 3, X = a[i] * r, Y = a[i + 1] * L, Z = a[i + 2] * r;
        P[k] = mx + u[0] * X + d[0] * Y + w[0] * Z; P[k + 1] = my + u[1] * X + d[1] * Y + w[1] * Z; P[k + 2] = mz + u[2] * X + d[2] * Y + w[2] * Z;
        N[k] = u[0] * nn[i] + w[0] * nn[i + 2]; N[k + 1] = u[1] * nn[i] + w[1] * nn[i + 2]; N[k + 2] = u[2] * nn[i] + w[2] * nn[i + 2];
        if(avecCouleurs){ C[k] = m.c.r; C[k + 1] = m.c.g; C[k + 2] = m.c.b; }
        n++;
      }
    }
    g.setDrawRange(0, n);
    g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = true; if(avecCouleurs) g.attributes.color.needsUpdate = true;
  }

  /* ---------- Chaque image ---------- */
  function rendu(P, dt, o){
    if(!ok || !scene || !M) return;
    const t = performance.now() / 1000;
    majTranches(P);
    // la hauteur du skieur : sur la neige au sol, sur le module en slide ; en l'air, la hauteur du jeu au-dessus du sol,
    // plus ce qu'il avait en partant (un tremplin, une bosse), qui s'efface pendant le vol
    const b = base(P.x, P.y), s = sol(P.x, P.y);
    if(P.air && !E.air){ E.off = E.vis - (b + P.z); E.tOff = Math.max(.35, 2 * Math.max(P.vz, .4) / 9.8 + .05); E.tAir = 0; }
    E.air = P.air;
    let cible;
    if(P.slide) cible = b + P.z;
    else if(P.air){ E.tAir += dt; cible = Math.max(s, b + P.z + E.off * Math.max(0, 1 - E.tAir / E.tOff)); }
    else cible = s;
    if(E.init) E.vis = cible;
    else E.vis = P.air ? cible : E.vis + (cible - E.vis) * Math.min(1, dt * 16);
    // le skieur, son ombre
    dessinerSkieur(o, P.x, P.y, E.vis);
    const hz = Math.max(0, E.vis - s);
    ombre.position.set(P.x, s + .04, P.y); ombre.rotation.x = Math.atan(PENTE) - Math.PI / 2; ombre.scale.setScalar(clamp(1 - hz * .05, .55, 1)); ombre.material.opacity = clamp(.3 - hz * .025, .1, .3);
    // les traces
    pistes(P, o);
    // la poudreuse
    const m4 = new T3.Matrix4(), v = new T3.Vector3(), q = new T3.Quaternion(), sc = new T3.Vector3();
    let n = 0;
    for(const p of P.part){ if(n >= 140) break; if(p.h0 === undefined){ p.h0 = sol(p.x, p.y); p.y0 = p.y; } const r = p.r * clamp(p.vie * 2, .2, 1); v.set(p.x, p.h0 - (p.y - p.y0) * PENTE + .25 + p.r + (1 - Math.min(1, p.vie)) * .5, p.y); sc.setScalar(r); m4.compose(v, q, sc); poudre.setMatrixAt(n++, m4); }
    poudre.count = n; poudre.instanceMatrix.needsUpdate = true;
    // les flocons à ramasser
    let nf = 0;
    for(let i = premier(M.flocons, P.y - 3); i < M.flocons.length && M.flocons[i].y < P.y + 110; i++){
      const f = M.flocons[i]; if(f.pris) continue;
      let sp = flocons[nf]; if(!sp){ sp = new T3.Sprite(GEO.flocon); sp.scale.set(1.1, 1.1, 1); scene.add(sp); flocons.push(sp); }
      if(f.h3 === undefined) f.h3 = sol(f.x, f.y);
      sp.visible = true; sp.position.set(f.x, f.h3 + .75 + Math.sin(t * 3 + f.x) * .12, f.y); sp.material.rotation = 0; nf++;
    }
    for(let i = nf; i < flocons.length; i++) flocons[i].visible = false;
    GEO.flocon.rotation = t * .8;
    // l'avalanche
    if(P.av !== null && P.av !== undefined && P.av > P.y - 140){
      let k = 0;
      for(let rang = 0; rang < 2; rang++) for(let x = -M.bord - 12 + rang * 1.4; x <= M.bord + 12 && k < 60; x += 2.8){
        const y = P.av - rang * 3 + Math.sin(x * .9 + t * 6) * .6, r = (rang ? 3.4 : 2.6) + Math.sin(x * 1.7 + t * 5 + rang) * .5;
        v.set(x, solT(x, y) + r * .55, y); q.setFromAxisAngle(new T3.Vector3(1, 0, 0), t * 3 + x); sc.setScalar(r); m4.compose(v, q, sc);
        avalanche.m.setMatrixAt(k, m4); avalanche.c.setMatrixAt(k, m4); k++;
      }
      avalanche.m.count = avalanche.c.count = k; avalanche.m.instanceMatrix.needsUpdate = avalanche.c.instanceMatrix.needsUpdate = true;
    } else avalanche.m.count = avalanche.c.count = 0;
    // la caméra : derrière le skieur, dans le sens de la glisse (en partie), assez basse
    const yawC = clamp(P.th, -1.45, 1.45) * .35;
    E.yaw += (yawC - E.yaw) * (E.init ? 1 : Math.min(1, dt * 2.2));
    // un peu plus basse que la caméra de la Dameuse : 3,6 m au-dessus de la pente, 7 à 9 m derrière (vue à 19° du skieur), le regard incliné de 29°
    const dx = Math.sin(E.yaw), dy = Math.cos(E.yaw), dist = 7 + clamp(P.v, 0, 30) * .07;
    const cx = P.x - dx * dist, cy = P.y - dy * dist;
    const ch = Math.max(E.vis + 3.6 + dist * PENTE, solT(cx, cy) + 1.4);
    if(E.init){ E.cx = cx; E.cy = cy; E.ch = ch; }
    const k = Math.min(1, dt * 7), kh = Math.min(1, dt * 5);
    E.cx += (cx - E.cx) * k; E.cy += (cy - E.cy) * k; E.ch += (ch - E.ch) * kh;
    E.ch = Math.max(E.ch, solT(E.cx, E.cy) + 1);
    const tremble = o.tremble || 0, inc = .5;
    cam.position.set(E.cx + (Math.random() - .5) * tremble, E.ch + (Math.random() - .5) * tremble, E.cy);
    cam.lookAt(E.cx + dx * Math.cos(inc) * 10, E.ch - Math.sin(inc) * 10, E.cy + dy * Math.cos(inc) * 10);
    montagnes.position.set(P.x * .6, E.vis - 175, P.y);
    E.init = false;
    R.render(scene, cam);
  }
  // les traces des skis (deux rubans) ou de la planche (un large)
  function pistes(P, o){
    const A = traces.geometry.attributes.position.array, max = A.length / 3;
    let n = 0;
    const ski = o.engin === 'ski', ecarts = ski ? [-.17, .17] : [0], w = ski ? .05 : .16;
    for(const e of ecarts){
      let prec = null;
      for(const p of P.traces){
        if(!p){ prec = null; continue; }
        if(p.h3 === undefined) p.h3 = sol(p.x, p.y) + .03;
        const x = p.x + Math.cos(p.th) * e, y = p.y - Math.sin(p.th) * e;
        if(prec && n + 6 <= max){
          const ddx = x - prec[0], ddy = y - prec[1], l = Math.hypot(ddx, ddy) || 1, nx = -ddy / l * w, ny = ddx / l * w;
          const a = [prec[0] + nx, prec[2], prec[1] + ny], b = [prec[0] - nx, prec[2], prec[1] - ny], c = [x - nx, p.h3, y - ny], d = [x + nx, p.h3, y + ny];
          for(const s of [a, b, c, a, c, d]){ A[n * 3] = s[0]; A[n * 3 + 1] = s[1]; A[n * 3 + 2] = s[2]; n++; }
        }
        prec = [x, y, p.h3];
      }
    }
    traces.geometry.setDrawRange(0, n); traces.geometry.attributes.position.needsUpdate = true;
  }
  // un point du jeu (x, y, hauteur au-dessus du sol) sur l'écran ; ou le skieur (dh au-dessus de lui)
  function ecran(x, y, dh, w, h){
    if(!ok || !M) return null;
    const v = new T3.Vector3(x, sol(x, y) + dh, y).project(cam);
    if(v.z > 1) return null;
    return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h];
  }
  function ecranSkieur(P, dh, w, h){
    if(!ok || !M) return null;
    const v = new T3.Vector3(P.x, E.vis + dh, P.y).project(cam);
    if(v.z > 1) return null;
    return [(v.x + 1) / 2 * w, (1 - v.y) / 2 * h];
  }
  function arreter(){ if(!ok) return; for(const k of [...chunks.keys()]) oublier(k); M = null; }

  return { init, taille, nouvellePartie, rendu, ecran, ecranSkieur, arreter, get ok(){ return ok; }, get pret(){ return !!M; }, PENTE, sol:(x, y) => M ? sol(x, y) : 0, get scene(){ return scene; } };
})();
