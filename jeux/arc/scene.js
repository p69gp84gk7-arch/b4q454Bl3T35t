/* Flèche d'or : la scène 3D (Three.js), en style « dessin animé » comme la Dameuse et Freeride (ombrage en tons, contours foncés).
   L'archer est en (0, sol, 0) et tire vers -Z. La scène ne fait que dessiner : le jeu (arc.html) calcule le vol des flèches et les points.
   Trois décors : « pas de tir » (la cible des concours, une prairie d'alpage tondue), « forêt » (un poste du parcours en montagne :
   une pente, des sapins, un animal-cible) et « mobiles » (ballons, plateaux et cible qui glisse sur un rail). */
window.ARC_3D = (() => {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const alea = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  let T3 = null, R = null, scene = null, cam = null, ok = false, DEGRADE = null, CONTOUR = null, MAT = null;
  let solF = () => 0, jetables = [], fleches = [], mobiles = [], drapeaux = [], temps = 0;
  const toon = o => new T3.MeshToonMaterial(Object.assign({ gradientMap:DEGRADE }, o));

  /* ---------- Les formes ---------- */
  function geom(f, d, e = 0){
    switch(f){
      case 'boite': return new T3.BoxGeometry(d[0] + 2 * e, d[1] + 2 * e, d[2] + 2 * e);
      case 'cyl': return new T3.CylinderGeometry(d[0] + e, d[1] + e, d[2] + 2 * e, d[3] || 10);
      case 'cone': return new T3.ConeGeometry(d[0] + e, d[1] + 2 * e, d[2] || 8);
      case 'boule': return new T3.IcosahedronGeometry(d[0] + e, d[1] ?? 1);
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
  // un objet de pièces avec son contour
  function objet(pieces, e = .04, contour = true){
    const gr = new T3.Group(), g1 = fusion(pieces); jetables.push(g1);
    gr.add(new T3.Mesh(g1, MAT));
    if(contour){ const g2 = fusion(pieces, e); jetables.push(g2); gr.add(new T3.Mesh(g2, CONTOUR)); }
    return gr;
  }
  function serie(pieces, liste, regler, e = .06){
    if(!liste.length) return;
    const g = fusion(pieces), gc = fusion(pieces, e); jetables.push(g, gc);
    const im = new T3.InstancedMesh(g, MAT, liste.length), ic = new T3.InstancedMesh(gc, CONTOUR, liste.length);
    const m = new T3.Matrix4(), q = new T3.Quaternion(), v = new T3.Vector3(), s = new T3.Vector3(), Y = new T3.Vector3(0, 1, 0);
    liste.forEach((it, k) => { regler(it, v, q, s, Y); m.compose(v, q, s); im.setMatrixAt(k, m); ic.setMatrixAt(k, m); });
    scene.add(im, ic);
  }
  const SAPIN = [
    { f:'cyl', d:[.22, .3, 1.4, 6], c:0x5A3B26, p:[0, .7, 0] },
    { f:'cone', d:[1.9, 2.8, 7], c:0x1F5A44, p:[0, 2.4, 0] }, { f:'cone', d:[1.5, 2.4, 7], c:0x24664D, p:[0, 3.7, 0] }, { f:'cone', d:[1, 2, 7], c:0x2B7558, p:[0, 4.9, 0] },
  ];
  const FEUILLU = [{ f:'cyl', d:[.2, .28, 2, 6], c:0x6A4A30, p:[0, 1, 0] }, { f:'boule', d:[1.6, 1], c:0x4E9A45, p:[0, 3, 0], s:[1, .9, 1] }, { f:'boule', d:[1.1, 1], c:0x5BAE50, p:[.7, 3.7, .3] }];
  const ROCHER = [{ f:'boule', d:[1, 1], c:0x8A9099, s:[1, .65, .9], p:[0, .2, 0] }];

  /* ---------- Démarrage ---------- */
  function init(canvas){
    if(ok) return true;
    try{
      T3 = window.THREE; if(!T3) return false;
      R = new T3.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
      R.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
      const d = new Uint8Array([105, 105, 105, 255, 180, 180, 180, 255, 255, 255, 255, 255]);
      DEGRADE = new T3.DataTexture(d, 3, 1, T3.RGBAFormat); DEGRADE.minFilter = DEGRADE.magFilter = T3.NearestFilter; DEGRADE.needsUpdate = true;
      CONTOUR = new T3.MeshBasicMaterial({ color:0x1B2A40, side:T3.BackSide });
      MAT = toon({ vertexColors:true });
      cam = new T3.PerspectiveCamera(50, 1, .05, 2000);
      ok = true;
    }catch(e){ ok = false; }
    return ok;
  }
  let L = 1, H = 1;
  function taille(w, h){ if(!ok) return; L = w; H = h; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }

  /* ---------- Le décor ---------- */
  function vider(){
    if(scene) scene.traverse(o => { if(o.material && o.material.map && o.material.userData.propre) o.material.map.dispose(); });
    for(const g of jetables) g.dispose();
    jetables = []; fleches = []; mobiles = []; drapeaux = [];
    scene = new T3.Scene();
    scene.background = new T3.Color(0x8FCBF3);
    scene.fog = new T3.Fog(0xCFE6F7, 140, 900);
    scene.add(new T3.HemisphereLight(0xF2F8FF, 0x6F8A5A, .75));
    const soleil = new T3.DirectionalLight(0xFFF4DE, .7); soleil.position.set(-.5, 1, .35); scene.add(soleil);
    // les montagnes au loin, derrière le pas de tir
    const R0 = alea(11);
    for(let k = 0; k < 15; k++){
      const a = -1.4 + k * 2.8 / 14 + (R0() - .5) * .1, D = 620 + R0() * 200, Hm = 180 + R0() * 230, Rr = 150 + R0() * 120;
      const m = new T3.Mesh(new T3.ConeGeometry(Rr, Hm, 7), new T3.MeshBasicMaterial({ color:k % 2 ? 0x9DB9DD : 0xAEC6E6, fog:false }));
      m.position.set(Math.sin(a) * D, Hm / 2 - 60, -Math.cos(a) * D); m.rotation.y = R0() * 6;
      const c = new T3.Mesh(new T3.ConeGeometry(Rr * .36, Hm * .36, 7), new T3.MeshBasicMaterial({ color:0xF5F8FC, fog:false }));
      c.position.set(m.position.x, Hm * .82 - 60 + 1, m.position.z); c.rotation.y = m.rotation.y;
      jetables.push(m.geometry, c.geometry); scene.add(m, c);
    }
  }
  // le terrain : une grille (x de -X à X, z de z0 à z1), avec ses couleurs (bandes tondues, chemin…)
  function terrain(X, z0, z1, pas, couleur){
    const nx = Math.round(2 * X / pas), nz = Math.round((z0 - z1) / pas), N = (nx + 1) * (nz + 1);
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), idx = [], c = new T3.Color();
    for(let j = 0; j <= nz; j++) for(let i = 0; i <= nx; i++){
      const k = j * (nx + 1) + i, x = -X + i * pas, z = z0 - j * pas;
      pos[k * 3] = x; pos[k * 3 + 1] = solF(x, z); pos[k * 3 + 2] = z;
      c.set(couleur(x, z)); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    for(let j = 0; j < nz; j++) for(let i = 0; i < nx; i++){ const a = j * (nx + 1) + i, b = a + 1, cc = a + nx + 1, d = cc + 1; idx.push(a, b, cc, b, d, cc); }
    const g = new T3.BufferGeometry(); g.setAttribute('position', new T3.BufferAttribute(pos, 3)); g.setAttribute('color', new T3.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    jetables.push(g); scene.add(new T3.Mesh(g, toon({ vertexColors:true })));
  }
  function arbres(liste){
    serie(SAPIN, liste.filter(a => !a.f), (a, v, q, s, Y) => { v.set(a.x, solF(a.x, a.z) - .1, a.z); q.setFromAxisAngle(Y, a.r * 6); const t = a.t; s.set(t, t * (1 + a.r * .3), t); });
    serie(FEUILLU, liste.filter(a => a.f), (a, v, q, s, Y) => { v.set(a.x, solF(a.x, a.z) - .1, a.z); q.setFromAxisAngle(Y, a.r * 6); s.setScalar(a.t); });
  }
  function rochers(liste){ serie(ROCHER, liste, (a, v, q, s, Y) => { v.set(a.x, solF(a.x, a.z) - .2 * a.t, a.z); q.setFromAxisAngle(Y, a.r * 6); s.setScalar(a.t); }, .05); }
  // un drapeau qui flotte dans le vent (au bout d'un mât)
  function drapeau(x, y, z, h, coul){
    scene.add(objet([{ f:'cyl', d:[.03, .03, h, 6], c:0x30353E, p:[x, y + h / 2, z] }], .02));
    const g = new T3.PlaneGeometry(.7, .42, 6, 1); g.translate(.35, 0, 0); jetables.push(g);
    const m = new T3.Mesh(g, new T3.MeshToonMaterial({ color:coul, gradientMap:DEGRADE, side:T3.DoubleSide }));
    m.position.set(x, y + h - .22, z); scene.add(m); drapeaux.push({ m, base:g.attributes.position.array.slice() });
  }
  // la face de cible (anneaux de 1 à 10, et le X)
  let texFace = null;
  function faceTexture(){
    if(texFace) return texFace;
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'), r = 256;
    const coul = ['#FFFFFF', '#FFFFFF', '#1C1C20', '#1C1C20', '#2A9BE0', '#2A9BE0', '#E8322F', '#E8322F', '#FFD534', '#FFD534'];
    for(let k = 0; k < 10; k++){ const rr = r * (10 - k) / 10 - 1; x.beginPath(); x.arc(r, r, rr, 0, 7); x.fillStyle = coul[k]; x.fill(); x.lineWidth = 1.6; x.strokeStyle = k === 2 || k === 3 ? '#FFFFFF' : '#1C1C20'; x.stroke(); }
    x.beginPath(); x.arc(r, r, r / 20, 0, 7); x.lineWidth = 1.2; x.strokeStyle = '#1C1C20'; x.stroke();
    x.beginPath(); x.moveTo(r - 6, r); x.lineTo(r + 6, r); x.moveTo(r, r - 6); x.lineTo(r, r + 6); x.stroke();
    texFace = new T3.CanvasTexture(c); texFace.anisotropy = 4; return texFace;
  }
  // une cible de concours sur sa butte de paille : centre à 1,30 m du sol, face de diamètre D
  function cibleConcours(x, z, D, num){
    const y = solF(x, z), cy = y + 1.3;
    const B = Math.max(1.3, D + .3);
    scene.add(objet([
      { f:'boite', d:[B, B, .45], c:0xD8B46A, p:[x, cy, z] },
      // le chevalet, derrière la butte
      { f:'cyl', d:[.05, .05, 2.3, 6], c:0x6A4A30, p:[x - B * .42, y + 1.05, z - .45], r:[.38, 0, 0] }, { f:'cyl', d:[.05, .05, 2.3, 6], c:0x6A4A30, p:[x + B * .42, y + 1.05, z - .45], r:[.38, 0, 0] },
      { f:'boite', d:[B * .95, .08, .08], c:0x6A4A30, p:[x, cy - B / 2 - .04, z] },
    ], .03));
    // la paille : quelques brins
    const brins = []; const R0 = alea(z * 13 | 0);
    for(let k = 0; k < 40; k++) brins.push({ f:'boite', d:[B * .9, .012, .004], c:0xB8954F, p:[x, cy - B / 2 + R0() * B, z + .226], r:[0, 0, (R0() - .5) * .15] });
    scene.add(objet(brins, 0, false));
    const g = new T3.PlaneGeometry(D, D); jetables.push(g);
    const m = new T3.Mesh(g, new T3.MeshBasicMaterial({ map:faceTexture(), transparent:true, alphaTest:.5 }));
    m.position.set(x, cy, z + .231); scene.add(m);
    if(num){
      const c = document.createElement('canvas'); c.width = 128; c.height = 64; const t = c.getContext('2d'); t.fillStyle = '#fff'; t.fillRect(0, 0, 128, 64); t.fillStyle = '#13233A'; t.font = 'bold 44px Arial'; t.textAlign = 'center'; t.fillText(num, 64, 48);
      const tx = new T3.CanvasTexture(c), mp = new T3.MeshBasicMaterial({ map:tx }); mp.userData.propre = true;
      const gp = new T3.PlaneGeometry(.5, .25); jetables.push(gp); const p = new T3.Mesh(gp, mp); p.position.set(x, cy + B / 2 + .2, z + .2); scene.add(p);
    }
    drapeau(x + B / 2 + .3, y, z, 3.4, 0xFFC93C);
    return { x, y:cy, z:z + .231, D };
  }

  /* ---------- Les animaux du parcours ----------
     taille : L (longueur du corps), H (hauteur du corps), pattes ; ils sont de profil, tournés vers sens (+1 vers +x) */
  const ANIMAUX = {
    marmotte:{ n:'Marmotte', L:.45, H:.3, p:.1, c:0x9B7550, v:0xD9B98A },
    lapin:{ n:'Lièvre', L:.42, H:.26, p:.12, c:0xA88C6C, v:0xEDE2D2, oreilles:true },
    renard:{ n:'Renard', L:.7, H:.32, p:.28, c:0xD9692E, v:0xF5EBDD, queue:true },
    chamois:{ n:'Chamois', L:1, H:.5, p:.55, c:0x8A6542, v:0xEFE6D6, cornes:'crochets' },
    sanglier:{ n:'Sanglier', L:1.05, H:.6, p:.3, c:0x4C3A2E, v:0x6A5544, defenses:true },
    bouquetin:{ n:'Bouquetin', L:1.15, H:.6, p:.55, c:0x8D7D68, v:0xD8CDBB, cornes:'grandes' },
    cerf:{ n:'Cerf', L:1.45, H:.72, p:.8, c:0x8E5C34, v:0xE8D3B0, cornes:'bois' },
    ours:{ n:'Ours', L:1.6, H:.95, p:.45, c:0x5A3C25, v:0x7A5638 },
  };
  function animal(type, x, z, sens){
    const A = ANIMAUX[type], y = solF(x, z), by = y + A.p + A.H / 2, s = sens;
    const P = [
      { f:'boule', d:[1, 1], c:A.c, p:[x, by, z], s:[A.L / 2, A.H / 2, A.H * .42] },
      { f:'boule', d:[1, 1], c:A.v, p:[x + s * A.L * .08, by - A.H * .2, z], s:[A.L * .35, A.H * .28, A.H * .38] },
      { f:'boule', d:[1, 1], c:A.c, p:[x + s * A.L * .55, by + A.H * .32, z], s:[A.H * .36, A.H * .33, A.H * .3] },
      { f:'boule', d:[1, 1], c:0x2A2420, p:[x + s * (A.L * .55 + A.H * .34), by + A.H * .28, z], s:[A.H * .08, A.H * .07, A.H * .08] },
    ];
    for(const dx of [-.32, .32]) for(const dz of [-1, 1]) P.push({ f:'cyl', d:[A.H * .09, A.H * .07, A.p + A.H * .2, 6], c:A.c, p:[x + s * dx * A.L, y + (A.p + A.H * .2) / 2, z + dz * A.H * .18] });
    if(A.oreilles) for(const dz of [-1, 1]) P.push({ f:'boule', d:[1, 0], c:A.c, p:[x + s * A.L * .55, by + A.H * .75, z + dz * A.H * .08], s:[A.H * .06, A.H * .3, A.H * .05] });
    else for(const dz of [-1, 1]) P.push({ f:'cone', d:[A.H * .08, A.H * .2, 5], c:A.c, p:[x + s * A.L * .5, by + A.H * .6, z + dz * A.H * .14] });
    if(A.queue) P.push({ f:'boule', d:[1, 1], c:A.c, p:[x - s * A.L * .6, by - A.H * .05, z], s:[A.L * .25, A.H * .14, A.H * .14], r:[0, 0, s * .4] });
    if(A.defenses) for(const dz of [-1, 1]) P.push({ f:'cone', d:[A.H * .03, A.H * .16, 4], c:0xF2EBDD, p:[x + s * (A.L * .55 + A.H * .3), by + A.H * .18, z + dz * A.H * .1] });
    if(A.cornes === 'crochets') for(const dz of [-1, 1]) P.push({ f:'cyl', d:[A.H * .025, A.H * .03, A.H * .45, 5], c:0x1E1A16, p:[x + s * A.L * .5, by + A.H * .78, z + dz * A.H * .08], r:[0, 0, -s * .25] });
    if(A.cornes === 'grandes') for(const dz of [-1, 1]) P.push({ f:'cyl', d:[A.H * .04, A.H * .07, A.H * 1.1, 6], c:0x7A6A55, p:[x + s * A.L * .38, by + A.H * .95, z + dz * A.H * .1], r:[0, 0, s * .9] });
    if(A.cornes === 'bois') for(const dz of [-1, 1]){ P.push({ f:'cyl', d:[A.H * .03, A.H * .04, A.H * .9, 5], c:0x6E5338, p:[x + s * A.L * .5, by + A.H * 1.05, z + dz * A.H * .14], r:[dz * .3, 0, -s * .2] }); P.push({ f:'cyl', d:[A.H * .025, A.H * .03, A.H * .45, 5], c:0x6E5338, p:[x + s * A.L * .62, by + A.H * 1.1, z + dz * A.H * .2], r:[dz * .3, 0, -s * .9] }); }
    scene.add(objet(P, .025));
    // la zone vitale, dessinée sur le flanc (pâle) : le 10 et le 8
    const c = document.createElement('canvas'); c.width = c.height = 128; const t = c.getContext('2d');
    t.strokeStyle = 'rgba(255,240,200,.85)'; t.lineWidth = 4; t.beginPath(); t.arc(64, 64, 60, 0, 7); t.stroke(); t.beginPath(); t.arc(64, 64, 30, 0, 7); t.stroke();
    const tx = new T3.CanvasTexture(c), mz = new T3.MeshBasicMaterial({ map:tx, transparent:true, depthWrite:false }); mz.userData.propre = true;
    const r8 = A.H * .36, gz = new T3.PlaneGeometry(r8 * 2, r8 * 2); jetables.push(gz);
    const vx = x + s * A.L * .16, vy = by + A.H * .02, zz = new T3.Mesh(gz, mz); zz.position.set(vx, vy, z + A.H * .43); scene.add(zz);
    return { type, n:A.n, x, z, sens:s, by, A, vital:{ x:vx, y:vy, r10:A.H * .18, r8 }, corps:{ x, y:by, rx:A.L / 2, ry:A.H / 2 }, tete:{ x:x + s * A.L * .55, y:by + A.H * .32, r:A.H * .36 } };
  }

  /* ---------- Les trois décors ---------- */
  // le pas de tir : une prairie tondue, des lignes de distance, la cible à d mètres
  function pasDeTir(d, D, opt = {}){
    vider();
    solF = (x, z) => { const loin = Math.max(0, Math.abs(x) - 14); return Math.sin(x * .07 + z * .05) * .15 * Math.min(1, loin / 10) + loin * loin * .012 + (z < -d - 25 ? (-(z + d + 25)) * .08 : 0); };
    terrain(120, 30, -d - 160, 2, (x, z) => Math.abs(x) < 14 ? ((Math.floor(-z / 5) % 2) ? '#86C561' : '#7AB656') : '#6FAE4E');
    // les lignes de distance tous les 10 m
    const lignes = [];
    for(let m = 10; m <= Math.max(90, d + 10); m += 10) lignes.push({ f:'boite', d:[28, .02, .12], c:0xFFFFFF, p:[0, solF(0, -m) + .02, -m] });
    lignes.push({ f:'boite', d:[28, .02, .18], c:0xFFFFFF, p:[0, .03, -.6] });
    scene.add(objet(lignes, 0, false));
    const cible = cibleConcours(0, -d, D, opt.num || `${d} m`);
    // les cibles voisines (décor)
    for(const s of [-1, 1]) cibleConcours(s * 5.5, -d, D, null);
    const R0 = alea(d * 7 + 3), liste = [];
    for(let k = 0; k < 90; k++){ const s = R0() < .5 ? -1 : 1; liste.push({ x:s * (18 + R0() * 80), z:20 - R0() * (d + 150), t:.8 + R0() * .7, r:R0(), f:R0() < .3 }); }
    for(let k = 0; k < 18; k++) liste.push({ x:(R0() - .5) * 60, z:-d - 22 - R0() * 40, t:.9 + R0() * .6, r:R0(), f:R0() < .4 });
    arbres(liste);
    // le filet de sécurité derrière les cibles
    const gf = new T3.PlaneGeometry(40, 4); jetables.push(gf);
    const fil = new T3.Mesh(gf, new T3.MeshBasicMaterial({ color:0x2E5E3A, transparent:true, opacity:.55, side:T3.DoubleSide })); fil.position.set(0, solF(0, -d - 8) + 2, -d - 8); scene.add(fil);
    drapeau(-12, solF(-12, -d / 2), -d / 2, 4, 0xE23B3B); drapeau(12, solF(12, -d / 2), -d / 2, 4, 0xE23B3B);
    return { cible, oeil:1.62 + solF(0, 0) };
  }
  // un poste du parcours : la pente (montée ou descente) jusqu'à l'animal, la forêt autour
  function poste(cfg){
    vider();
    const d = cfg.d, pente = cfg.pente, R0 = alea(cfg.seed || 1), ph = [R0() * 6, R0() * 6];
    const bosse = (x, z) => Math.sin(x * .11 + ph[0]) * Math.sin(z * .09 + ph[1]) * 1.4 + Math.sin(x * .31 + z * .23) * .25;
    solF = (x, z) => -z * pente + bosse(x, z) * clamp((Math.hypot(x, z) - 3) / 8, 0, 1) + Math.max(0, Math.abs(x) - 25) ** 1.3 * .25;
    terrain(110, 25, -d - 110, 2.2, (x, z) => { const n = Math.sin(x * 1.3 + z * .7) * Math.sin(x * .4 - z * 1.1); return n > .5 ? '#5E9A44' : n < -.6 ? '#8C7A5A' : '#6FA84E'; });
    const a = animal(cfg.animal, cfg.dx, -d, cfg.sens);
    // des sapins tout autour, mais pas sur la ligne de tir
    const liste = [], ax = cfg.dx;
    for(let k = 0; k < 140; k++){
      const x = (R0() - .5) * 140, z = 12 - R0() * (d + 100), t = (z - 0) / (-d), lx = ax * clamp(t, 0, 1);
      if(Math.abs(x - lx) < 5.5 + Math.abs(z) * .06 && z > -d - 6 && z < 4) continue;
      if(Math.hypot(x, z) < 7) continue;
      liste.push({ x, z, t:.9 + R0() * .8, r:R0(), f:R0() < .25 });
    }
    arbres(liste);
    const roc = []; for(let k = 0; k < 25; k++){ const x = (R0() - .5) * 90, z = 8 - R0() * (d + 60); if(Math.abs(x - ax * clamp(-z / d, 0, 1)) < 3 && z > -d - 4) continue; roc.push({ x, z, t:.4 + R0() * 1.2, r:R0() }); }
    rochers(roc);
    // le piquet du poste, devant l'archer
    scene.add(objet([{ f:'cyl', d:[.05, .05, .7, 6], c:0xFF6A2B, p:[.6, solF(.6, -1) + .35, -1] }, { f:'boite', d:[.3, .2, .03], c:0xFFFFFF, p:[.6, solF(.6, -1) + .75, -1] }], .02));
    drapeau(ax + (cfg.sens > 0 ? -3 : 3), solF(ax + (cfg.sens > 0 ? -3 : 3), -d - 2), -d - 2, 3, 0xFFC93C);
    return { animal:a, oeil:1.62 + solF(0, 0) };
  }
  // le stand des cibles mobiles : un rail à 18 m, des ballons et des plateaux qui passent
  function stand(){
    vider();
    solF = (x, z) => { const loin = Math.max(0, Math.abs(x) - 16); return loin * loin * .015 + (z < -40 ? (-(z + 40)) * .12 : 0); };
    terrain(110, 25, -220, 2, (x, z) => Math.abs(x) < 16 ? ((Math.floor(-z / 4) % 2) ? '#86C561' : '#7AB656') : '#6FAE4E');
    scene.add(objet([{ f:'boite', d:[24, .12, .12], c:0x4A505C, p:[0, solF(0, -18) + .55, -18] }, { f:'cyl', d:[.06, .06, .55, 6], c:0x4A505C, p:[-11.5, solF(-11.5, -18) + .27, -18] }, { f:'cyl', d:[.06, .06, .55, 6], c:0x4A505C, p:[11.5, solF(11.5, -18) + .27, -18] }], .02));
    const R0 = alea(77), liste = [];
    for(let k = 0; k < 90; k++){ const s = R0() < .5 ? -1 : 1; liste.push({ x:s * (20 + R0() * 80), z:20 - R0() * 200, t:.8 + R0() * .7, r:R0(), f:R0() < .3 }); }
    for(let k = 0; k < 30; k++) liste.push({ x:(R0() - .5) * 70, z:-45 - R0() * 60, t:.9 + R0() * .6, r:R0(), f:R0() < .4 });
    arbres(liste);
    drapeau(-14, solF(-14, -14), -14, 4, 0xE23B3B); drapeau(14, solF(14, -14), -14, 4, 0xE23B3B);
    return { oeil:1.62 + solF(0, 0) };
  }
  // les cibles mobiles : le jeu les déplace (m.position)
  function mobile(type, coul){
    let gr;
    if(type === 'ballon'){
      gr = objet([{ f:'boule', d:[.3, 2], c:coul, s:[1, 1.15, 1] }, { f:'cone', d:[.05, .08, 6], c:coul, p:[0, -.36, 0], r:[Math.PI, 0, 0] }], .02);
      const gl = new T3.BufferGeometry().setFromPoints([new T3.Vector3(0, -.4, 0), new T3.Vector3(.05, -1.4, 0)]); jetables.push(gl);
      gr.add(new T3.Line(gl, new T3.LineBasicMaterial({ color:0xFFFFFF })));
    } else if(type === 'plateau') gr = objet([{ f:'cyl', d:[.11, .13, .03, 14], c:0xFF6A2B }, { f:'cyl', d:[.06, .06, .035, 10], c:0xFFFFFF }], .015);
    else {
      gr = objet([{ f:'boite', d:[.75, .75, .2], c:0xD8B46A }, { f:'boite', d:[.5, .1, .5], c:0x4A505C, p:[0, -.42, 0] }], .02);
      const g = new T3.PlaneGeometry(.6, .6); jetables.push(g);
      const f = new T3.Mesh(g, new T3.MeshBasicMaterial({ map:faceTexture(), transparent:true, alphaTest:.5 })); f.position.z = .101; gr.add(f);
    }
    scene.add(gr); mobiles.push(gr); return gr;
  }
  function retirer(gr){ if(gr) scene.remove(gr); }

  /* ---------- Les flèches ---------- */
  // une flèche fine (8 mm, 76 cm), sa pointe, son encoche, et trois plumes en forme d'aile, posées à 120° autour du tube
  let plumeG = null;
  function fleche(coul = 0xFF6A2B){
    const gr = new T3.Group();
    gr.add(objet([
      { f:'cyl', d:[.004, .004, .74, 6], c:0x2A2E36, r:[Math.PI / 2, 0, 0] },
      { f:'cone', d:[.0055, .028, 6], c:0xC9CFD8, p:[0, 0, -.384], r:[-Math.PI / 2, 0, 0] },
      { f:'cyl', d:[.0045, .0045, .02, 6], c:0xFFC93C, p:[0, 0, .375], r:[Math.PI / 2, 0, 0] },
    ], .0018));
    if(!plumeG){
      // le profil d'une plume : basse à l'arrière, elle monte puis s'arrondit vers l'avant (8 cm de long, 1,6 cm de haut)
      const f = new T3.Shape(); f.moveTo(0, 0); f.lineTo(.08, 0); f.quadraticCurveTo(.075, .016, .03, .016); f.quadraticCurveTo(.008, .016, 0, .009); f.lineTo(0, 0);
      plumeG = new T3.ShapeGeometry(f, 4);
    }
    for(let k = 0; k < 3; k++){
      const m = new T3.Mesh(plumeG, new T3.MeshToonMaterial({ color:k ? coul : 0xFFFFFF, gradientMap:DEGRADE, side:T3.DoubleSide }));
      // la plume part du tube (rayon 4 mm), à plat le long de la flèche ; l'arrière vers l'encoche (+z)
      const piv = new T3.Group(); piv.rotation.z = k * 2.094;
      m.rotation.set(0, Math.PI / 2, 0); m.position.set(0, .004, .355);
      piv.add(m); gr.add(piv);
    }
    scene.add(gr); fleches.push(gr); return gr;
  }
  // place une flèche : pointe en p, dans la direction d
  function placer(gr, p, d){
    gr.position.set(p[0] - d[0] * .4, p[1] - d[1] * .4, p[2] - d[2] * .4);
    gr.lookAt(gr.position.x - d[0], gr.position.y - d[1], gr.position.z - d[2]);
  }
  function effacerFleches(){ for(const f of fleches) scene.remove(f); fleches = []; }

  /* ---------- La caméra et l'image ---------- */
  function regarder(p, cible, fov){ cam.position.set(...p); cam.fov = fov; cam.updateProjectionMatrix(); cam.lookAt(...cible); }
  function rendu(dt, vent){
    if(!ok || !scene) return;
    temps += dt;
    // les drapeaux flottent du côté où le vent souffle (plus ou moins fort)
    for(const d of drapeaux){
      const a = d.m.geometry.attributes.position.array, f = clamp(Math.abs(vent) / 6, .1, 1);
      d.m.rotation.y = vent >= 0 ? 0 : Math.PI;
      for(let i = 0; i < a.length; i += 3){ const u = d.base[i] / .7; a[i] = d.base[i] * (.35 + .65 * f); a[i + 1] = d.base[i + 1] - (1 - f) * u * .35; a[i + 2] = Math.sin(temps * (4 + 6 * f) - u * 5) * .06 * u * (.4 + f); }
      d.m.geometry.attributes.position.needsUpdate = true;
    }
    R.render(scene, cam);
  }
  function ecran(x, y, z){
    if(!ok) return null;
    const v = new T3.Vector3(x, y, z).project(cam);
    if(v.z > 1) return null;
    return [(v.x + 1) / 2 * L, (1 - v.y) / 2 * H];
  }
  return { init, taille, pasDeTir, poste, stand, mobile, retirer, fleche, placer, effacerFleches, regarder, rendu, ecran, sol:(x, z) => solF(x, z), ANIMAUX, get ok(){ return ok; }, get camera(){ return cam; } };
})();
